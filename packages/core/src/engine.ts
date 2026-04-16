import * as fs from "node:fs";
import * as path from "node:path";
import type {
  AutoresearchRuntime,
  ContextUsage,
  ExperimentResult,
  ExperimentState,
  LogDetails,
  RunDetails,
  ToolTextResult,
} from "./types.js";
import { resolveWorkDir, validateWorkDir, readMaxExperiments } from "./config.js";
import { loadStateFromJsonl, jsonlPathForWorkDir } from "./jsonl.js";
import {
  cloneExperimentState,
  createExperimentState,
  segmentExperimentCount,
} from "./state.js";
import {
  computeConfidence,
  currentResults,
  findBaselineMetric,
  findBaselineSecondary,
  inferSecondaryUnit,
  isBetter,
  parseMetricLines,
} from "./metrics.js";
import { formatNum } from "./format.js";
import { truncateTail, formatTruncationFooter } from "./truncate.js";
import {
  spawnBashCapture,
  isAutoresearchShCommand,
  runChecksScript,
  createTempFileAllocator,
} from "./run.js";
import { execGit, revertWorkingTreePreservingAutoresearch } from "./git.js";
import {
  DEFAULT_MAX_BYTES,
  DEFAULT_MAX_LINES,
  EXPERIMENT_MAX_BYTES,
  EXPERIMENT_MAX_LINES,
} from "./constants.js";

const CONTEXT_SAFETY_MARGIN = 1.2;

function estimateTokensPerIteration(history: number[]): number {
  const mean = history.reduce((a, b) => a + b, 0) / history.length;
  const sorted = [...history].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  return Math.max(mean, median);
}

function hasRoomForNextIteration(
  history: number[],
  currentTokens: number,
  contextWindow: number
): boolean {
  if (history.length < 1) return true;
  const projectedTokens =
    currentTokens + estimateTokensPerIteration(history) * CONTEXT_SAFETY_MARGIN;
  return projectedTokens <= contextWindow;
}

function createRuntime(): AutoresearchRuntime {
  return {
    autoresearchMode: false,
    dashboardExpanded: false,
    lastRunChecks: null,
    lastRunDuration: null,
    runningExperiment: null,
    iterationStartTokens: null,
    iterationTokenHistory: [],
  };
}

export interface InitExperimentParams {
  name: string;
  metric_name: string;
  metric_unit?: string;
  direction?: string;
}

export interface RunExperimentParams {
  command: string;
  timeout_seconds?: number;
  checks_timeout_seconds?: number;
}

export interface LogExperimentParams {
  commit: string;
  metric: number;
  status: ExperimentResult["status"];
  description: string;
  metrics?: Record<string, number>;
  force?: boolean;
  asi?: Record<string, unknown>;
}

export class AutoresearchEngine {
  readonly ctxCwd: string;
  state: ExperimentState;
  readonly runtime: AutoresearchRuntime;

  constructor(ctxCwd: string) {
    this.ctxCwd = ctxCwd;
    this.state = createExperimentState();
    this.runtime = createRuntime();
    this.reloadFromDisk();
  }

  get workDir(): string {
    return resolveWorkDir(this.ctxCwd);
  }

  reloadFromDisk(): void {
    this.state = loadStateFromJsonl(this.workDir);
    this.state.maxExperiments = readMaxExperiments(this.ctxCwd);
    const jsonl = jsonlPathForWorkDir(this.workDir);
    this.runtime.autoresearchMode = fs.existsSync(jsonl);
  }

  private advanceIterationTracking(getContextUsage?: () => ContextUsage | null): void {
    const usage = getContextUsage?.();
    if (usage?.tokens == null) return;
    if (this.runtime.iterationStartTokens == null) {
      this.runtime.iterationStartTokens = usage.tokens;
      return;
    }
    const consumed = usage.tokens - this.runtime.iterationStartTokens;
    if (consumed > 0) {
      this.runtime.iterationTokenHistory.push(consumed);
    }
    this.runtime.iterationStartTokens = usage.tokens;
  }

  private lastIterationTokens(): number | null {
    const h = this.runtime.iterationTokenHistory;
    if (h.length === 0) return null;
    return h[h.length - 1];
  }

