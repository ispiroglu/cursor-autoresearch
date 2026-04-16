import * as fs from "node:fs";
import * as path from "node:path";
import * as http from "node:http";
import { tmpdir } from "node:os";
import type { ServerResponse } from "node:http";

const TITLE_PLACEHOLDER = "__AUTORESEARCH_TITLE__";

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".jsonl": "text/plain; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".webp": "image/webp",
};

export function getDashboardMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return CONTENT_TYPES[ext] ?? "application/octet-stream";
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function readJsonlContent(workDir: string): string {
  return fs
    .readFileSync(path.join(workDir, "autoresearch.jsonl"), "utf-8")
    .trim();
}

export function extractSessionName(jsonlContent: string): string {
  const firstLine = jsonlContent.split("\n").find((l) => l.trim());
  if (!firstLine) return "Autoresearch";
  try {
    const config = JSON.parse(firstLine) as { name?: string };
    return config.name || "Autoresearch";
  } catch {
    return "Autoresearch";
  }
}

export function writeDashboardHtml(
  extensionAssetsDir: string,
  workDir: string,
): string {
  const jsonlContent = readJsonlContent(workDir);
  const sessionName = extractSessionName(jsonlContent);
  const templatePath = path.join(extensionAssetsDir, "template.html");
  let html = fs.readFileSync(templatePath, "utf-8");
  html = html.replace(TITLE_PLACEHOLDER, escapeHtml(sessionName));
  const exportDir = fs.mkdtempSync(
    path.join(tmpdir(), "autoresearch-dashboard-"),
  );
  const dest = path.join(exportDir, "index.html");
  fs.writeFileSync(dest, html);
  return dest;
}

let dashboardServer: http.Server | null = null;
let dashboardServerPort: number | null = null;
let dashboardServerWorkDir: string | null = null;
/** Active dashboard HTML path (temp file); restart server when export writes a new file. */
let dashboardActiveHtmlPath: string | null = null;
const dashboardSseClients = new Set<ServerResponse>();

export function broadcastDashboardUpdate(workDir: string): void {
  if (!dashboardServer || dashboardServerWorkDir !== workDir) return;
  for (const res of dashboardSseClients) {
    try {
      res.write("event: jsonl-updated\n");
      res.write(`data: ${Date.now()}\n\n`);
    } catch {
      dashboardSseClients.delete(res);
    }
  }
}

function registerSseClient(res: ServerResponse): void {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  res.write("retry: 1000\n\n");
  dashboardSseClients.add(res);
  res.on("close", () => dashboardSseClients.delete(res));
}

function resolveServedFile(
  resolvedWorkDir: string,
  requestPath: string,
  dashboardHtmlPath: string,
): string | null {
  if (requestPath === "/") return dashboardHtmlPath;
  if (requestPath === "/autoresearch.jsonl")
    return path.join(resolvedWorkDir, "autoresearch.jsonl");
  return null;
}

export function stopDashboardServer(): void {
  for (const client of dashboardSseClients) {
    try {
      client.end();
    } catch {
      /* ignore */
    }
  }
  dashboardSseClients.clear();
  if (dashboardServer) {
    try {
      dashboardServer.close();
    } catch {
      /* ignore */
    }
  }
  dashboardServer = null;
  dashboardServerPort = null;
  dashboardServerWorkDir = null;
  dashboardActiveHtmlPath = null;
}

export function startDashboardServer(
  workDir: string,
  dashboardHtmlPath: string,
): Promise<number> {
  return new Promise((resolve, reject) => {
    const resolvedWorkDir = path.resolve(workDir);
    const resolvedHtml = path.resolve(dashboardHtmlPath);

    if (
      dashboardServer &&
      dashboardServerWorkDir === resolvedWorkDir &&
      dashboardActiveHtmlPath === resolvedHtml &&
      dashboardServerPort
    ) {
      resolve(dashboardServerPort);
      return;
    }

    stopDashboardServer();

    const server = http.createServer((req, res) => {
      const url = new URL(req.url ?? "/", "http://127.0.0.1");

      if (url.pathname === "/events") {
        registerSseClient(res);
        return;
      }

      const filePath = resolveServedFile(
        resolvedWorkDir,
        url.pathname,
        resolvedHtml,
      );
      if (!filePath) {
        res.writeHead(404);
        res.end();
        return;
      }

      fs.readFile(filePath, (err, data) => {
        if (err) {
          res.writeHead(404);
          res.end();
          return;
        }
        res.writeHead(200, { "Content-Type": getDashboardMimeType(filePath) });
        res.end(data);
      });
    });

    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        reject(new Error("Failed to bind dashboard server"));
        return;
      }
      dashboardServer = server;
      dashboardServerPort = addr.port;
      dashboardServerWorkDir = resolvedWorkDir;
      dashboardActiveHtmlPath = resolvedHtml;
      resolve(addr.port);
    });

    server.on("error", reject);
  });
}
