// src/extension.ts
import * as vscode from "vscode";
import { registerCommands } from "./commands/index";
import { registerBlogsProvider } from "./providers";
import { registerActiveEditorChangeListener } from "./events";
import { loadAccessToken } from "./services/githubService";

let outputChannel: vscode.OutputChannel;

export function activate(context: vscode.ExtensionContext) {
  // Create an output channel
  outputChannel = vscode.window.createOutputChannel("Hexo GitHub");
  logMessage(
    'Congratulations, your extension "vscode-hexo-github" is now active!'
  );

  // Load local token
  loadAccessToken();

  // Register commands
  registerCommands(context);

  // Register custom Blogs view
  registerBlogsProvider(context);

  // Register custom events
  registerActiveEditorChangeListener(context);
}

export function deactivate() {}

// Example function to log messages
export const logMessage = (
  message: string,
  show: boolean = false,
  type: "info" | "warn" | "error" = "info"
) => {
  const timestamp = new Date().toLocaleString();
  const formatMessage = `[${timestamp}] [${type}] ${message}`;
  outputChannel.appendLine(formatMessage);

  if (!show) {
    return;
  }

  switch (type) {
    case "info":
      vscode.window.showInformationMessage(message);
      break;
    case "warn":
      vscode.window.showWarningMessage(message);
      break;
    case "error":
      vscode.window.showErrorMessage(message);
      break;
  }
};
