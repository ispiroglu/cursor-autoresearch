# Releasing

## Versioning

1. Bump **`version`** in [`packages/vscode-extension/package.json`](packages/vscode-extension/package.json) (semantic versioning).
2. Set the **root** [`package.json`](package.json) **`version`** to the **same** value so the monorepo stays in sync.
3. Optionally bump **`version`** in [`packages/mcp-server/package.json`](packages/mcp-server/package.json) and [`packages/core/package.json`](packages/core/package.json) if you publish those packages; for GitHub-only releases, keeping them aligned avoids confusion.

## Git tag

Create and push an annotated or lightweight tag whose name matches the extension version with a **`v`** prefix:

```bash
git add -A && git commit -m "chore: release 0.2.0"
git tag v0.2.0
git push origin main && git push origin v0.2.0
```

The **[Release](.github/workflows/release.yml)** workflow runs on `v*` tags. It verifies that the tag (without `v`) equals `packages/vscode-extension/package.json` **`version`**.

## GitHub Release

The workflow uploads the built **`.vsix`** as a release asset and generates release notes. No extra steps if CI is green.

## Visual Studio Marketplace

1. Create a [Personal Access Token](https://code.visualstudio.com/api/working-with-extensions/publishing-extension) with **Marketplace (Manage)**.
2. Add it as the repository secret **`VSCE_PAT`**.
3. On tag push, the workflow runs **`vsce publish`** when **`VSCE_PAT`** is set.

## Open VSX (VSCodium / alternative registries)

1. Create a token at [Open VSX](https://open-vsx.org/).
2. Add it as **`OVSX_PAT`**.
3. The release workflow publishes with **`npx ovsx`** when the secret is set.

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for a human-edited summary, or rely on **GitHub Releases** auto-generated notes only.
