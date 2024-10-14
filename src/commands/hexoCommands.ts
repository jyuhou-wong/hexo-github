import * as vscode from "vscode";
import { getRouteById, hexoExec } from "../services/hexoService";
import open from "open";

// Execute Hexo command
export const executeHexoCommand = async (context: vscode.ExtensionContext) => {
  const userInput = await vscode.window.showInputBox({
    placeHolder: "Please enter a command, e.g., new --path test/test",
  });

  if (userInput) {
    const cmd = userInput.replace(/^\s*hexo\s*/i, "").trim();
    try {
      const result = await hexoExec(cmd);
      vscode.window.showInformationMessage(result);
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to execute Hexo command: ${error.message}`
      );
    }
  } else {
    vscode.window.showWarningMessage("No command entered!");
  }
};

// Create a new Hexo blog post
export const createNewBlogPost = async () => {
  try {
    const userInput = await vscode.window.showInputBox({
      placeHolder: "Please enter a command, e.g., new --path test/test",
    });

    if (userInput) {
      const cmd = userInput.replace(/^\s*hexo\s*/i, "").trim();
      try {
        await hexoExec(cmd);
        vscode.window.showInformationMessage("Successfully created new blog");
      } catch (error) {
        vscode.window.showErrorMessage(
          `Failed to execute Hexo command: ${error.message}`
        );
      }
    } else {
      vscode.window.showWarningMessage("No command entered!");
    }
  } catch (error) {
    vscode.window.showErrorMessage(
      `Failed to create new blog: ${error.message}`
    );
  }
};

// Start Hexo server
export const startHexoServer = async () => {
  try {
    await hexoExec("server");
    vscode.window.showInformationMessage("Successfully started server");
  } catch (error) {
    vscode.window.showErrorMessage(
      `Failed to start Hexo server: ${error.message}`
    );
  }
};

// Open Blog Local Preveiw
export const openBlogLocalPreview = async () => {

  const editor = vscode.window.activeTextEditor;
  if (editor) {
      const document = editor.document;
      const filePath = document.uri.fsPath; // 获取文件路径

      try {
        const url = await getRouteById(filePath);
        open(url)
      } catch (error) {
        vscode.window.showErrorMessage(
          `Failed to preview: ${error.message}`
        );
      }
  } else {
      vscode.window.showInformationMessage('No active editor found.');
  }
}

// testSomething
export const testSomething = async () => {

  const editor = vscode.window.activeTextEditor;
  if (editor) {
      const document = editor.document;
      const filePath = document.uri.fsPath; // 获取文件路径

      try {
        let test = await getRouteById(filePath);
        vscode.window.showInformationMessage(test);
      } catch (error) {
        vscode.window.showErrorMessage(
          `Failed to test: ${error.message}`
        );
      }
  } else {
      vscode.window.showInformationMessage('No active editor found.');
  }


};
