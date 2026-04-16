# Cursor Autoresearch

**Autoresearch (Cursor · VS Code)** — one workflow for both editors: MCP tools, `autoresearch.jsonl` session log, optional browser dashboard, and packaged **skills** (`autoresearch-create`, `autoresearch-finalize`).

**Naming:** This open-source project is **Cursor Autoresearch**; the GitHub repository is **[`cursor-autoresearch`](https://github.com/ergenekonyigit/cursor-autoresearch)** so it is easy to discover and share. In **Cursor** and **VS Code**, the MCP server and extension use the short product name **Autoresearch** (what you see in the UI and marketplace).

**Port of [pi-autoresearch](https://github.com/davebcn87/pi-autoresearch)** for **Cursor** and **VS Code**. Upstream, pi-autoresearch targets **[pi](https://pi.dev/)** — an AI coding agent in the terminal. Here you get the same **autonomous optimization loops**: try an idea, benchmark it, keep improvements, revert regressions, repeat. Inspired by **[karpathy/autoresearch](https://github.com/karpathy/autoresearch)**. The pattern applies to **any optimization target**: test speed, bundle size, LLM training, build times, Lighthouse scores, and more.

## How it works

**Cursor Autoresearch** runs a **closed loop** in your repo: you pick one primary metric (e.g. wall-clock seconds, lower is better), the agent changes code, measures with a fixed benchmark script, and records each outcome so sessions can resume.

**MCP tools (three):** **`init_experiment`** (name run + metric direction) → **`run_experiment`** (runs your benchmark, usually `./autoresearch.sh`, parses **`METRIC name=value`** from stdout) → **`log_experiment`** (append to **`autoresearch.jsonl`**; **`keep`** can auto-commit, **`discard`** / **`crash`** / failed checks can revert while keeping autoresearch files).

**Workspace files:** **`autoresearch.md`** — goal, scope, “what we tried”. **`autoresearch.sh`** — repeatable benchmark; metrics must match `init_experiment`. Optional **`autoresearch.config.json`** — e.g. `maxIterations`. Work often uses a branch like `autoresearch/<goal>-<date>`.

**Elsewhere in this repo:** **`packages/core`** — JSONL, git, benchmark execution, stats (e.g. MAD). **`packages/mcp-server`** and **`packages/vscode-extension`** consume that engine. The **Autoresearch** extension adds a status bar, commands, and a local HTTP + SSE dashboard + results webview.

## Monorepo layout

| Package | Role |
|--------|------|
| [`packages/core`](packages/core) | Shared experiment engine. |
| [`packages/mcp-server`](packages/mcp-server) | MCP server (three tools) for Cursor Agent or VS Code (Copilot MCP). |
| [`packages/vscode-extension`](packages/vscode-extension) | UI: status bar, dashboard, results panel. |
| [`skills/`](skills/) | Agent skills (symlinked or copied into `~/.agents/skills/`). |

## Install

### Build once (any editor)

From a clone of this repository:

```bash
pnpm install
pnpm build
```

The MCP entrypoint is `packages/mcp-server/dist/index.js` — use your absolute path in the JSON below. **`AUTORESEARCH_CWD`** must be the project you optimize (where `autoresearch.jsonl` / `autoresearch.md` live), usually `${workspaceFolder}`.

---

### Cursor

**One-shot** (clone to `~/.local/share/cursor-autoresearch` by default, merges `~/.cursor/mcp.json`, symlinks skills):

```bash
curl -fsSL https://raw.githubusercontent.com/ergenekonyigit/cursor-autoresearch/main/scripts/bootstrap.sh | bash
```

| Variable | Default | Meaning |
|----------|---------|---------|
| `INSTALL_DIR` | `$HOME/.local/share/cursor-autoresearch` | Clone path |
| `REPO_URL` | `https://github.com/ergenekonyigit/cursor-autoresearch.git` | Git remote |
| `SKIP_MCP` | — | `1` = do not write `~/.cursor/mcp.json` |
| `SKIP_SKILLS` | — | `1` = skip symlinks under `~/.agents/skills/` |

**Already have the repo?**

```bash
pnpm install:cursor   # same as ./scripts/install.sh
```

Restart **Cursor** so MCP reloads.

**MCP config file:** `~/.cursor/mcp.json` — same shape the install script writes:

```json
{
  "mcpServers": {
    "autoresearch": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/cursor-autoresearch/packages/mcp-server/dist/index.js"],
      "env": {
        "AUTORESEARCH_CWD": "${workspaceFolder}"
      }
    }
  }
}
```

Docs: [Cursor MCP](https://cursor.com/docs/mcp/install-links), [Plugins / MCP](https://cursor.com/docs/plugins).

---

### VS Code

Use this path if you work in **VS Code** with **GitHub Copilot** (MCP is wired through Copilot chat / agent features — see [Add and manage MCP servers](https://code.visualstudio.com/docs/copilot/customization/mcp-servers)).

1. Run **Build once** above (or use a checkout where `packages/mcp-server/dist/index.js` already exists).

2. Register the server in **`mcp.json`**. Either:
   - **Workspace:** create `.vscode/mcp.json` in the folder you open (often your optimized repo), or  
   - **User:** Command Palette → **MCP: Open User Configuration** (applies to all workspaces).

3. Paste (adjust the path to `dist/index.js`):

```json
{
  "servers": {
    "autoresearch": {
      "type": "stdio",
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/cursor-autoresearch/packages/mcp-server/dist/index.js"],
      "env": {
        "AUTORESEARCH_CWD": "${workspaceFolder}"
      }
    }
  }
}
```

VS Code uses the top-level **`servers`** object (not `mcpServers`). Reference: [MCP configuration reference](https://code.visualstudio.com/docs/copilot/reference/mcp-configuration).

4. Reload the window (**Developer: Reload Window**) or restart VS Code so the server is picked up.

5. **Extension (optional):** build and install the UI from this repo — same as below (**Install the `.vsix`**).

**Notes**

- **One-shot / `pnpm install:cursor`** only updates `~/.cursor/mcp.json`. For VS Code–only setups, use **`SKIP_MCP=1`** with the bootstrap script if you want clone + build + skills without touching Cursor’s file, then add `mcp.json` as above.
- **Skills** under `~/.agents/skills/` are aimed at Cursor-style skill loading. VS Code does not use that path automatically — rely on Copilot **instructions**, prompts, or copy ideas from [`skills/`](skills/).
- **`.cursor/rules/`** apply when using Cursor; for VS Code, copy the intent into project or user instructions if you want similar nudges.

---

### Extension (VS Code or Cursor, optional)

```bash
pnpm package:extension
```

Install the `.vsix` via **Extensions: Install from VSIX…**. Shortcuts: **Ctrl+Alt+X** (expanded status), **Ctrl+Alt+Shift+X** (results webview).

### Skills (optional, Cursor-oriented)

If you did not use one-shot / `install:cursor`:

```bash
ln -sfn "$PWD/skills/autoresearch-create" ~/.agents/skills/autoresearch-create
ln -sfn "$PWD/skills/autoresearch-finalize" ~/.agents/skills/autoresearch-finalize
```

Optional: symlink into **`.cursor/skills/`** yourself (e.g. `autoresearch-create` → `../../skills/autoresearch-create`) so **Cursor** picks up skills for this workspace only, without touching `~/.agents/skills/`. Nothing in the build requires these symlinks — they are safe to omit or remove.

### Cursor rule (optional)

[`.cursor/rules/autoresearch-active.mdc`](.cursor/rules/autoresearch-active.mdc) nudges the agent to use MCP tools and keep `autoresearch.md` in sync when `autoresearch.jsonl` is present. Copy or symlink into another repo’s `.cursor/rules/` if useful.

## Example: faster tests (e.g. Vitest)

Prompt idea: *I want to reduce how long **`npm run test`** takes — set up autoresearch and try to speed it up.* (Use `pnpm test`, `pnpm vitest run`, etc., to match your repo.)

Typical sequence:

1. Branch such as `autoresearch/vitest-speed-<date>`.
2. Add **`autoresearch.md`** and **`autoresearch.sh`**, commit so the next session can resume.
3. MCP: **`init_experiment`** (e.g. metric **`vitest_seconds`**, lower is better) → baseline **`run_experiment`** + **`log_experiment`**.
4. Iteration: change config, **`run_experiment`**, **`log_experiment`** with **keep** / **discard** until satisfied or **`maxIterations`** (see config below).

Minimal benchmark (adjust the inner command; metric names must match `init_experiment`):

```bash
#!/usr/bin/env bash
set -euo pipefail
SECS="$(/usr/bin/time -p npm run test 2>&1 | awk '/^real/ {print $2}')"
echo "METRIC vitest_seconds=$SECS"
```

If you use **`pnpm exec vitest run`**, substitute that command. For very fast suites, average or median inside the script stabilizes the metric.

## Configuration (optional)

Place **`autoresearch.config.json`** next to **`autoresearch.jsonl`** — i.e. under the directory **`AUTORESEARCH_CWD`** points at (usually `${workspaceFolder}`). That is your **optimized project**, not the clone of `cursor-autoresearch`.

| Key | Purpose |
|-----|---------|
| **`maxIterations`** | Cap on counted runs in the current segment; after that, start a new segment with `init_experiment`. Omit if no cap. |
| **`workingDir`** | Run benchmarks / resolve paths relative to this directory (absolute or relative to workspace root). The JSON file stays at workspace root; validation fails if the path is missing or not a directory. |

```json
{
  "workingDir": "/path/to/project",
  "maxIterations": 50
}
```

Omit the file if defaults are enough.

## Develop (this repository)

```bash
pnpm install
pnpm build
pnpm test
```

See **[CONTRIBUTING.md](CONTRIBUTING.md)** for setup, MCP locally, and PR expectations. **Releases:** [RELEASING.md](RELEASING.md) · **Changelog:** [CHANGELOG.md](CHANGELOG.md) · **Security:** [SECURITY.md](SECURITY.md).

## License

MIT (same as upstream pi-autoresearch). See [LICENSE](LICENSE).
