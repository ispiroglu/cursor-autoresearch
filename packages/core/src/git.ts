import { execFile } from "node:child_process";
import { promisify } from "node:util";
import * as path from "node:path";

const execFileAsync = promisify(execFile);

export interface ExecResult {
  code: number;
  stdout: string;
  stderr: string;
}

export async function execGit(
  workDir: string,
  args: string[],
  timeoutMs: number = 10_000
): Promise<ExecResult> {
  try {
    const { stdout, stderr } = await execFileAsync("git", args, {
      cwd: workDir,
      timeout: timeoutMs,
      maxBuffer: 10 * 1024 * 1024,
    });
    return { code: 0, stdout: stdout ?? "", stderr: stderr ?? "" };
  } catch (e: unknown) {
    const err = e as { code?: number; stdout?: string; stderr?: string };
    return {
      code: typeof err.code === "number" ? err.code : 1,
      stdout: err.stdout ?? "",
      stderr: err.stderr ?? "",
    };
  }
}

export async function execBash(
  workDir: string,
  script: string,
  timeoutMs: number
): Promise<ExecResult> {
  try {
    const { stdout, stderr } = await execFileAsync("bash", ["-c", script], {
      cwd: workDir,
      timeout: timeoutMs,
      maxBuffer: 10 * 1024 * 1024,
    });
    return { code: 0, stdout: stdout ?? "", stderr: stderr ?? "" };
  } catch (e: unknown) {
    const err = e as { code?: number; stdout?: string; stderr?: string };
    return {
      code: typeof err.code === "number" ? err.code : 1,
      stdout: err.stdout ?? "",
      stderr: err.stderr ?? "",
    };
  }
}

const PROTECTED_FILES = [
  "autoresearch.jsonl",
  "autoresearch.md",
  "autoresearch.ideas.md",
  "autoresearch.sh",
  "autoresearch.checks.sh",
];

/**
 * Stage protected autoresearch files, then reset working tree (pi-autoresearch behavior).
 */
export async function revertWorkingTreePreservingAutoresearch(
  workDir: string
): Promise<void> {
  const stageCmd = PROTECTED_FILES.map(
    (f) => `git add "${path.join(workDir, f)}" 2>/dev/null || true`
  ).join("; ");
  await execBash(workDir, `${stageCmd}; git checkout -- .; git clean -fd 2>/dev/null`, 10_000);
}
