import * as vscode from "vscode";
import {
  loginToGitHub,
  openPage,
  openPageRepository,
  openSourceRepository,
  pullHexoRepository,
  pushHexoRepository,
} from "./githubCommands";
import {
  executeHexoCommand,
  createNewBlogPost,
  startHexoServer,
  testSomething,
  localPreview,
  stopHexoServer,
  deployBlog,
  addItem,
  publishDraft,
  applyTheme,
  addTheme,
  deleteTheme,
} from "./hexoCommands";
import { deleteItem } from "../utils";

// Register all commands
const commands = [
  { command: "hexo-github.deploy", callback: deployBlog },
  { command: "hexo-github.loginToGitHub", callback: loginToGitHub },
  { command: "hexo-github.pullHexo", callback: pullHexoRepository },
  { command: "hexo-github.pushHexo", callback: pushHexoRepository },
  { command: "hexo-github.openSourceGit", callback: openSourceRepository },
  { command: "hexo-github.openPageGit", callback: openPageRepository },
  { command: "hexo-github.openPage", callback: openPage },
  { command: "hexo-github.cmd", callback: executeHexoCommand },
  { command: "hexo-github.new", callback: createNewBlogPost },
  { command: "hexo-github.startServer", callback: startHexoServer },
  { command: "hexo-github.stopServer", callback: stopHexoServer },
  { command: "hexo-github.localPreview", callback: localPreview },
  { command: "hexo-github.publish", callback: publishDraft },
  { command: "hexo-github.addItem", callback: addItem },
  { command: "hexo-github.deleteItem", callback: deleteItem },
  { command: "hexo-github.deleteTheme", callback: deleteTheme },
  { command: "hexo-github.applyTheme", callback: applyTheme },
  { command: "hexo-github.addTheme", callback: addTheme },
  { command: "hexo-github.test", callback: testSomething },
];

export const registerCommands = (context: vscode.ExtensionContext) => {
  commands.forEach(({ command, callback }) => {
    context.subscriptions.push(
      vscode.commands.registerCommand(command, (args) =>
        callback(args, context)
      )
    );
  });
};
