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

// 注册所有命令
export const registerCommands = (context: vscode.ExtensionContext) => {
  const loginCommand = vscode.commands.registerCommand(
    "hexo-github.loginToGitHub",
    loginToGitHub
  );

  const pullCommand = vscode.commands.registerCommand(
    "hexo-github.pullHexoRepo",
    pullHexoRepository
  );

  const pushCommand = vscode.commands.registerCommand(
    "hexo-github.pushHexoRepo",
    pushHexoRepository
  );

  const cmd = vscode.commands.registerCommand(
    "hexo-github.cmd",
    executeHexoCommand
  );

  const newBlogCommand = vscode.commands.registerCommand(
    "hexo-github.new",
    createNewBlogPost
  );

  const serverCommand = vscode.commands.registerCommand(
    "hexo-github.server",
    startHexoServer
  );

  const localPreviewCommand = vscode.commands.registerCommand(
    "hexo-github.localPreview",
    openBlogLocalPreview
  );

  const testCommand = vscode.commands.registerCommand(
    "hexo-github.test",
    testSomething
  );

  context.subscriptions.push(
    loginCommand,
    pullCommand,
    pushCommand,
    cmd,
    newBlogCommand,
    serverCommand,
    localPreviewCommand,
    testCommand
  );
};
