import { describe, expect, it } from "vitest";
import { AUTORESEARCH_MCP_TOOLS } from "./tools.js";

describe("AUTORESEARCH_MCP_TOOLS", () => {
  it("exposes three tools with stable names", () => {
    const names = AUTORESEARCH_MCP_TOOLS.map((t) => t.name);
    expect(names).toEqual(["init_experiment", "run_experiment", "log_experiment"]);
  });

  it("marks required fields on init_experiment", () => {
    const t = AUTORESEARCH_MCP_TOOLS.find((x) => x.name === "init_experiment")!;
    expect(t.inputSchema.required).toContain("name");
    expect(t.inputSchema.required).toContain("metric_name");
  });
});
