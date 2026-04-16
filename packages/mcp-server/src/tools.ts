/**
 * MCP tool definitions for the autoresearch MCP server (shared with tests and server).
 */
export const AUTORESEARCH_MCP_TOOLS = [
  {
    name: "init_experiment",
    description:
      "Initialize the experiment session (name, metric, unit, direction). Writes a config header to autoresearch.jsonl.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Human-readable session name" },
        metric_name: { type: "string", description: "Primary metric name (e.g. total_µs)" },
        metric_unit: { type: "string", description: 'Unit suffix: µs, ms, s, kb, mb, or ""' },
        direction: {
          type: "string",
          enum: ["lower", "higher"],
          description: "Whether lower or higher metric values are better",
        },
      },
      required: ["name", "metric_name"],
    },
  },
  {
    name: "run_experiment",
    description:
      "Run a shell command in the workspace, measure duration, capture output, parse METRIC lines.",
    inputSchema: {
      type: "object",
      properties: {
        command: { type: "string", description: "Shell command (e.g. ./autoresearch.sh)" },
        timeout_seconds: { type: "number", description: "Timeout in seconds (default 600)" },
        checks_timeout_seconds: {
          type: "number",
          description: "Timeout for autoresearch.checks.sh in seconds (default 300)",
        },
      },
      required: ["command"],
    },
  },
  {
    name: "log_experiment",
    description:
      "Record an experiment result; commits on keep, reverts on discard/crash/checks_failed (pi-compatible).",
    inputSchema: {
      type: "object",
      properties: {
        commit: { type: "string", description: "Git commit hash (short)" },
        metric: { type: "number", description: "Primary metric value" },
        status: {
          type: "string",
          enum: ["keep", "discard", "crash", "checks_failed"],
        },
        description: { type: "string", description: "What this run tried" },
        metrics: {
          type: "object",
          additionalProperties: { type: "number" },
          description: "Secondary metrics",
        },
        force: { type: "boolean", description: "Allow new secondary metric names" },
        asi: {
          type: "object",
          description: "Actionable side information (optional key/value)",
        },
      },
      required: ["commit", "metric", "status", "description"],
    },
  },
] as const;