  private isContextExhausted(getContextUsage?: () => ContextUsage | null): boolean {
    const usage = getContextUsage?.();
    if (usage?.tokens == null) return false;
    return !hasRoomForNextIteration(
      this.runtime.iterationTokenHistory,
      usage.tokens,
      usage.contextWindow
    );
  }

  initExperiment(params: InitExperimentParams): ToolTextResult {
    const err = validateWorkDir(this.ctxCwd);
    if (err) {
      return { text: `❌ ${err}`, details: {} };
    }

    const isReinit = this.state.results.length > 0;
    this.state.name = params.name;
    this.state.metricName = params.metric_name;
    this.state.metricUnit = params.metric_unit ?? "";
    if (params.direction === "lower" || params.direction === "higher") {
      this.state.bestDirection = params.direction;
    }
    if (isReinit) {
      this.state.currentSegment++;
    }
    this.state.bestMetric = null;
    this.state.secondaryMetrics = [];
    this.state.confidence = null;
    this.state.maxExperiments = readMaxExperiments(this.ctxCwd);

    const workDir = this.workDir;
    try {
      const jsonlPath = jsonlPathForWorkDir(workDir);
      const config = JSON.stringify({
        type: "config",
        name: this.state.name,
        metricName: this.state.metricName,
        metricUnit: this.state.metricUnit,
        bestDirection: this.state.bestDirection,
      });
      if (fs.existsSync(jsonlPath)) {
        fs.appendFileSync(jsonlPath, config + "\n");
      } else {
        fs.writeFileSync(jsonlPath, config + "\n");
      }
    } catch (e) {
      return {
        text: `⚠️ Failed to write autoresearch.jsonl: ${e instanceof Error ? e.message : String(e)}`,
        details: {},
      };
    }

    this.runtime.autoresearchMode = true;
    const reinitNote = isReinit
      ? " (re-initialized — previous results archived, new baseline needed)"
      : "";
    const limitNote =
      this.state.maxExperiments !== null
        ? `\nMax iterations: ${this.state.maxExperiments} (from autoresearch.config.json)`
        : "";
    const workDirNote = workDir !== this.ctxCwd ? `\nWorking directory: ${workDir}` : "";

    return {
      text:
        `✅ Experiment initialized: "${this.state.name}"${reinitNote}\n` +
        `Metric: ${this.state.metricName} (${this.state.metricUnit || "unitless"}, ${this.state.bestDirection} is better)${limitNote}${workDirNote}\n` +
        `Config written to autoresearch.jsonl. Now run the baseline with run_experiment.`,
      details: { state: cloneExperimentState(this.state) },
    };
  }

