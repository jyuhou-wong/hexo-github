// src/extension.ts
import * as vscode from "vscode";
import { registerCommands } from "./commands/index";
import { BlogsTreeDataProvider } from "./providers/blogsTreeDataProvider"; // 引入 BlogsTreeDataProvider

export function activate(context: vscode.ExtensionContext) {
  console.log('Congratulations, your extension "hexo-github" is now active!');

  // 注册命令
  registerCommands(context);

  // 创建 TreeDataProvider
  const blogsProvider = new BlogsTreeDataProvider(context);
  vscode.window.createTreeView("hexo-github-blogs", {
    treeDataProvider: blogsProvider,
  });
}

export function deactivate() {}
