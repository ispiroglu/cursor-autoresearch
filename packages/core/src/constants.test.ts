import { describe, expect, it } from "vitest";
import {
  DEFAULT_MAX_BYTES,
  DEFAULT_MAX_LINES,
  EXPERIMENT_MAX_BYTES,
  EXPERIMENT_MAX_LINES,
  METRIC_LINE_PREFIX,
} from "./constants.js";

describe("constants", () => {
  it("exports expected metric prefix and limits", () => {
    expect(METRIC_LINE_PREFIX).toBe("METRIC");
    expect(EXPERIMENT_MAX_LINES).toBe(10);
    expect(EXPERIMENT_MAX_BYTES).toBe(4 * 1024);
    expect(DEFAULT_MAX_LINES).toBe(500);
    expect(DEFAULT_MAX_BYTES).toBe(256 * 1024);
  });
});
