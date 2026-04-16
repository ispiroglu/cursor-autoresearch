import type { ExperimentResult } from "@cursor-autoresearch/core";

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildResultsPanelHtml(results: ExperimentResult[]): string {
  const rows = results
    .map(
      (r, i) =>
        `<tr><td>${i + 1}</td><td>${escapeHtml(r.commit)}</td><td>${r.metric}</td><td>${r.status}</td><td>${escapeHtml(r.description)}</td></tr>`
    )
    .join("");
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
    body{font-family:var(--vscode-font-family);color:var(--vscode-foreground);padding:12px;}
    table{border-collapse:collapse;width:100%;}
    td,th{border:1px solid var(--vscode-panel-border);padding:6px;text-align:left;}
    th{background:var(--vscode-editor-inactiveSelectionBackground);}
    </style></head><body><h3>Autoresearch results</h3><table><thead><tr><th>#</th><th>Commit</th><th>Metric</th><th>Status</th><th>Description</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
}
