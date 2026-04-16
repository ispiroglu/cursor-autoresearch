import path from "node:path";
import { defineConfig } from "vitest/config";

// Resolve from this package directory (pnpm runs `vitest` with cwd = packages/vscode-extension).
const packageRoot = process.cwd();

export default defineConfig({
  resolve: {
    alias: {
      "@ergenekonyigit/cursor-autoresearch-core": path.resolve(
        packageRoot,
        "../core/src/index.ts",
      ),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
