import { Uri } from "vscode";
import * as vscode from "vscode";
import {
  getHexoConfig,
  getPreviewUrl,
  hexoExec,
} from "../services/hexoService";
import open from "open";
import {
  createDirectory,
  formatAddress,
  handleError,
  isValidFileName,
  isValidPath,
  openFile,
  promptForName,
  revealItem,
} from "../utils";
import { pushToGitHubPages } from "../services/githubService";
import type { Server } from "http";
import {
  EXT_HEXO_STARTER_DIR,
  SOURCE_DRAFTS_DIRNAME,
  SOURCE_POSTS_DIRNAME,
} from "../services/config";
import { basename, join, sep } from "path";
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

// 处理创建文件的通用逻辑
const handleCreateFile = async (
  name: string,
  type: string,
  context: vscode.ExtensionContext,
  parentPath?: string
) => {
  const config = await getHexoConfig();
  let path: string;

  if (type === "Page") {
    path = join(
      EXT_HEXO_STARTER_DIR,
      config.source_dir,
      parentPath || name,
      "index.md"
    );
    if (existsSync(path)) throw new Error(`Page ${name} already exists`);
    await hexoExec(`new page "${name}"`);
  } else if (type === "Draft") {
    path = join(
      EXT_HEXO_STARTER_DIR,
      config.source_dir,
      SOURCE_DRAFTS_DIRNAME,
      `${name}.md`
    );
    if (existsSync(path)) throw new Error(`Draft ${name} already exists`);
    await hexoExec(`new draft "${name}"`);
  } else {
    // Assume it's a Blog
    const postDir = join(
      EXT_HEXO_STARTER_DIR,
      config.source_dir,
      SOURCE_POSTS_DIRNAME
    );

    const relativePath = parentPath
      ? parentPath.substring(postDir.length + sep.length).replace(/[/\\]/g, "/")
      : "";

    path = join(parentPath ?? postDir, `${name}.md`);
    if (existsSync(path)) {
      await openFile(path);
      await revealItem(Uri.file(path), context);
      throw new Error(`Blog ${name} already exists`);
    }
    await hexoExec(`new --path "${relativePath}/${name}"`);
  }

  await openFile(path);
  await revealItem(Uri.file(path), context);
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
        const options = ["Sub Route", "Blog"];
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
      const options = ["Sub Route", "Blog"];
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
