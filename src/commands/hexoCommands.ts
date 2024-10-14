import * as vscode from "vscode";
import { getPreviewUrl, hexoExec } from "../services/hexoService";
import open from "open";
import { handleError } from "../utils";
import { pushToGitHubPages } from "../services/githubService";

const executeUserCommand = async (
  placeholder: string,
  action: (cmd: string) => Promise<void>
) => {
  const userInput = await vscode.window.showInputBox({
    placeHolder: placeholder,
  });
  if (userInput) {
    const cmd = userInput.replace(/^\s*hexo\s*/i, "").trim();
    try {
      await action(cmd);
    } catch (error) {
      handleError(error, "Failed to execute command");
    }
  } else {
    vscode.window.showWarningMessage("No command entered!");
  }
};

// Execute Hexo command
export const executeHexoCommand = async () => {
  await executeUserCommand(
    "Please enter a command without hexo, e.g., new --path test/test",
    hexoExec
  );
};

// Create a new Hexo blog post
export const createNewBlogPost = async () => {
  try {
    const path = await vscode.window.showInputBox({
      placeHolder: "Please enter the path, e.g., about/My first blog",
    });
    await hexoExec(`new --path "${path}"`)
    vscode.window.showInformationMessage("Successfully created Blog");
  } catch (error) {
    handleError(error, "Failed to start Hexo server");
  }
};

// Start Hexo server
export const startHexoServer = async () => {
  try {
    await hexoExec("server");
    vscode.window.showInformationMessage("Successfully started server");
  } catch (error) {
    handleError(error, "Failed to start Hexo server");
  }
};

// Deploy Blog
export const deployBlog = async () => {
  try {
    await pushToGitHubPages();
    vscode.window.showInformationMessage(
      "Successfully deployed blog to GitHub pages"
    );
  } catch (error) {
    handleError(error, "Failed to deploy blog to GitHub pages");
  }
};

// Open Blog Local Preview
export const openBlogLocalPreview = async () => {
  const editor = vscode.window.activeTextEditor;
  if (editor) {
    const document = editor.document;
    const filePath = document.uri.fsPath;

    try {
      const url = await getPreviewUrl(filePath);
      open(url);
    } catch (error) {
      handleError(error, "Failed to preview");
    }
  } else {
    vscode.window.showInformationMessage("No active editor found.");
  }
};

// Test something
export const testSomething = async () => {
  try {
    await deployBlog();
    vscode.window.showInformationMessage("Test completed successfully");
  } catch (error) {
    handleError(error, "Failed to test");
  }
};
