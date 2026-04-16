import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { jsonlPathForWorkDir, loadStateFromJsonl } from "./jsonl.js";

let tmp: string | undefined;

function mkTmp(): string {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "autoresearch-jsonl-"));
  return tmp;
}

afterEach(() => {
  if (tmp && fs.existsSync(tmp)) {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  tmp = undefined;
});

describe("jsonlPathForWorkDir", () => {
  it("joins autoresearch.jsonl", () => {
    expect(jsonlPathForWorkDir("/a/b")).toBe(path.join("/a/b", "autoresearch.jsonl"));
  });
});

describe("loadStateFromJsonl", () => {
  it("returns existing state when file missing", () => {
    const cwd = mkTmp();
    const s = loadStateFromJsonl(cwd);
    expect(s.results).toEqual([]);
  });

  it("parses config and result lines", () => {
    const cwd = mkTmp();
    const jsonl = path.join(cwd, "autoresearch.jsonl");
    const lines = [
      JSON.stringify({
        type: "config",
        name: "bench",
        metricName: "total_µs",
        metricUnit: "µs",
        bestDirection: "lower",
      }),
      JSON.stringify({
        commit: "deadbeef",
        metric: 100,
        metrics: { extra: 1 },
        status: "keep",
        description: "first",
        timestamp: 1,
        confidence: null,
        iterationTokens: null,
      }),
    ];
    fs.writeFileSync(jsonl, lines.join("\n") + "\n", "utf-8");

    const s = loadStateFromJsonl(cwd);
    expect(s.name).toBe("bench");
    expect(s.metricName).toBe("total_µs");
    expect(s.results).toHaveLength(1);
    expect(s.results[0].commit).toBe("deadbeef");
    expect(s.results[0].metrics.extra).toBe(1);
    expect(s.secondaryMetrics.some((m) => m.name === "extra")).toBe(true);
  });

  it("increments segment on new config after results", () => {
    const cwd = mkTmp();
    const jsonl = path.join(cwd, "autoresearch.jsonl");
    fs.writeFileSync(
      jsonl,
      [
        JSON.stringify({
          type: "config",
          name: "a",
          metricName: "m",
          bestDirection: "lower",
        }),
        JSON.stringify({
          commit: "a",
          metric: 1,
          metrics: {},
          status: "keep",
          description: "",
          timestamp: 0,
          confidence: null,
          iterationTokens: null,
        }),
        JSON.stringify({
          type: "config",
          name: "b",
          metricName: "m",
          bestDirection: "lower",
        }),
        JSON.stringify({
          commit: "b",
          metric: 2,
          metrics: {},
          status: "keep",
          description: "",
          timestamp: 0,
          confidence: null,
          iterationTokens: null,
        }),
      ].join("\n") + "\n",
      "utf-8"
    );

    const s = loadStateFromJsonl(cwd);
    expect(s.currentSegment).toBe(1);
    expect(s.results.filter((r) => r.segment === 1)).toHaveLength(1);
  });
});
