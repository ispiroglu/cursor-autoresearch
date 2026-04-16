import { describe, expect, it } from "vitest";
import {
  cloneExperimentState,
  createExperimentState,
  segmentExperimentCount,
} from "./state.js";

describe("createExperimentState", () => {
  it("returns default state", () => {
    const s = createExperimentState();
    expect(s.results).toEqual([]);
    expect(s.bestDirection).toBe("lower");
    expect(s.metricName).toBe("metric");
    expect(s.currentSegment).toBe(0);
  });
});

describe("cloneExperimentState", () => {
  it("deep-clones results and secondary metrics", () => {
    const s = createExperimentState();
    s.results.push({
      commit: "abc",
      metric: 1,
      metrics: { a: 2 },
      status: "keep",
      description: "d",
      timestamp: 0,
      segment: 0,
      confidence: null,
      iterationTokens: null,
    });
    s.secondaryMetrics.push({ name: "a", unit: "" });

    const c = cloneExperimentState(s);
    c.results[0].metrics.a = 99;
    expect(s.results[0].metrics.a).toBe(2);
  });
});

describe("segmentExperimentCount", () => {
  it("counts results in current segment", () => {
    const s = createExperimentState();
    s.currentSegment = 1;
    s.results.push({
      commit: "a",
      metric: 1,
      metrics: {},
      status: "keep",
      description: "",
      timestamp: 0,
      segment: 1,
      confidence: null,
      iterationTokens: null,
    });
    s.results.push({
      commit: "b",
      metric: 2,
      metrics: {},
      status: "keep",
      description: "",
      timestamp: 0,
      segment: 0,
      confidence: null,
      iterationTokens: null,
    });
    expect(segmentExperimentCount(s)).toBe(1);
  });
});
