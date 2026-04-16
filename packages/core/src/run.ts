import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { randomBytes } from "node:crypto";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { DEFAULT_MAX_BYTES } from "./constants.js";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export function killTree(pid: number): void {
  try {
    process.kill(-pid, "SIGTERM");
  } catch {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      /* ignore */
    }
  }
}

export function createTempFileAllocator(): () => string {
  let p: string | undefined;
  return (): string => {
    if (p === undefined) {
      const id = randomBytes(8).toString("hex");
      p = path.join(tmpdir(), `autoresearch-experiment-${id}.log`);
    }
    return p;
  };
}

/**
 * Whether the command is allowed when autoresearch.sh exists (pi guard).
 */
export function isAutoresearchShCommand(command: string): boolean {
  let cmd = command.trim();
  cmd = cmd.replace(/^(?:\w+=\S*\s+)+/, "");
  let prev: string;
  do {
    prev = cmd;
    cmd = cmd.replace(/^(?:env|time|nice|nohup)(?:\s+-\S+(?:\s+\d+)?)*\s+/, "");
  } while (cmd !== prev);

  return /^(?:(?:bash|sh|source)\s+(?:-\w+\s+)*)?(?:\.\/|\/[\w/.-]*\/)?autoresearch\.sh(?:\s|$)/.test(
    cmd
  );
}

export interface SpawnCaptureResult {
  exitCode: number | null;
  killed: boolean;
  output: string;
  tempFilePath: string | undefined;
  actualTotalBytes: number;
}

/**
 * Run `bash -c command` in workDir with timeout; capture merged stdout/stderr.
 */
export async function spawnBashCapture(
  workDir: string,
  command: string,
  timeoutMs: number,
  signal: AbortSignal | undefined
): Promise<SpawnCaptureResult> {
  const getTempFile = createTempFileAllocator();
  return new Promise<SpawnCaptureResult>((resolve, reject) => {
    let processTimedOut = false;
    const child = spawn("bash", ["-c", command], {
      cwd: workDir,
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    const chunks: Buffer[] = [];
    let chunksBytes = 0;
    const maxChunksBytes = DEFAULT_MAX_BYTES * 2;
    let tempFilePath: string | undefined;
    let tempFileStream: ReturnType<typeof createWriteStream> | undefined;
    let totalBytes = 0;

    const handleData = (data: Buffer) => {
      totalBytes += data.length;
      if (totalBytes > DEFAULT_MAX_BYTES && !tempFilePath) {
        tempFilePath = getTempFile();
        tempFileStream = createWriteStream(tempFilePath);
        for (const chunk of chunks) {
          tempFileStream.write(chunk);
        }
      }
      if (tempFileStream) {
        tempFileStream.write(data);
      }
      chunks.push(data);
      chunksBytes += data.length;
      while (chunksBytes > maxChunksBytes && chunks.length > 1) {
        const removed = chunks.shift()!;
        chunksBytes -= removed.length;
      }
      if (chunks.length > 0 && chunksBytes > maxChunksBytes) {
        const buf = chunks[0];
        const nlIdx = buf.indexOf(0x0a);
        if (nlIdx !== -1 && nlIdx < buf.length - 1) {
          chunks[0] = buf.subarray(nlIdx + 1);
          chunksBytes -= nlIdx + 1;
        }
      }
    };

    if (child.stdout) child.stdout.on("data", handleData);
    if (child.stderr) child.stderr.on("data", handleData);

    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    if (timeoutMs > 0) {
      timeoutHandle = setTimeout(() => {
        processTimedOut = true;
        if (child.pid) killTree(child.pid);
      }, timeoutMs);
    }

    const onAbort = () => {
      if (child.pid) killTree(child.pid);
      else {
        child.kill();
        child.once("spawn", () => {
          if (child.pid) killTree(child.pid);
        });
      }
    };
    if (signal) {
      if (signal.aborted) onAbort();
      else signal.addEventListener("abort", onAbort, { once: true });
    }

    child.on("error", (err: Error) => {
      if (timeoutHandle) clearTimeout(timeoutHandle);
      if (signal) signal.removeEventListener("abort", onAbort);
      if (tempFileStream) tempFileStream.end();
      reject(err);
    });

    child.on("close", (code: number | null) => {
      if (timeoutHandle) clearTimeout(timeoutHandle);
      if (signal) signal.removeEventListener("abort", onAbort);
      if (tempFileStream) tempFileStream.end();
      if (signal?.aborted) {
        reject(new Error("aborted"));
        return;
      }
      resolve({
        exitCode: code,
        killed: processTimedOut,
        output: Buffer.concat(chunks).toString("utf-8"),
        tempFilePath,
        actualTotalBytes: totalBytes,
      });
    });
  });
}

export async function runChecksScript(
  workDir: string,
  checksPath: string,
  timeoutMs: number,
  signal: AbortSignal | undefined
): Promise<{ code: number; killed: boolean; output: string; durationSec: number }> {
  const t0 = Date.now();
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), timeoutMs);
    if (signal) {
      signal.addEventListener("abort", () => ac.abort(), { once: true });
    }
    const { stdout, stderr } = await execFileAsync("bash", [checksPath], {
      cwd: workDir,
      timeout: timeoutMs,
      maxBuffer: 10 * 1024 * 1024,
      signal: ac.signal,
    });
    clearTimeout(t);
    const durationSec = (Date.now() - t0) / 1000;
    return {
      code: 0,
      killed: false,
      output: ((stdout ?? "") + "\n" + (stderr ?? "")).trim(),
      durationSec,
    };
  } catch (e: unknown) {
    const durationSec = (Date.now() - t0) / 1000;
    const err = e as { code?: string | number; killed?: boolean; message?: string };
    const killed = err.killed === true || err.code === "ABORT_ERR";
    const code =
      typeof err.code === "number" ? err.code : killed ? -1 : 1;
    return {
      code,
      killed,
      output: err.message ?? String(e),
      durationSec,
    };
  }
}
