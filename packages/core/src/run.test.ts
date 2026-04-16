import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  createTempFileAllocator,
  isAutoresearchShCommand,
  spawnBashCapture,
} from "./run.js";

let tmp: string | undefined;

function mkTmp(): string {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "autoresearch-run-"));
  return tmp;
}

afterEach(() => {
  if (tmp && fs.existsSync(tmp)) {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  tmp = undefined;
});

describe("isAutoresearchShCommand", () => {
  it("accepts bash autoresearch.sh", () => {
    expect(isAutoresearchShCommand("bash autoresearch.sh")).toBe(true);
  });

  it("accepts ./autoresearch.sh", () => {
    expect(isAutoresearchShCommand("./autoresearch.sh")).toBe(true);
  });

  it("accepts leading VAR=value and time/nice wrappers", () => {
    expect(isAutoresearchShCommand("FOO=1 bash autoresearch.sh")).toBe(true);
    expect(isAutoresearchShCommand("time nice -n 10 ./autoresearch.sh")).toBe(true);
  });

  it("rejects arbitrary commands", () => {
    expect(isAutoresearchShCommand("npm test")).toBe(false);
    expect(isAutoresearchShCommand("bash other.sh")).toBe(false);
  });
});

describe("createTempFileAllocator", () => {
  it("returns the same path on repeated calls", () => {
    const alloc = createTempFileAllocator();
    const a = alloc();
    const b = alloc();
    expect(a).toBe(b);
    expect(a).toContain("autoresearch-experiment-");
  });
});

describe("spawnBashCapture", () => {
  it("captures stdout", async () => {
    const cwd = mkTmp();
    const r = await spawnBashCapture(cwd, "echo hello", 5000, undefined);
    expect(r.exitCode).toBe(0);
    expect(r.killed).toBe(false);
    expect(r.output.trim()).toBe("hello");
  });

  it("rejects with aborted when signal already aborted", async () => {
    const cwd = mkTmp();
    const ac = new AbortController();
    ac.abort();
    await expect(spawnBashCapture(cwd, "sleep 10", 5000, ac.signal)).rejects.toThrow(
      "aborted"
    );
  });
});
