import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readConfig, readMaxExperiments, resolveWorkDir, validateWorkDir } from "./config.js";

let tmp: string | undefined;

function mkTmp(): string {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "autoresearch-config-"));
  return tmp;
}

afterEach(() => {
  if (tmp && fs.existsSync(tmp)) {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  tmp = undefined;
});

describe("readConfig", () => {
  it("returns empty object when file missing", () => {
    const cwd = mkTmp();
    expect(readConfig(cwd)).toEqual({});
  });

  it("reads valid JSON", () => {
    const cwd = mkTmp();
    fs.writeFileSync(
      path.join(cwd, "autoresearch.config.json"),
      JSON.stringify({ maxIterations: 5, workingDir: "sub" }),
      "utf-8"
    );
    expect(readConfig(cwd)).toEqual({ maxIterations: 5, workingDir: "sub" });
  });

  it("returns empty object on invalid JSON", () => {
    const cwd = mkTmp();
    fs.writeFileSync(path.join(cwd, "autoresearch.config.json"), "{", "utf-8");
    expect(readConfig(cwd)).toEqual({});
  });
});

describe("readMaxExperiments", () => {
  it("returns null when unset or invalid", () => {
    const cwd = mkTmp();
    expect(readMaxExperiments(cwd)).toBeNull();
    fs.writeFileSync(
      path.join(cwd, "autoresearch.config.json"),
      JSON.stringify({ maxIterations: 0 }),
      "utf-8"
    );
    expect(readMaxExperiments(cwd)).toBeNull();
  });

  it("returns floored positive integer", () => {
    const cwd = mkTmp();
    fs.writeFileSync(
      path.join(cwd, "autoresearch.config.json"),
      JSON.stringify({ maxIterations: 7.9 }),
      "utf-8"
    );
    expect(readMaxExperiments(cwd)).toBe(7);
  });
});

describe("resolveWorkDir", () => {
  it("returns ctxCwd when workingDir omitted", () => {
    const cwd = mkTmp();
    expect(resolveWorkDir(cwd)).toBe(cwd);
  });

  it("resolves relative workingDir", () => {
    const cwd = mkTmp();
    fs.mkdirSync(path.join(cwd, "nested"));
    fs.writeFileSync(
      path.join(cwd, "autoresearch.config.json"),
      JSON.stringify({ workingDir: "nested" }),
      "utf-8"
    );
    expect(resolveWorkDir(cwd)).toBe(path.join(cwd, "nested"));
  });

  it("uses absolute workingDir", () => {
    const cwd = mkTmp();
    const abs = path.join(cwd, "abs");
    fs.mkdirSync(abs);
    fs.writeFileSync(
      path.join(cwd, "autoresearch.config.json"),
      JSON.stringify({ workingDir: abs }),
      "utf-8"
    );
    expect(resolveWorkDir(cwd)).toBe(abs);
  });
});

describe("validateWorkDir", () => {
  it("returns null when workDir equals ctx", () => {
    const cwd = mkTmp();
    expect(validateWorkDir(cwd)).toBeNull();
  });

  it("returns error when workingDir missing", () => {
    const cwd = mkTmp();
    fs.writeFileSync(
      path.join(cwd, "autoresearch.config.json"),
      JSON.stringify({ workingDir: "nope" }),
      "utf-8"
    );
    expect(validateWorkDir(cwd)).toMatch(/does not exist/);
  });

  it("returns error when path is not a directory", () => {
    const cwd = mkTmp();
    const f = path.join(cwd, "file");
    fs.writeFileSync(f, "x");
    fs.writeFileSync(
      path.join(cwd, "autoresearch.config.json"),
      JSON.stringify({ workingDir: "file" }),
      "utf-8"
    );
    expect(validateWorkDir(cwd)).toMatch(/not a directory/);
  });
});
