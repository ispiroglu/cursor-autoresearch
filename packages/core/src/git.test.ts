import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { execSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";
import { execGit, revertWorkingTreePreservingAutoresearch } from "./git.js";

let tmp: string | undefined;

function mkGitRepo(): string {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "autoresearch-git-"));
  execSync("git init", { cwd: tmp, stdio: "pipe" });
  execSync('git config user.email "t@test"', { cwd: tmp, stdio: "pipe" });
  execSync('git config user.name "test"', { cwd: tmp, stdio: "pipe" });
  fs.writeFileSync(path.join(tmp, "README.md"), "x\n", "utf-8");
  execSync("git add README.md && git commit -m init", { cwd: tmp, stdio: "pipe" });
  return tmp;
}

afterEach(() => {
  if (tmp && fs.existsSync(tmp)) {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  tmp = undefined;
});

describe("execGit", () => {
  it("returns stdout on success", async () => {
    const repo = mkGitRepo();
    const r = await execGit(repo, ["rev-parse", "--short=7", "HEAD"]);
    expect(r.code).toBe(0);
    expect(r.stdout.trim().length).toBeGreaterThanOrEqual(7);
  });

  it("returns non-zero code on unknown subcommand in old git", async () => {
    const repo = mkGitRepo();
    const r = await execGit(repo, ["not-a-real-git-subcommand-xyz"]);
    expect(r.code).not.toBe(0);
  });
});

describe("revertWorkingTreePreservingAutoresearch", () => {
  it("runs without throwing in a git repo", async () => {
    const repo = mkGitRepo();
    fs.writeFileSync(path.join(repo, "autoresearch.jsonl"), "{}\n", "utf-8");
    await expect(revertWorkingTreePreservingAutoresearch(repo)).resolves.toBeUndefined();
  });
});
