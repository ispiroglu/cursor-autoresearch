# Cursor Autoresearch — VS Code / Cursor extension

**Autoresearch (Cursor · VS Code)** — In the Extensions view this package is listed as **Autoresearch**; the project and docs use the full name **Cursor Autoresearch** (repository: [`cursor-autoresearch`](https://github.com/ergenekonyigit/cursor-autoresearch)).

## What you get

- Status line integration for autoresearch sessions  
- Commands for help, dashboard export, session control, and results  
- Optional local HTTP + SSE dashboard and results webview  

The experiment engine and MCP server live in the same monorepo; see the **[main README](https://github.com/ergenekonyigit/cursor-autoresearch#readme)** for install, `autoresearch.jsonl`, and MCP setup for **Cursor** and **VS Code**.

## Build from source

```bash
pnpm install
pnpm build
pnpm --filter autoresearch exec vsce package --no-dependencies
```

Install the generated `.vsix` via **Extensions: Install from VSIX…**.

## License

MIT — see the [repository LICENSE](https://github.com/ergenekonyigit/cursor-autoresearch/blob/main/LICENSE).
