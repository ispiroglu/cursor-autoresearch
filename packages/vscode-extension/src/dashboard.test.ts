import { describe, expect, it } from "vitest";
import { extractSessionName, getDashboardMimeType } from "./dashboard.js";

describe("getDashboardMimeType", () => {
  it("maps known extensions", () => {
    expect(getDashboardMimeType("index.html")).toBe("text/html; charset=utf-8");
    expect(getDashboardMimeType("x.jsonl")).toBe("text/plain; charset=utf-8");
    expect(getDashboardMimeType("app.js")).toBe("text/javascript; charset=utf-8");
  });

  it("falls back to octet-stream", () => {
    expect(getDashboardMimeType("unknown.bin")).toBe("application/octet-stream");
  });
});

describe("extractSessionName", () => {
  it("returns default when empty", () => {
    expect(extractSessionName("")).toBe("Autoresearch");
  });

  it("parses name from first JSON line", () => {
    const line = JSON.stringify({ type: "config", name: "My bench" });
    expect(extractSessionName(line)).toBe("My bench");
  });

  it("returns default on invalid JSON", () => {
    expect(extractSessionName("not json")).toBe("Autoresearch");
  });
});