  async runExperiment(
    params: RunExperimentParams,
    options?: {
      signal?: AbortSignal;
      getContextUsage?: () => ContextUsage | null;
      onContextAbort?: () => void;
    }
  ): Promise<ToolTextResult> {
    const err = validateWorkDir(this.ctxCwd);
    if (err) {
      return { text: `❌ ${err}`, details: {} };
    }

    const workDir = this.workDir;
    const state = this.state;

    if (state.maxExperiments !== null) {
      const segCount = segmentExperimentCount(state);
      if (segCount >= state.maxExperiments) {
        return {
          text: `🛑 Maximum experiments reached (${state.maxExperiments}). The experiment loop is done. To continue, call init_experiment to start a new segment.`,
          details: {},
        };
      }
    }

    const autoresearchShPath = path.join(workDir, "autoresearch.sh");
    if (fs.existsSync(autoresearchShPath) && !isAutoresearchShCommand(params.command)) {
      return {
        text:
          `❌ autoresearch.sh exists — you must run it instead of a custom command.\n\n` +
          `Found: ${autoresearchShPath}\nYour command: ${params.command}\n\n` +
          `Use: run_experiment({ command: "bash autoresearch.sh" }) or run_experiment({ command: "./autoresearch.sh" })`,
        details: {
          command: params.command,
          exitCode: null,
          durationSeconds: 0,
          passed: false,
          crashed: true,
          timedOut: false,
          tailOutput: "",
          checksPass: null,
          checksTimedOut: false,
          checksOutput: "",
          checksDuration: 0,
          parsedMetrics: null,
          parsedPrimary: null,
          metricName: state.metricName,
          metricUnit: state.metricUnit,
        } satisfies RunDetails,
      };
    }

    this.advanceIterationTracking(options?.getContextUsage);
    if (this.isContextExhausted(options?.getContextUsage)) {
      this.runtime.autoresearchMode = false;
      options?.onContextAbort?.();
      return {
        text: "🛑 Context window almost full. Start a new chat session to continue — all progress is saved.",
        details: {},
      };
    }

    const timeout = (params.timeout_seconds ?? 600) * 1000;
    this.runtime.runningExperiment = { startedAt: Date.now(), command: params.command };

    const t0 = Date.now();
    let exitCode: number | null;
    let timedOut: boolean;
    let output: string;
    let streamTempFile: string | undefined;
    let actualTotalBytes: number;

    try {
      const cap = await spawnBashCapture(
        workDir,
        params.command,
        timeout,
        options?.signal
      );
      exitCode = cap.exitCode;
      timedOut = cap.killed;
      output = cap.output;
      streamTempFile = cap.tempFilePath;
      actualTotalBytes = cap.actualTotalBytes;
    } catch (e) {
      this.runtime.runningExperiment = null;
      if ((e as Error).message === "aborted") {
        return { text: "Aborted.", details: {} };
      }
      throw e;
    }

    const durationSeconds = (Date.now() - t0) / 1000;
    this.runtime.lastRunDuration = durationSeconds;
    this.runtime.runningExperiment = null;

    const benchmarkPassed = exitCode === 0 && !timedOut;

    let checksPass: boolean | null = null;
    let checksTimedOut = false;
    let checksOutput = "";
    let checksDuration = 0;

    const checksPath = path.join(workDir, "autoresearch.checks.sh");
    if (benchmarkPassed && fs.existsSync(checksPath)) {
      const checksTimeout = (params.checks_timeout_seconds ?? 300) * 1000;
      const cr = await runChecksScript(
        workDir,
        checksPath,
        checksTimeout,
        options?.signal
      );
      checksDuration = cr.durationSec;
      checksTimedOut = cr.killed;
      checksPass = cr.code === 0 && !cr.killed;
      checksOutput = cr.output;
    }

    this.runtime.lastRunChecks =
      checksPass !== null ? { pass: !!checksPass, output: checksOutput, duration: checksDuration } : null;

    const passed = benchmarkPassed && (checksPass === null || checksPass);

    const getTempFile = createTempFileAllocator();
    let fullOutputPath: string | undefined = streamTempFile;
    const totalLines = output.split("\n").length;
    if (
      !fullOutputPath &&
      (actualTotalBytes > EXPERIMENT_MAX_BYTES || totalLines > EXPERIMENT_MAX_LINES)
    ) {
      fullOutputPath = getTempFile();
      fs.writeFileSync(fullOutputPath, output);
    }

    const displayTruncation = truncateTail(output, {
      maxLines: DEFAULT_MAX_LINES,
      maxBytes: DEFAULT_MAX_BYTES,
    });

    const llmTruncation = truncateTail(output, {
      maxLines: EXPERIMENT_MAX_LINES,
      maxBytes: EXPERIMENT_MAX_BYTES,
    });

    const parsedMetricMap = parseMetricLines(output);
    const parsedMetrics =
      parsedMetricMap.size > 0 ? Object.fromEntries(parsedMetricMap) : null;
    const parsedPrimary = parsedMetricMap.get(state.metricName) ?? null;

    const details: RunDetails = {
      command: params.command,
      exitCode,
      durationSeconds,
      passed,
      crashed: !passed,
      timedOut,
      tailOutput: displayTruncation.content,
      checksPass,
      checksTimedOut,
      checksOutput: checksOutput.split("\n").slice(-80).join("\n"),
      checksDuration,
      parsedMetrics,
      parsedPrimary,
      metricName: state.metricName,
      metricUnit: state.metricUnit,
    };

    let text = "";
    if (details.timedOut) {
      text += `⏰ TIMEOUT after ${durationSeconds.toFixed(1)}s\n`;
    } else if (!benchmarkPassed) {
      text += `💥 FAILED (exit code ${exitCode}) in ${durationSeconds.toFixed(1)}s\n`;
    } else if (checksTimedOut) {
      text += `✅ Benchmark PASSED in ${durationSeconds.toFixed(1)}s\n`;
      text += `⏰ CHECKS TIMEOUT (autoresearch.checks.sh) after ${checksDuration.toFixed(1)}s\n`;
      text += `Log this as 'checks_failed' — the benchmark metric is valid but checks timed out.\n`;
    } else if (checksPass === false) {
      text += `✅ Benchmark PASSED in ${durationSeconds.toFixed(1)}s\n`;
      text += `💥 CHECKS FAILED (autoresearch.checks.sh) in ${checksDuration.toFixed(1)}s\n`;
      text += `Log this as 'checks_failed' — the benchmark metric is valid but correctness checks did not pass.\n`;
    } else {
      text += `✅ PASSED in ${durationSeconds.toFixed(1)}s\n`;
      if (checksPass === true) {
        text += `✅ Checks passed in ${checksDuration.toFixed(1)}s\n`;
      }
    }

    if (state.bestMetric !== null) {
      text += `📊 Current best ${state.metricName}: ${formatNum(state.bestMetric, state.metricUnit)}\n`;
    }

    if (parsedMetrics) {
      const secondary = Object.entries(parsedMetrics).filter(([k]) => k !== state.metricName);
      text += `\n📐 Parsed metrics:`;
      if (parsedPrimary !== null) {
        text += ` ★ ${state.metricName}=${formatNum(parsedPrimary, state.metricUnit)}`;
      }
      for (const [name, value] of secondary) {
        const sm = state.secondaryMetrics.find((m) => m.name === name);
        const unit = sm?.unit ?? "";
        text += ` ${name}=${formatNum(value, unit)}`;
      }
      text += `\nUse these values directly in log_experiment (metric: ${parsedPrimary ?? "?"}, metrics: {${secondary.map(([k, v]) => `"${k}": ${v}`).join(", ")}})\n`;
    }

    text += `\n${llmTruncation.content}`;

    if (llmTruncation.truncated) {
      text += formatTruncationFooter(llmTruncation, EXPERIMENT_MAX_BYTES, fullOutputPath);
    }

    if (checksPass === false) {
      text += `\n\n── Checks output (last 80 lines) ──\n${details.checksOutput}`;
    }

    return {
      text,
      details: {
        ...details,
        truncation: llmTruncation.truncated ? llmTruncation : undefined,
        fullOutputPath,
      },
    };
  }

