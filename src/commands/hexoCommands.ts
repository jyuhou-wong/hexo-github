import { Uri } from "vscode";
import * as vscode from "vscode";
import {
  getHexoConfig,
  getPreviewUrl,
  hexoExec,
} from "../services/hexoService";
import open from "open";
import {
  formatAddress,
  handleError,
  isValidFileName,
  isValidPath,
  revealItem,
} from "../utils";
import { pushToGitHubPages } from "../services/githubService";
import type { Server } from "http";
import {
  EXT_HEXO_STARTER_DIR,
  SOURCE_DRAFTS_DIRNAME,
  SOURCE_POSTS_DIRNAME,
} from "../services/config";
import { basename, join } from "path";
import { existsSync, mkdirSync } from "fs";
import { BlogsTreeDataProvider } from "../providers/blogsTreeDataProvider";

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
export const executeHexoCommand = async (_context: vscode.ExtensionContext) => {
  await executeUserCommand(
    "Please enter a command without hexo, e.g., new --path test/test",
    hexoExec
  );
};

// Create a new Hexo blog item
export const addItem = async (args: any, context: vscode.ExtensionContext) => {
  const config = await getHexoConfig();

  try {
    // 检查是否是根目录
    if (!args.resourceUri) {
      // 博客
      if (args.label == BlogsTreeDataProvider.getLabel(SOURCE_POSTS_DIRNAME)) {
        const options = ["Sub Route", "Blog"];
        const selection = await vscode.window.showQuickPick(options, {
          placeHolder: "Choose an option",
        });

        if (selection === "Sub Route") {
          const name = await vscode.window.showInputBox({
            placeHolder: "Pleast enter the name",
          });
          if (!name) return;
          if (!isValidFileName(name)) throw new Error("Name is invalid");

          const path = join(
            EXT_HEXO_STARTER_DIR,
            config.source_dir,
            SOURCE_POSTS_DIRNAME,
            name
          );
          if (existsSync(path)) throw new Error(`${name} is existed`);
          mkdirSync(path, { recursive: true });
        } else {
          const name = await vscode.window.showInputBox({
            placeHolder: "Pleast enter the name",
          });
          if (!name) return;
          if (!isValidFileName(name)) throw new Error("Name is invalid");

          const path = join(
            EXT_HEXO_STARTER_DIR,
            config.source_dir,
            SOURCE_POSTS_DIRNAME,
            `${name}.md`
          );
          if (existsSync(path)) throw new Error(`Blog ${name} is existed`);

          await hexoExec(`new "${name}"`);

          // 打开文件进行编辑
          const document = await vscode.workspace.openTextDocument(path);
          await vscode.window.showTextDocument(document);
          vscode.window.showInformationMessage(
            `Blog ${name} created and opened for editing.`
          );

          await revealItem(Uri.file(path), context);
        }
      }

      // 草稿
      else if (
        args.label == BlogsTreeDataProvider.getLabel(SOURCE_DRAFTS_DIRNAME)
      ) {
        const name = await vscode.window.showInputBox({
          placeHolder: "Pleast enter the name",
        });
        if (!name) return;
        if (!isValidFileName(name)) throw new Error("Name is invalid");

        const draftPath = join(
          EXT_HEXO_STARTER_DIR,
          config.source_dir,
          SOURCE_DRAFTS_DIRNAME,
          `${name}.md`
        );

        if (existsSync(draftPath)) throw new Error("Page is existed");

        await hexoExec(`new draft "${name}"`);

        // 打开草稿进行编辑
        const document = await vscode.workspace.openTextDocument(draftPath);
        await vscode.window.showTextDocument(document);
        vscode.window.showInformationMessage(
          `Page ${basename(draftPath)} created and opened for editing.`
        );

        await revealItem(Uri.file(draftPath), context);
      } else if (args.label == BlogsTreeDataProvider.getLabel()) {
        const name = await vscode.window.showInputBox({
          placeHolder: "Pleast enter the name",
        });
        if (!name) return;
        if (!isValidFileName(name)) throw new Error("Name is invalid");

        const pagePath = join(
          EXT_HEXO_STARTER_DIR,
          config.source_dir,
          name,
          "index.md"
        );

        if (existsSync(pagePath)) throw new Error("Page is existed");

        await hexoExec(`new page "${name}"`);

        // 打开文件进行编辑
        const document = await vscode.workspace.openTextDocument(pagePath);
        await vscode.window.showTextDocument(document);
        vscode.window.showInformationMessage(
          `Page ${name} created and opened for editing.`
        );

        await revealItem(Uri.file(pagePath), context);
      }
    } else {
      const options = ["Sub Route", "Blog"];
      const selection = await vscode.window.showQuickPick(options, {
        placeHolder: "Choose an option",
      });

      if (selection === "Sub Route") {
        const name = await vscode.window.showInputBox({
          placeHolder: "Pleast enter the name",
        });
        if (!name) return;
        if (!isValidFileName(name)) throw new Error("Name is invalid");

        const path = join(args.resourceUri.fsPath, name);
        if (existsSync(path)) throw new Error(`${name} is existed`);
        mkdirSync(path, { recursive: true });
      } else {
        const name = await vscode.window.showInputBox({
          placeHolder: "Pleast enter the name",
        });
        if (!name) return;
        if (!isValidFileName(name)) throw new Error("Name is invalid");
        const path = join(args.resourceUri.fsPath, `${name}.md`);

        const postDir = join(
          EXT_HEXO_STARTER_DIR,
          config.source_dir,
          SOURCE_POSTS_DIRNAME
        );

        const relativePath = path
          .substring(postDir.length)
          .replace(/[/\\]/g, "/")
          .replace(/\.md$/i, "");
        if (existsSync(path)) throw new Error(`Blog ${name} is existed`);
        await hexoExec(`new --path "${relativePath}"`);

        // 打开文件进行编辑
        const document = await vscode.workspace.openTextDocument(path);
        await vscode.window.showTextDocument(document);
        vscode.window.showInformationMessage(
          `Blog ${basename(path)} created and opened for editing.`
        );

        await revealItem(Uri.file(path), context);
      }
    }
  } catch (error) {
    handleError(error, "Failed to create item");
  }
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
export const startHexoServer = async (
  _args: any,
  _context: vscode.ExtensionContext
) => {
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
export const stopHexoServer = async (
  _args: any,
  _context: vscode.ExtensionContext
) => {
  try {
    server.close();
    updateServerStatus(false);
    vscode.window.showInformationMessage("Successfully stoped server");
  } catch (error) {
    handleError(error, "Failed to stop Hexo server");
  }
};

// Deploy Blog
export const deployBlog = async (
  _args: any,
  _context: vscode.ExtensionContext
) => {
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
export const localPreview = async (
  args: any,
  context: vscode.ExtensionContext
) => {
  const filePath = args?.resourceUri?.fsPath ?? args?.fsPath;

  // 同时打开文件在活动编辑器
  vscode.commands.executeCommand("vscode.open", Uri.file(filePath));

  if (filePath) {
    try {
      vscode.window.showInformationMessage("Opening...");

      if (!serverStatus) await startHexoServer(args, context);

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
