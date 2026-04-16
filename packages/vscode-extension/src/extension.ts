import * as vscode from "vscode";
import * as path from "node:path";
import * as fs from "node:fs";
import { AutoresearchEngine } from "@cursor-autoresearch/core";
import {
  writeDashboardHtml,
  startDashboardServer,
  stopDashboardServer,
} from "./dashboard";
import { buildResultsPanelHtml } from "./results-html";

let engine: AutoresearchEngine | undefined;
let statusBar: vscode.StatusBarItem | undefined;
let panel: vscode.WebviewPanel | undefined;

function workspaceRoot(): string {
  const f = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  return f ?? process.cwd();
}

function assetsDir(context: vscode.ExtensionContext): string {
  return path.join(context.extensionPath, "assets");
}

function updateStatusBar(): void {
  if (!statusBar || !engine) return;
  const t = engine.formatStatusLine();
  if (!t) {
    statusBar.hide();
    return;
  }
  statusBar.text = engine.runtime.dashboardExpanded ? `$(graph) ${t}` : `$(beaker) ${t}`;
  statusBar.tooltip = "Autoresearch — Ctrl+Alt+X expand/collapse text";
  statusBar.show();
}

export function activate(context: vscode.ExtensionContext): void {
  engine = new AutoresearchEngine(workspaceRoot());

  statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusBar.command = "autoresearch.toggleExpanded";
  context.subscriptions.push(statusBar);

  const refresh = () => {
    engine?.reloadFromDisk();
    updateStatusBar();
  };

  const watcher = vscode.workspace.createFileSystemWatcher("**/autoresearch.jsonl");
  watcher.onDidChange(refresh);
  watcher.onDidCreate(refresh);
  watcher.onDidDelete(refresh);
  context.subscriptions.push(watcher);

  context.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      engine = new AutoresearchEngine(workspaceRoot());
      refresh();
    })
  );

  refresh();

  context.subscriptions.push(
    vscode.commands.registerCommand("autoresearch.showHelp", async () => {
      await vscode.window.showInformationMessage(
        "Autoresearch: use MCP tools init_experiment, run_experiment, log_experiment. Commands: Export dashboard, Mode off, Clear session. Keys: Ctrl+Alt+X toggle status detail, Ctrl+Alt+Shift+X results panel.",
        { modal: true }
      );
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("autoresearch.exportDashboard", async () => {
      const root = workspaceRoot();
      const jsonl = path.join(root, "autoresearch.jsonl");
      if (!fs.existsSync(jsonl)) {
        vscode.window.showErrorMessage("No autoresearch.jsonl — run experiments first.");
        return;
      }
      try {
        const htmlPath = writeDashboardHtml(assetsDir(context), root);
        const port = await startDashboardServer(root, htmlPath);
        const url = `http://127.0.0.1:${port}/`;
        await vscode.env.openExternal(vscode.Uri.parse(url));
        vscode.window.showInformationMessage(`Dashboard at ${url} (live updates)`);
      } catch (e) {
        vscode.window.showErrorMessage(
          `Export failed: ${e instanceof Error ? e.message : String(e)}`
        );
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("autoresearch.modeOff", () => {
      if (!engine) return;
      engine.runtime.autoresearchMode = false;
      engine.runtime.dashboardExpanded = false;
      stopDashboardServer();
      updateStatusBar();
      vscode.window.showInformationMessage("Autoresearch mode OFF");
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("autoresearch.clearSession", () => {
      if (!engine) return;
      const root = engine.workDir;
      const jsonl = path.join(root, "autoresearch.jsonl");
      engine.runtime.autoresearchMode = false;
      engine.runtime.dashboardExpanded = false;
      stopDashboardServer();
      try {
        if (fs.existsSync(jsonl)) {
          fs.unlinkSync(jsonl);
        }
      } catch (e) {
        vscode.window.showErrorMessage(e instanceof Error ? e.message : String(e));
        return;
      }
      engine = new AutoresearchEngine(workspaceRoot());
      updateStatusBar();
      vscode.window.showInformationMessage("Deleted autoresearch.jsonl");
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("autoresearch.resumePrompt", async () => {
      const text = await vscode.window.showInputBox({
        title: "Autoresearch — start or resume",
        prompt: "Describe goal / context (optional)",
      });
      if (text === undefined) return;
      await vscode.env.clipboard.writeText(
        `Autoresearch: ${text}\n\nRead autoresearch.md and continue the experiment loop using MCP tools init_experiment, run_experiment, log_experiment.`
      );
      vscode.window.showInformationMessage("Prompt copied to clipboard — paste into Agent chat.");
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("autoresearch.toggleExpanded", () => {
      if (!engine || engine.state.results.length === 0) {
        vscode.window.showInformationMessage("No experiments yet.");
        return;
      }
      engine.runtime.dashboardExpanded = !engine.runtime.dashboardExpanded;
      updateStatusBar();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("autoresearch.openResultsPanel", () => {
      if (!engine || engine.state.results.length === 0) {
        vscode.window.showInformationMessage("No experiments yet.");
        return;
      }
      panel?.dispose();
      panel = vscode.window.createWebviewPanel(
        "autoresearchResults",
        "Autoresearch",
        vscode.ViewColumn.Beside,
        { enableScripts: false }
      );
      panel.webview.html = buildResultsPanelHtml(engine.state.results);
      context.subscriptions.push(panel);
    })
  );

  context.subscriptions.push({
    dispose: () => {
      stopDashboardServer();
      panel?.dispose();
    },
  });
}

export function deactivate(): void {
  stopDashboardServer();
}
