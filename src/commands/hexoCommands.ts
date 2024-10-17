import { Uri } from "vscode";
import * as vscode from "vscode";
import {
  getHexoConfig,
  getPreviewUrl,
  hexoExec,
} from "../services/hexoService";
import open from "open";
import { formatAddress, handleError, isValidPath, revealItem } from "../utils";
import { pushToGitHubPages } from "../services/githubService";
import type { Server } from "http";
import { EXT_HEXO_STARTER_DIR, SOURCE_POSTS_DIRNAME } from "../services/config";
import { basename, join } from "path";
import { existsSync } from "fs";

let server: Server;
let serverStatus: boolean = false;

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
export const executeHexoCommand = async (context: vscode.ExtensionContext) => {
  await executeUserCommand(
    "Please enter a command without hexo, e.g., new --path test/test",
    hexoExec
  );
};

// Create a new Hexo blog post
export const createNewBlogPost = async (context: vscode.ExtensionContext) => {
  try {
    const path = await vscode.window.showInputBox({
      placeHolder: "e.g., about/My first blog",
    });

    if (!path) return;

    if (!isValidPath(path)) throw new Error("Path is invalid");

    const config = await getHexoConfig();
    const postPath = join(
      EXT_HEXO_STARTER_DIR,
      config.source_dir,
      SOURCE_POSTS_DIRNAME,
      `${path}.md`
    );

    if (existsSync(postPath)) throw new Error("Blog is existed");

    await hexoExec(`new --path "${path}"`);

    // 打开文件进行编辑
    const document = await vscode.workspace.openTextDocument(postPath);
    await vscode.window.showTextDocument(document);
    vscode.window.showInformationMessage(
      `Blog ${basename(path)} created and opened for editing.`
    );

    await revealItem(Uri.file(postPath), context);
  } catch (error) {
    handleError(error, "Failed to create new blog");
  }
};

// Function to update the command title based on server status
const updateServerStatus = (status: boolean): void => {
  vscode.commands.executeCommand(
    "setContext",
    "hexo-github.serverStatus",
    status
  );
  serverStatus = status;
};

// Start Hexo server
export const startHexoServer = async (context: vscode.ExtensionContext) => {
  try {
    vscode.window.showInformationMessage("Starting server...");
    server = await hexoExec("server --draft --debug");
    const { address, port } = server.address() as any;
    const url = formatAddress(address, port);
    updateServerStatus(true);
    vscode.window.showInformationMessage(`Successfully started server: ${url}`);
  } catch (error) {
    handleError(error, "Failed to start Hexo server");
  }
};

// Stop Hexo server
export const stopHexoServer = async (context: vscode.ExtensionContext) => {
  try {
    server.close();
    updateServerStatus(false);
    vscode.window.showInformationMessage("Successfully stoped server");
  } catch (error) {
    handleError(error, "Failed to stop Hexo server");
  }
};

// Deploy Blog
export const deployBlog = async (context: vscode.ExtensionContext) => {
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
export const localPreview = async (context: vscode.ExtensionContext) => {
  const editor = vscode.window.activeTextEditor;
  if (editor) {
    const document = editor.document;
    const filePath = document.uri.fsPath;

    try {
      vscode.window.showInformationMessage("Opening...");

      if (!serverStatus) await startHexoServer(context);

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
    vscode.window.showInformationMessage("Test completed successfully");
  } catch (error) {
    handleError(error, "Failed to test");
  }
};
