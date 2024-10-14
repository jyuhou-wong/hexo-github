import * as vscode from "vscode";
import {
  loginToGitHub,
  pullHexoRepository,
  pushHexoRepository,
} from "./githubCommands";
import {
  executeHexoCommand,
  createNewBlogPost,
  startHexoServer,
  testSomething,
  openBlogLocalPreview,
} from "./hexoCommands";

// Register all commands
const commands = [
  { command: "hexo-github.loginToGitHub", callback: loginToGitHub },
  { command: "hexo-github.pullHexoRepo", callback: pullHexoRepository },
  { command: "hexo-github.pushHexoRepo", callback: pushHexoRepository },
  { command: "hexo-github.cmd", callback: executeHexoCommand },
  { command: "hexo-github.new", callback: createNewBlogPost },
  { command: "hexo-github.server", callback: startHexoServer },
  { command: "hexo-github.localPreview", callback: openBlogLocalPreview },
  { command: "hexo-github.test", callback: testSomething },
];

export const registerCommands = (context: vscode.ExtensionContext) => {
  commands.forEach(({ command, callback }) => {
    context.subscriptions.push(
      vscode.commands.registerCommand(command, callback)
    );
  });
};
