import type { ExperimentState } from "./types.js";
import { currentResults } from "./metrics.js";

export function createExperimentState(): ExperimentState {
  return {
    results: [],
    bestMetric: null,
    bestDirection: "lower",
    metricName: "metric",
    metricUnit: "",
    secondaryMetrics: [],
    name: null,
    currentSegment: 0,
    maxExperiments: null,
    confidence: null,
  };
}

export function cloneExperimentState(state: ExperimentState): ExperimentState {
  return {
    ...state,
    results: state.results.map((result) => ({
      ...result,
      metrics: { ...result.metrics },
    })),
    secondaryMetrics: state.secondaryMetrics.map((m) => ({ ...m })),
  };
}

export function segmentExperimentCount(state: ExperimentState): number {
  return currentResults(state.results, state.currentSegment).length;
}
