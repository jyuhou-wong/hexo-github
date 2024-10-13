import * as vscode from "vscode";
import { hexoExec, pullHexoRepo, pushToHexoRepo } from "./hexo"; // Import the functions for cloning and pushing
import { startOAuthLogin } from "./github";
import { debug } from "console";

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

  const server = vscode.commands.registerCommand("hexo-github.server", () => {
    // The code you place here will be executed every time your command is executed
    // Display a message box to the user
    hexoExec("server", { _: [], debug: true });
  });

  const newBlog = vscode.commands.registerCommand("hexo-github.new", () => {
    // The code you place here will be executed every time your command is executed
    // Display a message box to the user
    hexoExec("new", { _: [], path: "test/test" });
  });

  context.subscriptions.push(server, newBlog);
}

// This method is called when your extension is deactivated
export function deactivate() {}