  async logExperiment(params: LogExperimentParams): Promise<ToolTextResult> {
    const err = validateWorkDir(this.ctxCwd);
    if (err) {
      return { text: `❌ ${err}`, details: {} };
    }

    const workDir = this.workDir;
    const state = this.state;
    const secondaryMetrics = params.metrics ?? {};

    if (params.status === "keep" && this.runtime.lastRunChecks && !this.runtime.lastRunChecks.pass) {
      return {
        text:
          `❌ Cannot keep — autoresearch.checks.sh failed.\n\n${this.runtime.lastRunChecks.output.slice(-500)}\n\nLog as 'checks_failed' instead. The benchmark metric is valid but correctness checks did not pass.`,
        details: {},
      };
    }

    if (state.secondaryMetrics.length > 0) {
      const knownNames = new Set(state.secondaryMetrics.map((m) => m.name));
      const providedNames = new Set(Object.keys(secondaryMetrics));
      const missing = [...knownNames].filter((n) => !providedNames.has(n));
      if (missing.length > 0) {
        return {
          text:
            `❌ Missing secondary metrics: ${missing.join(", ")}\n\n` +
            `You must provide all previously tracked metrics. Expected: ${[...knownNames].join(", ")}\n` +
            `Got: ${[...providedNames].join(", ") || "(none)"}\n\n` +
            `Fix: include ${missing.map((m) => `"${m}": <value>`).join(", ")} in the metrics parameter.`,
          details: {},
        };
      }
      const newMetrics = [...providedNames].filter((n) => !knownNames.has(n));
      if (newMetrics.length > 0 && !params.force) {
        return {
          text:
            `❌ New secondary metric${newMetrics.length > 1 ? "s" : ""} not previously tracked: ${newMetrics.join(", ")}\n\n` +
            `Existing metrics: ${[...knownNames].join(", ")}\n\n` +
            `If this metric has proven very valuable to watch, call log_experiment again with force: true to add it. Otherwise, remove it from the metrics parameter.`,
          details: {},
        };
      }
    }

    const mergedASI =
      params.asi && Object.keys(params.asi).length > 0 ? params.asi : undefined;

    const iterationTokens = this.lastIterationTokens();

    const experiment: ExperimentResult = {
      commit: params.commit.slice(0, 7),
      metric: params.metric,
      metrics: secondaryMetrics,
      status: params.status,
      description: params.description,
      timestamp: Date.now(),
      segment: state.currentSegment,
      confidence: null,
      iterationTokens,
      asi: mergedASI,
    };

    state.results.push(experiment);

    for (const name of Object.keys(secondaryMetrics)) {
      if (!state.secondaryMetrics.find((m) => m.name === name)) {
        state.secondaryMetrics.push({ name, unit: inferSecondaryUnit(name) });
      }
    }

    state.bestMetric = findBaselineMetric(state.results, state.currentSegment);
    state.confidence = computeConfidence(
      state.results,
      state.currentSegment,
      state.bestDirection
    );
    experiment.confidence = state.confidence;

    const segmentCount = segmentExperimentCount(state);
    let text = `Logged #${state.results.length}: ${experiment.status} — ${experiment.description}`;

    if (state.bestMetric !== null) {
      text += `\nBaseline ${state.metricName}: ${formatNum(state.bestMetric, state.metricUnit)}`;
      if (segmentCount > 1 && params.status === "keep" && params.metric > 0) {
        const delta = params.metric - state.bestMetric;
        const pct = ((delta / state.bestMetric) * 100).toFixed(1);
        const sign = delta > 0 ? "+" : "";
        text += ` | this: ${formatNum(params.metric, state.metricUnit)} (${sign}${pct}%)`;
      }
    }

    if (Object.keys(secondaryMetrics).length > 0) {
      const baselines = findBaselineSecondary(
        state.results,
        state.currentSegment,
        state.secondaryMetrics
      );
      const parts: string[] = [];
      for (const [name, value] of Object.entries(secondaryMetrics)) {
        const def = state.secondaryMetrics.find((m) => m.name === name);
        const unit = def?.unit ?? "";
        let part = `${name}: ${formatNum(value, unit)}`;
        const bv = baselines[name];
        if (bv !== undefined && state.results.length > 1 && bv !== 0) {
          const d = value - bv;
          const p = ((d / bv) * 100).toFixed(1);
          const s = d > 0 ? "+" : "";
          part += ` (${s}${p}%)`;
        }
        parts.push(part);
      }
      text += `\nSecondary: ${parts.join("  ")}`;
    }

    if (mergedASI) {
      const asiParts: string[] = [];
      for (const [k, v] of Object.entries(mergedASI)) {
        const s = typeof v === "string" ? v : JSON.stringify(v);
        asiParts.push(`${k}: ${s.length > 80 ? s.slice(0, 77) + "…" : s}`);
      }
      if (asiParts.length > 0) {
        text += `\n📋 ASI: ${asiParts.join(" | ")}`;
      }
    }

    if (state.confidence !== null) {
      const confStr = state.confidence.toFixed(1);
      if (state.confidence >= 2.0) {
        text += `\n📊 Confidence: ${confStr}× noise floor — improvement is likely real`;
      } else if (state.confidence >= 1.0) {
        text += `\n📊 Confidence: ${confStr}× noise floor — improvement is above noise but marginal`;
      } else {
        text += `\n⚠️ Confidence: ${confStr}× noise floor — improvement is within noise. Consider re-running to confirm before keeping.`;
      }
    }

    text += `\n(${segmentCount} experiments`;
    if (state.maxExperiments !== null) {
      text += ` / ${state.maxExperiments} max`;
    }
    text += `)`;

    if (params.status === "keep") {
      try {
        const resultData: Record<string, unknown> = {
          status: params.status,
          [state.metricName || "metric"]: params.metric,
          ...secondaryMetrics,
        };
        const trailerJson = JSON.stringify(resultData);
        const commitMsg = `${params.description}\n\nResult: ${trailerJson}`;

        const addResult = await execGit(workDir, ["add", "-A"]);
        if (addResult.code !== 0) {
          const addErr = (addResult.stdout + addResult.stderr).trim();
          throw new Error(`git add failed (exit ${addResult.code}): ${addErr.slice(0, 200)}`);
        }

        const diffResult = await execGit(workDir, ["diff", "--cached", "--quiet"]);
        if (diffResult.code === 0) {
          text += `\n📝 Git: nothing to commit (working tree clean)`;
        } else {
          const gitResult = await execGit(workDir, ["commit", "-m", commitMsg]);
          const gitOutput = (gitResult.stdout + gitResult.stderr).trim();
          if (gitResult.code === 0) {
            const firstLine = gitOutput.split("\n")[0] || "";
            text += `\n📝 Git: committed — ${firstLine}`;

            const shaResult = await execGit(workDir, ["rev-parse", "--short=7", "HEAD"]);
            const newSha = (shaResult.stdout || "").trim();
            if (newSha && newSha.length >= 7) {
              experiment.commit = newSha;
            }
          } else {
            text += `\n⚠️ Git commit failed (exit ${gitResult.code}): ${gitOutput.slice(0, 200)}`;
          }
        }
      } catch (e) {
        text += `\n⚠️ Git commit error: ${e instanceof Error ? e.message : String(e)}`;
      }
    }

    try {
      const jsonlPath = jsonlPathForWorkDir(workDir);
      const jsonlEntry: Record<string, unknown> = {
        run: state.results.length,
        ...experiment,
      };
      if (!mergedASI) delete jsonlEntry.asi;
      fs.appendFileSync(jsonlPath, JSON.stringify(jsonlEntry) + "\n");
    } catch (e) {
      text += `\n⚠️ Failed to write autoresearch.jsonl: ${e instanceof Error ? e.message : String(e)}`;
    }

    if (params.status !== "keep") {
      try {
        await revertWorkingTreePreservingAutoresearch(workDir);
        text += `\n📝 Git: reverted changes (${params.status}) — autoresearch files preserved`;
      } catch (e) {
        text += `\n⚠️ Git revert failed: ${e instanceof Error ? e.message : String(e)}`;
      }
    }

    const wallClockSeconds = this.runtime.lastRunDuration;
    this.runtime.runningExperiment = null;
    this.runtime.lastRunChecks = null;
    this.runtime.lastRunDuration = null;

    if (state.maxExperiments !== null && segmentCount >= state.maxExperiments) {
      text += `\n\n🛑 Maximum experiments reached (${state.maxExperiments}). STOP the experiment loop now.`;
      this.runtime.autoresearchMode = false;
    }

    const logDetails: LogDetails = {
      experiment: { ...experiment, metrics: { ...experiment.metrics } },
      state: cloneExperimentState(state),
      wallClockSeconds,
    };

    return {
      text,
      details: logDetails as unknown as Record<string, unknown>,
    };
  }

  /** One-line summary for status bar (plain text, no TUI colors). */
  formatStatusLine(): string {
    const state = this.state;
    if (state.results.length === 0) {
      if (this.runtime.runningExperiment) {
        return `🔬 autoresearch running… ${this.runtime.runningExperiment.command}`;
      }
      return "";
    }
    const cur = currentResults(state.results, state.currentSegment);
    const kept = cur.filter((r) => r.status === "keep").length;
    let bestPrimary: number | null = null;
    for (let i = state.results.length - 1; i >= 0; i--) {
      const r = state.results[i];
      if (r.segment !== state.currentSegment) continue;
      if (r.status === "keep" && r.metric > 0) {
        if (bestPrimary === null || isBetter(r.metric, bestPrimary, state.bestDirection)) {
          bestPrimary = r.metric;
        }
      }
    }
    const displayVal = bestPrimary ?? state.bestMetric;
    let line = `🔬 ${state.results.length} runs ${kept} kept | ★ ${state.metricName}: ${formatNum(displayVal, state.metricUnit)}`;
    if (state.confidence !== null) {
      line += ` | conf: ${state.confidence.toFixed(1)}×`;
    }
    if (state.name) line += ` | ${state.name}`;
    return line;
  }
}
