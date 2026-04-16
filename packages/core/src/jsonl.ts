import * as fs from "node:fs";
import * as path from "node:path";
import type { ExperimentResult, ExperimentState } from "./types.js";
import {
  computeConfidence,
  findBaselineMetric,
  inferSecondaryUnit,
} from "./metrics.js";
import { createExperimentState } from "./state.js";

/**
 * Load experiment state from `autoresearch.jsonl` (pi-autoresearch format).
 */
export function loadStateFromJsonl(
  workDir: string,
  existing?: ExperimentState,
): ExperimentState {
  const state = existing ?? createExperimentState();
  const jsonlPath = path.join(workDir, "autoresearch.jsonl");
  if (!fs.existsSync(jsonlPath)) {
    return state;
  }

  try {
    const raw = fs.readFileSync(jsonlPath, "utf-8").trim();
    if (!raw) return state;

    const lines = raw.split("\n").filter(Boolean);
    let segment = 0;
    state.results = [];

    for (const line of lines) {
      try {
        const entry = JSON.parse(line) as Record<string, unknown>;

        if (entry.type === "config") {
          if (typeof entry.name === "string") state.name = entry.name;
          if (typeof entry.metricName === "string")
            state.metricName = entry.metricName;
          if (typeof entry.metricUnit === "string") {
            state.metricUnit = entry.metricUnit;
          } else if (
            typeof entry.metricUnit === "number" ||
            typeof entry.metricUnit === "boolean"
          ) {
            state.metricUnit = String(entry.metricUnit);
          }
          if (
            entry.bestDirection === "lower" ||
            entry.bestDirection === "higher"
          ) {
            state.bestDirection = entry.bestDirection;
          }
          if (state.results.length > 0) {
            segment++;
            state.secondaryMetrics = [];
          }
          state.currentSegment = segment;
          continue;
        }

        const iterationTokens =
          typeof entry.iterationTokens === "number"
            ? entry.iterationTokens
            : null;

        const result: ExperimentResult = {
          commit: typeof entry.commit === "string" ? entry.commit : "",
          metric: typeof entry.metric === "number" ? entry.metric : 0,
          metrics:
            entry.metrics &&
            typeof entry.metrics === "object" &&
            entry.metrics !== null
              ? (entry.metrics as Record<string, number>)
              : {},
          status:
            entry.status === "keep" ||
            entry.status === "discard" ||
            entry.status === "crash" ||
            entry.status === "checks_failed"
              ? entry.status
              : "keep",
          description:
            typeof entry.description === "string" ? entry.description : "",
          timestamp: typeof entry.timestamp === "number" ? entry.timestamp : 0,
          segment,
          confidence:
            typeof entry.confidence === "number"
              ? entry.confidence
              : entry.confidence === null
                ? null
                : null,
          iterationTokens,
          asi:
            entry.asi && typeof entry.asi === "object"
              ? (entry.asi as ExperimentResult["asi"])
              : undefined,
        };

        state.results.push(result);

        for (const name of Object.keys(result.metrics)) {
          if (!state.secondaryMetrics.find((m) => m.name === name)) {
            state.secondaryMetrics.push({
              name,
              unit: inferSecondaryUnit(name),
            });
          }
        }
      } catch {
        // skip malformed lines
      }
    }

    state.bestMetric = findBaselineMetric(state.results, state.currentSegment);
    state.confidence = computeConfidence(
      state.results,
      state.currentSegment,
      state.bestDirection,
    );
  } catch {
    /* keep state */
  }

  return state;
}

export function jsonlPathForWorkDir(workDir: string): string {
  return path.join(workDir, "autoresearch.jsonl");
}
