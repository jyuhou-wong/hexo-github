// src/extension.ts
import * as vscode from "vscode";
import { registerCommands } from "./commands/index";
import { registerBlogsProvider } from "./providers";
import { registerActiveEditorChangeListener } from "./events";
import { loadAccessToken } from "./services/githubService";

export function activate(context: vscode.ExtensionContext) {
  console.log(
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
