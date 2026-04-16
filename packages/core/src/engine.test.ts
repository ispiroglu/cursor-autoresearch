import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { AutoresearchEngine } from "./engine.js";

let tmp: string | undefined;

function mkTmp(): string {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "autoresearch-engine-"));
  return tmp;
}

afterEach(() => {
  if (tmp && fs.existsSync(tmp)) {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  tmp = undefined;
});

describe("AutoresearchEngine", () => {
  it("initExperiment writes config and sets state", () => {
    const cwd = mkTmp();
    const engine = new AutoresearchEngine(cwd);
    const r = engine.initExperiment({
      name: "test",
      metric_name: "total_µs",
      metric_unit: "µs",
      direction: "lower",
    });
    expect(r.text).toContain("Experiment initialized");
    expect(engine.state.name).toBe("test");
    expect(engine.state.metricName).toBe("total_µs");
    const jsonl = path.join(cwd, "autoresearch.jsonl");
    expect(fs.existsSync(jsonl)).toBe(true);
    const first = fs.readFileSync(jsonl, "utf-8").trim().split("\n")[0];
    expect(JSON.parse(first).type).toBe("config");
  });

  it("formatStatusLine is empty with no results and no run", () => {
    const cwd = mkTmp();
    const engine = new AutoresearchEngine(cwd);
    expect(engine.formatStatusLine()).toBe("");
  });

  it("reloadFromDisk picks up autoresearch.jsonl", () => {
    const cwd = mkTmp();
    const jsonl = path.join(cwd, "autoresearch.jsonl");
    fs.writeFileSync(
      jsonl,
      JSON.stringify({
        type: "config",
        name: "n",
        metricName: "m",
        bestDirection: "lower",
      }) + "\n",
      "utf-8"
    );
    const engine = new AutoresearchEngine(cwd);
    engine.reloadFromDisk();
    expect(engine.runtime.autoresearchMode).toBe(true);
  });
});
