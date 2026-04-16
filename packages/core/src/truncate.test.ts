import { describe, expect, it } from "vitest";
import { formatTruncationFooter, truncateTail } from "./truncate.js";

describe("truncateTail", () => {
  it("returns full text when under limits", () => {
    const r = truncateTail("a\nb\nc", { maxLines: 10, maxBytes: 1000 });
    expect(r.truncated).toBe(false);
    expect(r.content).toBe("a\nb\nc");
    expect(r.totalLines).toBe(3);
  });

  it("truncates by lines", () => {
    const lines = Array.from({ length: 20 }, (_, i) => `line${i}`).join("\n");
    const r = truncateTail(lines, { maxLines: 5, maxBytes: 100_000 });
    expect(r.truncated).toBe(true);
    expect(r.truncatedBy).toBe("lines");
    expect(r.content.startsWith("line15")).toBe(true);
  });

  it("truncates by bytes when content exceeds maxBytes", () => {
    const long = "x".repeat(5000);
    const r = truncateTail(long, { maxLines: 10_000, maxBytes: 100 });
    expect(r.truncated).toBe(true);
    expect(r.truncatedBy).toBe("bytes");
    expect(Buffer.from(r.content, "utf8").length).toBeLessThanOrEqual(100);
  });
});

describe("formatTruncationFooter", () => {
  it("returns empty when not truncated", () => {
    const r = truncateTail("hi", { maxLines: 10, maxBytes: 100 });
    expect(formatTruncationFooter(r, 100)).toBe("");
  });

  it("includes path when provided", () => {
    const r = truncateTail("x".repeat(5000), { maxLines: 10_000, maxBytes: 50 });
    const footer = formatTruncationFooter(r, 50, "/tmp/out.log");
    expect(footer).toContain("Full output: /tmp/out.log");
  });
});
