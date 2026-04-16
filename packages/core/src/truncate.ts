import { formatSize } from "./format.js";

export interface TruncateTailResult {
  content: string;
  truncated: boolean;
  truncatedBy?: "lines" | "bytes";
  outputLines: number;
  totalLines: number;
}

/**
 * Keep the tail of text under max line and byte limits (UTF-8 safe for byte cut).
 */
export function truncateTail(
  text: string,
  opts: { maxLines: number; maxBytes: number }
): TruncateTailResult {
  const lines = text.split("\n");
  const totalLines = lines.length;
  let work = text;
  let truncatedByLines = false;

  if (lines.length > opts.maxLines) {
    work = lines.slice(-opts.maxLines).join("\n");
    truncatedByLines = true;
  }

  const buf = Buffer.from(work, "utf8");
  let truncatedByBytes = false;
  if (buf.length > opts.maxBytes) {
    const slice = buf.subarray(buf.length - opts.maxBytes);
    work = slice.toString("utf8");
    const firstNl = work.indexOf("\n");
    if (firstNl > 0) {
      work = work.slice(firstNl + 1);
    }
    truncatedByBytes = true;
  }

  const outLines = work.split("\n").length;
  return {
    content: work,
    truncated: truncatedByLines || truncatedByBytes,
    truncatedBy: truncatedByBytes ? "bytes" : truncatedByLines ? "lines" : undefined,
    outputLines: outLines,
    totalLines,
  };
}

export function formatTruncationFooter(
  trunc: TruncateTailResult,
  maxBytes: number,
  fullOutputPath?: string
): string {
  let footer = "";
  if (trunc.truncatedBy === "lines") {
    footer += `\n\n[Showing last ${trunc.outputLines} of ${trunc.totalLines} lines.`;
  } else if (trunc.truncatedBy === "bytes") {
    footer += `\n\n[Showing last ${trunc.outputLines} lines (${formatSize(maxBytes)} limit).`;
  }
  if (footer && fullOutputPath) {
    footer += ` Full output: ${fullOutputPath}`;
  }
  if (footer) footer += "]";
  return footer;
}
