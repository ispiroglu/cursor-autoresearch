#!/usr/bin/env node
/**
 * Merge autoresearch MCP server into ~/.cursor/mcp.json (creates file if missing).
 * Usage: node scripts/merge-mcp.mjs <absolute-path-to-packages/mcp-server/dist/index.js>
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const mcpEntry = process.argv[2];
if (!mcpEntry) {
  console.error("usage: node merge-mcp.mjs <absolute-path-to-mcp-server/dist/index.js>");
  process.exit(1);
}

const resolved = path.resolve(mcpEntry);
if (!fs.existsSync(resolved)) {
  console.error(`MCP entrypoint not found: ${resolved}`);
  process.exit(1);
}

const target = path.join(os.homedir(), ".cursor", "mcp.json");
let config = { mcpServers: {} };

if (fs.existsSync(target)) {
  const raw = fs.readFileSync(target, "utf8");
  try {
    config = JSON.parse(raw);
  } catch {
    console.error(`Invalid JSON in ${target} — fix or rename it, then re-run install.`);
    process.exit(1);
  }
}

if (!config.mcpServers || typeof config.mcpServers !== "object") {
  config.mcpServers = {};
}

config.mcpServers.autoresearch = {
  command: "node",
  args: [resolved],
  env: {
    AUTORESEARCH_CWD: "${workspaceFolder}",
  },
};

fs.mkdirSync(path.dirname(target), { recursive: true });
if (fs.existsSync(target)) {
  fs.copyFileSync(target, `${target}.bak`);
}
fs.writeFileSync(target, `${JSON.stringify(config, null, 2)}\n`, "utf8");
console.log(`Wrote autoresearch MCP to ${target} (backup: ${target}.bak if existed)`);
