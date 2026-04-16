import { describe, expect, it } from "vitest";
import type { ExperimentResult } from "@ergenekonyigit/cursor-autoresearch-core";
import { buildResultsPanelHtml, escapeHtml } from "./results-html.js";

describe("escapeHtml", () => {
  it("escapes HTML special characters", () => {
    expect(escapeHtml(`a&b<c>"`)).toBe("a&amp;b&lt;c&gt;&quot;");
  });
});

describe("buildResultsPanelHtml", () => {
  it("renders table rows", () => {
    const results: ExperimentResult[] = [
      {
        commit: "abc",
        metric: 1,
        metrics: {},
        status: "keep",
        description: "d & e",
        timestamp: 0,
        segment: 0,
        confidence: null,
        iterationTokens: null,
      },
    ];
    const html = buildResultsPanelHtml(results);
    expect(html).toContain("abc");
    expect(html).toContain("d &amp; e");
    expect(html).toContain("<th>Metric</th>");
  });

  it("renders empty tbody when there are no results", () => {
    const html = buildResultsPanelHtml([]);
    expect(html).toContain("<tbody></tbody>");
    expect(html).toContain("Autoresearch results");
  });

  it("renders multiple rows in order", () => {
    const mk = (commit: string, metric: number): ExperimentResult => ({
      commit,
      metric,
      metrics: {},
      status: "keep",
      description: "x",
      timestamp: 0,
      segment: 0,
      confidence: null,
      iterationTokens: null,
    });
    const html = buildResultsPanelHtml([mk("aaa", 10), mk("bbb", 20)]);
    expect(html.indexOf("aaa")).toBeLessThan(html.indexOf("bbb"));
    expect(html).toContain(">10<");
    expect(html).toContain(">20<");
  });
});
