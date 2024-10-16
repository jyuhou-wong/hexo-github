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
  
  const blogsTreeView = vscode.window.createTreeView("hexo-github-blogs", {
    treeDataProvider: blogsProvider,
  });

  context.subscriptions.push(blogsTreeView);
}

export function deactivate() {}
