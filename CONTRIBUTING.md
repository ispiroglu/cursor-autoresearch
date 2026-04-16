# Contributing

## Prerequisites

- **Node.js** — **22.x** is what CI uses; [`.node-version`](.node-version) pins `22`. The root [`package.json`](package.json) `engines.node` field is `>=22` (newer LTS versions are fine).
- **pnpm** — version is pinned via `packageManager` in the root `package.json`; enable with [corepack](https://nodejs.org/api/corepack.html) (`corepack enable`) or install pnpm manually.

## Clone and install

```bash
git clone https://github.com/ergenekonyigit/cursor-autoresearch.git
cd cursor-autoresearch
pnpm install
```

## Common commands

| Command | Purpose |
|--------|---------|
| `pnpm lint` | ESLint across the repo |
| `pnpm typecheck` | TypeScript `--noEmit` for all workspace packages |
| `pnpm build` | Build `core`, `mcp-server`, and the VS Code extension |
| `pnpm test` | Run all package tests (extension tests expect a built `core` or Vitest aliases) |
| `pnpm clean` | Remove `packages/*/dist` |
| `pnpm package:extension` | Produce the `.vsix` under `packages/vscode-extension/` |

After `pnpm clean`, run `pnpm build` before `pnpm test` so workspace resolution and Vitest aliases stay consistent.

## Run the MCP server locally

Build first, then run the compiled server with a workspace root:

```bash
pnpm build
node packages/mcp-server/dist/index.js
```

Set **`AUTORESEARCH_CWD`** to the directory that contains `autoresearch.jsonl` (your optimized project), e.g.:

```bash
AUTORESEARCH_CWD=/path/to/your/project node packages/mcp-server/dist/index.js
```

## Pull requests

- Open PRs against the default branch (e.g. `main`).
- Keep changes focused; describe the problem and the approach in the PR body.
- Ensure **`pnpm lint`**, **`pnpm typecheck`**, **`pnpm build`**, and **`pnpm test`** pass locally before requesting review.

## Version alignment

The **VS Code extension** version in [`packages/vscode-extension/package.json`](packages/vscode-extension/package.json) is the release driver for tags and marketplace. The **root** `package.json` `version` is kept aligned with that extension version for the monorepo. See [RELEASING.md](RELEASING.md) for releases.
