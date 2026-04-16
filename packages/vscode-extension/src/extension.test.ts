import { describe, expect, it, vi } from "vitest";

vi.mock("vscode", () => {
  const disposable = { dispose: vi.fn() };
  return {
    workspace: {
      workspaceFolders: [{ uri: { fsPath: "/tmp/autoresearch-ws" } }],
      createFileSystemWatcher: vi.fn(() => ({
        onDidChange: vi.fn(),
        onDidCreate: vi.fn(),
        onDidDelete: vi.fn(),
      })),
      onDidChangeWorkspaceFolders: vi.fn(() => disposable),
    },
    window: {
      createStatusBarItem: vi.fn(() => ({
        command: "",
        text: "",
        tooltip: "",
        show: vi.fn(),
        hide: vi.fn(),
      })),
      showInformationMessage: vi.fn(),
      showErrorMessage: vi.fn(),
      createWebviewPanel: vi.fn(() => ({
        webview: { html: "" },
        dispose: vi.fn(),
      })),
    },
    commands: {
      registerCommand: vi.fn(() => disposable),
    },
    env: {
      openExternal: vi.fn(),
      clipboard: { writeText: vi.fn() },
    },
    Uri: {
      parse: vi.fn((s: string) => ({ fsPath: s })),
    },
    ViewColumn: { Beside: 1 },
    StatusBarAlignment: { Left: 1 },
  };
});

describe("extension lifecycle", async () => {
  const { activate, deactivate } = await import("./extension.js");

  it("activate registers subscriptions", () => {
    const subs: { dispose?: () => void }[] = [];
    const context = {
      subscriptions: subs,
      extensionPath: "/tmp/ext",
    };
    activate(context as never);
    expect(subs.length).toBeGreaterThan(0);
  });

  it("deactivate does not throw", () => {
    expect(() => deactivate()).not.toThrow();
  });
});
