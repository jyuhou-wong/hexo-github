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
  localPreview,
  stopHexoServer,
} from "./hexoCommands";

// Register all commands
const commands = [
  { command: "hexo-github.loginToGitHub", callback: loginToGitHub },
  { command: "hexo-github.pullHexoRepo", callback: pullHexoRepository },
  { command: "hexo-github.pushHexoRepo", callback: pushHexoRepository },
  { command: "hexo-github.cmd", callback: executeHexoCommand },
  { command: "hexo-github.new", callback: createNewBlogPost },
  { command: "hexo-github.startServer", callback: startHexoServer },
  { command: "hexo-github.stopServer", callback: stopHexoServer },
  { command: "hexo-github.localPreview", callback: localPreview },
  { command: "hexo-github.test", callback: testSomething },
];

export const registerCommands = (context: vscode.ExtensionContext) => {
  commands.forEach(({ command, callback }) => {
    context.subscriptions.push(
      vscode.commands.registerCommand(command, callback)
    );
  });
};
