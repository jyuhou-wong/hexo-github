import { Uri } from "vscode";
import * as vscode from "vscode";
import {
  getHexoConfig,
  getPreviewUrl,
  handleCreateFile,
  hexoExec,
} from "../services/hexoService";
import open from "open";
import {
  createDirectory,
  executeUserCommand,
  formatAddress,
  handleError,
  isValidPath,
  openFile,
  promptForName,
  revealItem,
  searchNpmPackages,
} from "../utils";
import { pushToGitHubPages } from "../services/githubService";
import type { Server } from "http";
import {
  EXT_HEXO_STARTER_DIR,
  SOURCE_DRAFTS_DIRNAME,
  SOURCE_POSTS_DIRNAME,
} from "../services/config";
import { basename, join, sep } from "path";
import { existsSync } from "fs";
import { BlogsTreeDataProvider } from "../providers/blogsTreeDataProvider";

let server: Server;
let serverStatus: boolean = false;

// Execute Hexo command
export const executeHexoCommand = async (_context: vscode.ExtensionContext) => {
  await executeUserCommand(
    "Please enter a command without hexo, e.g., new --path test/test",
    hexoExec
  );
};

// 主函数
export const addItem = async (args: any, context: vscode.ExtensionContext) => {
  try {
    const config = await getHexoConfig();

    // 检查是否是根目录
    if (!args.resourceUri) {
      const label = args.label;

      // 处理页面
      if (label === BlogsTreeDataProvider.getLabel()) {
        const name = await promptForName("Please enter the page name");
        if (!name) return; // 验证名称
        await handleCreateFile(name, "Page", context); // 创建页面
      }
      // 处理草稿
      else if (
        label === BlogsTreeDataProvider.getLabel(SOURCE_DRAFTS_DIRNAME)
      ) {
        const name = await promptForName("Please enter the draft name");
        if (!name) return; // 验证名称
        await handleCreateFile(name, "Draft", context); // 创建草稿
      }
      // 处理博客
      else if (label === BlogsTreeDataProvider.getLabel(SOURCE_POSTS_DIRNAME)) {
        const options = ["Blog", "Sub Route"];
        const selection = await vscode.window.showQuickPick(options, {
          placeHolder: "Choose an option",
        });

        if (selection === "Sub Route") {
          const name = await promptForName("Please enter the sub route name");
          if (!name) return; // 验证名称
          const path = join(
            EXT_HEXO_STARTER_DIR,
            config.source_dir,
            SOURCE_POSTS_DIRNAME,
            name
          );
          createDirectory(path); // 创建子目录
        } else {
          const name = await promptForName("Please enter the blog name");
          if (!name) return; // 验证名称
          await handleCreateFile(name, "Blog", context); // 创建博客
        }
      }
    } else {
      // 处理在文章目录中创建子路由或博客的逻辑
      const options = ["Blog", "Sub Route"];
      const selection = await vscode.window.showQuickPick(options, {
        placeHolder: "Choose an option",
      });

      if (selection === "Sub Route") {
        const name = await promptForName("Please enter the sub route name");
        if (!name) return; // 验证名称
        const route = join(args.resourceUri?.fsPath, name);
        createDirectory(route); // 创建子目录
      } else {
        const name = await promptForName("Please enter the blog name");
        if (!name) return; // 验证名称
        await handleCreateFile(name, "Blog", context, args.resourceUri?.fsPath); // 创建博客
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

// Start Hexo server
export const publishDraft = async (
  args: any,
  context: vscode.ExtensionContext
) => {
  const name = basename(args.resourceUri.fsPath, ".md");
  try {
    await hexoExec(`publish ${name} --debug`);

    const config = await getHexoConfig();
    const postPath = join(
      EXT_HEXO_STARTER_DIR,
      config.source_dir,
      SOURCE_POSTS_DIRNAME,
      `${name}.md`
    );

    await openFile(postPath);
    revealItem(Uri.file(postPath), context);

    vscode.window.showInformationMessage(`Successfully published ${name}`);
  } catch (error) {
    handleError(error, `Failed to publish ${name}`);
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

// Apply theme
export const applyTheme = async (
  args: any,
  context: vscode.ExtensionContext
) => {
  const filePath = args?.resourceUri?.fsPath ?? args?.fsPath;
  const themeName = args?.label;

  // 同时打开文件在活动编辑器
  vscode.commands.executeCommand("vscode.open", Uri.file(filePath));

  if (filePath) {
    try {
      vscode.window.showInformationMessage("Applying...");

      // 应用主题
      await hexoExec(`config theme ${themeName} --debug`);

      // 清除缓存
      await hexoExec("clean --debug");

      // 停止服务器
      if (serverStatus) {
        await stopHexoServer(args, context);
        await startHexoServer(args, context);
      }

      vscode.window.showInformationMessage(
        `Successfully applied the theme "${themeName}".`
      );
    } catch (error) {
      handleError(error, "Failed to apply themee");
    }
  }
};

// add theme
export const addTheme = async (
  _args: any,
  _context: vscode.ExtensionContext
) => {
  const options = await searchNpmPackages("hexo-theme-", /^hexo-theme-[^-]+$/);
  const selection = await vscode.window.showQuickPick(options, {
    placeHolder: "Choose an option",
  });

  console.log(selection);
};

// Test something
export const testSomething = async () => {
  try {
    // await searchNpmPackages("hexo-theme-", /^hexo-theme-[^-]+$/);
    vscode.window.showInformationMessage("Test completed successfully");
  } catch (error) {
    handleError(error, "Failed to test");
  }
};
