/**
 * Shared types for autoresearch experiment state (pi-autoresearch compatible).
 */

export type ExperimentStatus = "keep" | "discard" | "crash" | "checks_failed";

/** Free-form diagnostics per experiment run (ASI). */
export type ASI = Record<string, unknown>;

export interface ExperimentResult {
  commit: string;
  metric: number;
  metrics: Record<string, number>;
  status: ExperimentStatus;
  description: string;
  timestamp: number;
  segment: number;
  confidence: number | null;
  iterationTokens: number | null;
  asi?: ASI;
}

export interface MetricDef {
  name: string;
  unit: string;
}

export interface ExperimentState {
  results: ExperimentResult[];
  bestMetric: number | null;
  bestDirection: "lower" | "higher";
  metricName: string;
  metricUnit: string;
  secondaryMetrics: MetricDef[];
  name: string | null;
  currentSegment: number;
  maxExperiments: number | null;
  confidence: number | null;
}

export interface RunDetails {
  command: string;
  exitCode: number | null;
  durationSeconds: number;
  passed: boolean;
  crashed: boolean;
  timedOut: boolean;
  tailOutput: string;
  checksPass: boolean | null;
  checksTimedOut: boolean;
  checksOutput: string;
  checksDuration: number;
  parsedMetrics: Record<string, number> | null;
  parsedPrimary: number | null;
  metricName: string;
  metricUnit: string;
}

export interface LogDetails {
  experiment: ExperimentResult;
  state: ExperimentState;
  wallClockSeconds: number | null;
}

export interface AutoresearchRuntime {
  autoresearchMode: boolean;
  dashboardExpanded: boolean;
  lastRunChecks: { pass: boolean; output: string; duration: number } | null;
  lastRunDuration: number | null;
  runningExperiment: { startedAt: number; command: string } | null;
  iterationStartTokens: number | null;
  iterationTokenHistory: number[];
}

export interface AutoresearchConfig {
  maxIterations?: number;
  workingDir?: string;
}

export interface ContextUsage {
  tokens: number;
  contextWindow: number;
}

export interface ToolTextResult {
  text: string;
  details: Record<string, unknown>;
}
