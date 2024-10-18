// src/extension.ts
import * as vscode from "vscode";
import { registerCommands } from "./commands/index";
import { registerBlogsProvider } from "./providers";
import { registerActiveEditorChangeListener } from "./events";

export function activate(context: vscode.ExtensionContext) {
  console.log('Congratulations, your extension "hexo-github" is now active!');

  // 注册命令
  registerCommands(context);

  // 注册Blogs自定义视图
  registerBlogsProvider(context);

  // 注册自定义事件
  registerActiveEditorChangeListener(context);
}

export function deactivate() {}
