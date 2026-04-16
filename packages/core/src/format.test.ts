import { describe, expect, it } from "vitest";
import { commas, fmtNum, formatNum, formatSize } from "./format.js";

describe("commas", () => {
  it("adds thousands separators", () => {
    expect(commas(1234)).toBe("1,234");
    expect(commas(1000000)).toBe("1,000,000");
  });
});

describe("fmtNum", () => {
  it("formats integers without decimals", () => {
    expect(fmtNum(42)).toBe("42");
  });

  it("formats fractional part when decimals > 0", () => {
    expect(fmtNum(3.14159, 2)).toBe("3.14");
  });
});

describe("formatNum", () => {
  it("renders em dash for null", () => {
    expect(formatNum(null, "µs")).toBe("—");
  });

  it("appends unit for integers", () => {
    expect(formatNum(100, "µs")).toBe("100µs");
  });
});

describe("formatSize", () => {
  it("formats bytes", () => {
    expect(formatSize(512)).toBe("512B");
  });

  it("formats kilobytes", () => {
    expect(formatSize(2048)).toBe("2KB");
  });

  it("formats megabytes", () => {
    expect(formatSize(2 * 1024 * 1024)).toBe("2.0MB");
  });
});
