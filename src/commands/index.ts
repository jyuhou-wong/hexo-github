import * as vscode from "vscode";
import {
  loginToGitHub,
  logoutFromGitHub,
  openPage,
  openPageRepository,
  openSourceRepository,
  pullHexoRepository,
  pushHexoRepository,
  setCName,
} from "./githubCommands";
import {
  localPreview,
  deployBlog,
  addItem,
  publishDraft,
  applyTheme,
  addTheme,
  deleteTheme,
  deleteSite,
  addSite,
} from "./hexoCommands";
import { deleteItem, refreshBlogsProvider } from "../utils";
import { TreeItem } from "../providers/blogsTreeDataProvider";

// Register all commands
const commands = [
  { command: "vscode-hexo-github.deploy", callback: deployBlog },
  { command: "vscode-hexo-github.loginToGitHub", callback: loginToGitHub },
  { command: "vscode-hexo-github.logoutFromGitHub", callback: logoutFromGitHub },
  { command: "vscode-hexo-github.pullHexo", callback: pullHexoRepository },
  { command: "vscode-hexo-github.pushHexo", callback: pushHexoRepository },
  { command: "vscode-hexo-github.openSourceGit", callback: openSourceRepository },
  { command: "vscode-hexo-github.openPageGit", callback: openPageRepository },
  { command: "vscode-hexo-github.openPage", callback: openPage },
  { command: "vscode-hexo-github.setCName", callback: setCName },
  { command: "vscode-hexo-github.localPreview", callback: localPreview },
  { command: "vscode-hexo-github.publish", callback: publishDraft },
  { command: "vscode-hexo-github.addItem", callback: addItem },
  { command: "vscode-hexo-github.addSite", callback: addSite },
  { command: "vscode-hexo-github.deleteSite", callback: deleteSite },
  { command: "vscode-hexo-github.deleteItem", callback: deleteItem },
  { command: "vscode-hexo-github.deleteTheme", callback: deleteTheme },
  { command: "vscode-hexo-github.applyTheme", callback: applyTheme },
  { command: "vscode-hexo-github.addTheme", callback: addTheme },
  {
    command: "vscode-hexo-github.refreshTreeview",
    callback: (element: TreeItem, context: vscode.ExtensionContext) =>
      refreshBlogsProvider(context),
  },
];

export const registerCommands = (context: vscode.ExtensionContext) => {
  commands.forEach(({ command, callback }) => {
    context.subscriptions.push(
      vscode.commands.registerCommand(command, (element) =>
        callback(element, context)
      )
    );
  });
};
