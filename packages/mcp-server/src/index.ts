#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { AutoresearchEngine } from "@cursor-autoresearch/core";
import { AUTORESEARCH_MCP_TOOLS } from "./tools.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PKG = JSON.parse(readFileSync(join(__dirname, "../package.json"), "utf-8")) as {
  version: string;
};

/**
 * Project root for autoresearch files. Cursor should set this to the opened workspace folder.
 * Falls back to `process.cwd()`.
 */
const ROOT = process.env["AUTORESEARCH_CWD"] ?? process.cwd();

const engine = new AutoresearchEngine(ROOT);

async function main(): Promise<void> {
  const server = new Server(
    {
      name: "autoresearch",
      version: PKG.version,
    },
    {
      capabilities: { tools: {} },
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, () => ({
    tools: [...AUTORESEARCH_MCP_TOOLS],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const name = request.params.name;
    const args = (request.params.arguments ?? {});

    try {
      if (name === "init_experiment") {
        const r = engine.initExperiment({
          name: String(args["name"] ?? ""),
          metric_name: String(args["metric_name"] ?? ""),
          metric_unit:
            args["metric_unit"] !== undefined ? String(args["metric_unit"]) : undefined,
          direction: args["direction"] !== undefined ? String(args["direction"]) : undefined,
        });
        return {
          content: [{ type: "text", text: r.text }],
        };
      }

      if (name === "run_experiment") {
        const r = await engine.runExperiment({
          command: String(args["command"] ?? ""),
          timeout_seconds:
            typeof args["timeout_seconds"] === "number" ? args["timeout_seconds"] : undefined,
          checks_timeout_seconds:
            typeof args["checks_timeout_seconds"] === "number"
              ? args["checks_timeout_seconds"]
              : undefined,
        });
        return {
          content: [{ type: "text", text: r.text }],
        };
      }

      if (name === "log_experiment") {
        const r = await engine.logExperiment({
          commit: String(args["commit"] ?? ""),
          metric: Number(args["metric"]),
          status: args["status"] as "keep" | "discard" | "crash" | "checks_failed",
          description: String(args["description"] ?? ""),
          metrics:
            args["metrics"] && typeof args["metrics"] === "object" && args["metrics"] !== null
              ? (args["metrics"] as Record<string, number>)
              : undefined,
          force: typeof args["force"] === "boolean" ? args["force"] : undefined,
          asi:
            args["asi"] && typeof args["asi"] === "object" && args["asi"] !== null
              ? (args["asi"] as Record<string, unknown>)
              : undefined,
        });
        return {
          content: [{ type: "text", text: r.text }],
        };
      }

      throw new Error(`Unknown tool: ${name}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return {
        content: [{ type: "text", text: `❌ ${msg}` }],
        isError: true,
      };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
