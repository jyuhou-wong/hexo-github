import * as vscode from "vscode";
import { BlogsTreeDataProvider } from "./blogsTreeDataProvider"; // 引入 BlogsTreeDataProvider

export const registerBlogsProvider = (context: vscode.ExtensionContext) => {
  // 创建 TreeDataProvider
  const blogsProvider = new BlogsTreeDataProvider(context);
  // 创建 TreeView
  const blogsTreeView = vscode.window.createTreeView("vscode-hexo-github-blogs", {
    treeDataProvider: blogsProvider,
  });
  // 注册资源
  context.subscriptions.push(blogsProvider);
  context.subscriptions.push(blogsTreeView);
};
