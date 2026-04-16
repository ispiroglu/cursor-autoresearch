import { describe, expect, it } from "vitest";
import {
  parseMetricLines,
  computeConfidence,
  sortedMedian,
  isBetter,
  currentResults,
  findBaselineMetric,
  findBaselineSecondary,
  inferSecondaryUnit,
} from "./metrics.js";
import type { ExperimentResult } from "./types.js";

describe("parseMetricLines", () => {
  it("parses METRIC lines", () => {
    const out = `
hello
METRIC total_µs=15200
METRIC foo=3.5
`;
    const m = parseMetricLines(out);
    expect(m.get("total_µs")).toBe(15200);
    expect(m.get("foo")).toBe(3.5);
  });

  it("ignores denied keys", () => {
    const m = parseMetricLines("METRIC __proto__=1\nMETRIC ok=2");
    expect(m.has("__proto__")).toBe(false);
    expect(m.get("ok")).toBe(2);
  });
});

describe("computeConfidence", () => {
  it("returns null for fewer than 3 runs", () => {
    const results: ExperimentResult[] = [mk(10, "keep"), mk(9, "keep")];
    expect(computeConfidence(results, 0, "lower")).toBeNull();
  });

  it("returns a ratio when enough data", () => {
    const results: ExperimentResult[] = [
      mk(100, "keep"),
      mk(95, "keep"),
      mk(80, "keep"),
    ];
    const c = computeConfidence(results, 0, "lower");
    expect(c).not.toBeNull();
    expect(c! > 0).toBe(true);
  });
});

describe("sortedMedian", () => {
  it("returns 0 for empty input", () => {
    expect(sortedMedian([])).toBe(0);
  });

  it("returns median for odd length", () => {
    expect(sortedMedian([3, 1, 2])).toBe(2);
  });

  it("returns average of middle pair for even length", () => {
    expect(sortedMedian([10, 20, 30, 40])).toBe(25);
  });
});

describe("isBetter", () => {
  it("compares lower", () => {
    expect(isBetter(5, 10, "lower")).toBe(true);
    expect(isBetter(10, 5, "lower")).toBe(false);
  });

  it("compares higher", () => {
    expect(isBetter(10, 5, "higher")).toBe(true);
  });
});

describe("currentResults", () => {
  it("filters by segment", () => {
    const a = mk(1, "keep", 0);
    const b = mk(2, "keep", 1);
    expect(currentResults([a, b], 1)).toEqual([b]);
  });
});

describe("findBaselineMetric", () => {
  it("returns first metric in segment", () => {
    const a = mk(42, "keep", 0);
    const b = mk(99, "keep", 0);
    expect(findBaselineMetric([a, b], 0)).toBe(42);
  });
});

describe("findBaselineSecondary", () => {
  it("collects metrics from first row", () => {
    const r: ExperimentResult = {
      ...mk(1, "keep", 0),
      metrics: { x: 7, y: 8 },
    };
    expect(findBaselineSecondary([r], 0, [{ name: "x", unit: "" }])).toEqual({ x: 7, y: 8 });
  });
});

describe("inferSecondaryUnit", () => {
  it("infers from suffix", () => {
    expect(inferSecondaryUnit("total_µs")).toBe("µs");
    expect(inferSecondaryUnit("lat_ms")).toBe("ms");
    expect(inferSecondaryUnit("foo")).toBe("");
  });
});

function mk(
  metric: number,
  status: ExperimentResult["status"],
  seg: number = 0
): ExperimentResult {
  return {
    commit: "abc1234",
    metric,
    metrics: {},
    status,
    description: "x",
    timestamp: 0,
    segment: seg,
    confidence: null,
    iterationTokens: null,
  };
}
