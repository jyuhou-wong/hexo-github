import * as vscode from "vscode";
import { hexoExec, pullHexoRepo, pushToHexoRepo } from "./hexo"; // Import the functions for cloning and pushing
import { startOAuthLogin } from "./github";

export function activate(context: vscode.ExtensionContext) {
  // Register command for logging into GitHub
  const loginCommand = vscode.commands.registerCommand(
    "hexo-github.loginToGitHub",
    async () => {
      try {
        await startOAuthLogin(); // Assuming this function is exported from github.ts
        vscode.window.showInformationMessage(
          "Logged into GitHub successfully!"
        );
      } catch (error) {
        vscode.window.showErrorMessage(`Login failed: ${error.message}`);
      }
    }
  );

  // Register command for cloning the hexo repository
  const cloneCommand = vscode.commands.registerCommand(
    "hexo-github.pullHexoRepo",
    async () => {
      try {
        await pullHexoRepo();
        vscode.window.showInformationMessage(
          "Hexo repository cloned successfully!"
        );
      } catch (error) {
        vscode.window.showErrorMessage(`Cloning failed: ${error.message}`);
      }
    }
  );

  // Register command for pushing to the hexo repository
  const pushCommand = vscode.commands.registerCommand(
    "hexo-github.pushToHexoRepo",
    async () => {
      try {
        await pushToHexoRepo();
        vscode.window.showInformationMessage(
          "Pushed to Hexo repository successfully!"
        );
      } catch (error) {
        vscode.window.showErrorMessage(`Pushing failed: ${error.message}`);
      }
    }
  );

  // Add commands to the context
  context.subscriptions.push(loginCommand, cloneCommand, pushCommand);

  const cmd = vscode.commands.registerCommand("hexo-github.cmd", async () => {
    // 显示输入框
    const userInput = await vscode.window.showInputBox({
      placeHolder: "请输入命令，例如：new --path test/test",
    });

    // 检查用户是否输入了命令
    if (userInput) {
      const cmd = userInput.replace(/^\s*hexo\s*/i, "").trim();
      const result = hexoExec(cmd);
      vscode.window.showInformationMessage(result);
    } else {
      vscode.window.showWarningMessage("没有输入任何命令!");
    }
  });

  const server = vscode.commands.registerCommand("hexo-github.server", () => {
    const result = hexoExec("server");
    vscode.window.showInformationMessage(result);
  });

  const newBlog = vscode.commands.registerCommand("hexo-github.new", () => {
    const result = hexoExec("new --path test/test");
    vscode.window.showInformationMessage(result);
  });

  context.subscriptions.push(cmd, server, newBlog);
}

// This method is called when your extension is deactivated
export function deactivate() {}
