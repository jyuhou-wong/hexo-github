import * as vscode from "vscode";
import {
  loginToGitHub,
  logoutFromGitHub,
  openPage,
  openPageRepository,
  openSourceRepository,
  pullHexoRepository,
  pushHexoRepository,
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
  { command: "hexo-github.deploy", callback: deployBlog },
  { command: "hexo-github.loginToGitHub", callback: loginToGitHub },
  { command: "hexo-github.logoutFromGitHub", callback: logoutFromGitHub },
  { command: "hexo-github.pullHexo", callback: pullHexoRepository },
  { command: "hexo-github.pushHexo", callback: pushHexoRepository },
  { command: "hexo-github.openSourceGit", callback: openSourceRepository },
  { command: "hexo-github.openPageGit", callback: openPageRepository },
  { command: "hexo-github.openPage", callback: openPage },
  { command: "hexo-github.localPreview", callback: localPreview },
  { command: "hexo-github.publish", callback: publishDraft },
  { command: "hexo-github.addItem", callback: addItem },
  { command: "hexo-github.addSite", callback: addSite },
  { command: "hexo-github.deleteSite", callback: deleteSite },
  { command: "hexo-github.deleteItem", callback: deleteItem },
  { command: "hexo-github.deleteTheme", callback: deleteTheme },
  { command: "hexo-github.applyTheme", callback: applyTheme },
  { command: "hexo-github.addTheme", callback: addTheme },
  {
    command: "hexo-github.refreshTreeview",
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
