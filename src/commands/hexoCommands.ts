import { Uri } from "vscode";
import * as vscode from "vscode";
import {
  getHexoConfig,
  getPreviewRoute,
  handleCreateFile,
  hexoExec,
} from "../services/hexoService";
import open from "open";
import {
  createDirectory,
  execAsync,
  executeUserCommand,
  formatAddress,
  getRandomAvailablePort,
  handleError,
  installNpmModule,
  isModuleExisted,
  isValidPath,
  openFile,
  promptForName,
  refreshBlogsProvider,
  revealItem,
  searchNpmPackages,
} from "../utils";
import {
  checkRepoExists,
  deleteRemoteRepo,
  getOctokitInstance,
  initializeSite,
  pushHexo,
  pushToGitHubPages,
} from "../services/githubService";
import type { Server } from "http";
import {
  DRAFTS_DIRNAME,
  POSTS_DIRNAME,
  EXT_HOME_DIR,
} from "../services/config";
import { basename, join, sep } from "path";
import { existsSync, rmSync } from "fs";
import {
  BlogsTreeDataProvider,
  TreeItem,
} from "../providers/blogsTreeDataProvider";
import simpleGit from "simple-git";

interface ServerObj {
  server: Server;
  address: string;
}

const servers: Map<string, ServerObj> = new Map();
const serversStatus: Map<string, boolean> = new Map();

// Execute Hexo command
export const executeHexoCommand = async (
  element: TreeItem,
  _context: vscode.ExtensionContext
) => {
  const { siteDir } = element;
  await executeUserCommand(
    "Please enter a command without hexo, e.g., new --path test/test",
    (cmd) => hexoExec(siteDir, cmd)
  );
};

// 主函数
export const addItem = async (
  element: TreeItem,
  context: vscode.ExtensionContext
) => {
  try {
    const { siteDir, resourceUri, label } = element;

    const config = await getHexoConfig(siteDir);

    // 检查是否是根目录
    if (!resourceUri) {
      // 处理页面
      if (label === BlogsTreeDataProvider.getLabel()) {
        const name = await promptForName("Please enter the page name");
        if (!name) return;
        await handleCreateFile(siteDir, name, "Page", context); // 创建页面
      }
      // 处理草稿
      else if (label === BlogsTreeDataProvider.getLabel(DRAFTS_DIRNAME)) {
        const name = await promptForName("Please enter the draft name");
        if (!name) return;
        await handleCreateFile(siteDir, name, "Draft", context); // 创建草稿
      }
      // 处理博客
      else if (label === BlogsTreeDataProvider.getLabel(POSTS_DIRNAME)) {
        const options = ["Blog", "Sub Route"];
        const selection = await vscode.window.showQuickPick(options, {
          placeHolder: "Choose an option",
        });

        if (!selection) return;

        if (selection === "Sub Route") {
          const name = await promptForName("Please enter the sub route name");
          if (!name) return;
          const path = join(siteDir, config.source_dir, POSTS_DIRNAME, name);
          createDirectory(path); // 创建子目录
        } else {
          const name = await promptForName("Please enter the blog name");
          if (!name) return;
          await handleCreateFile(siteDir, name, "Blog", context); // 创建博客
        }
      }
    } else {
      // 处理在文章目录中创建子路由或博客的逻辑
      const options = ["Blog", "Sub Route"];
      const selection = await vscode.window.showQuickPick(options, {
        placeHolder: "Choose an option",
      });

      if (!selection) return;

      if (selection === "Sub Route") {
        const name = await promptForName("Please enter the sub route name");
        if (!name) return;
        const route = join(element.resourceUri!.fsPath, name);
        createDirectory(route); // 创建子目录
      } else {
        const name = await promptForName("Please enter the blog name");
        if (!name) return;
        await handleCreateFile(
          siteDir,
          name,
          "Blog",
          context,
          element.resourceUri?.fsPath
        ); // 创建博客
      }
    }
  } catch (error) {
    handleError(error, "Failed to create item");
  }
};

// Create a new Hexo blog post
export const createNewBlogPost = async (
  element: TreeItem,
  context: vscode.ExtensionContext
) => {
  try {
    const { siteDir } = element;

    const path = await vscode.window.showInputBox({
      placeHolder: "e.g., about/My first blog",
    });

    if (!path) return;

    if (!isValidPath(path)) throw new Error("Path is invalid");

    const config = await getHexoConfig(siteDir);
    const postPath = join(
      siteDir,
      config.source_dir,
      POSTS_DIRNAME,
      `${path}.md`
    );

    if (existsSync(postPath)) throw new Error("Blog is existed");

    await hexoExec(siteDir, `new --path "${path}"`);

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
const updateServerStatus = (siteName: string, status: boolean): void => {
  vscode.commands.executeCommand(
    "setContext",
    "hexo-github.serversStatus.get(siteName)",
    status
  );
  serversStatus.set(siteName, status);
};

// Start Hexo server
export const startHexoServer = async (
  element: TreeItem,
  _context: vscode.ExtensionContext
) => {
  const { siteName, siteDir } = element;
  vscode.window.showInformationMessage("Starting server...");
  try {
    const port = await getRandomAvailablePort();
    const server = await hexoExec(
      siteDir,
      `server --draft --debug --port ${port}`
    );
    const { address } = server.address() as any;
    const url = formatAddress(address, port);

    servers.set(siteName, { server, address: url });

    updateServerStatus(siteName, true);
    vscode.window.showInformationMessage(`Successfully started server: ${url}`);
  } catch (error) {
    handleError(error, "Failed to start Hexo server");
  }
};

// Stop Hexo server
export const stopHexoServer = async (
  element: TreeItem,
  _context: vscode.ExtensionContext
) => {
  try {
    const { siteName } = element;
    const { server } = servers.get(siteName)!;
    server.close();
    updateServerStatus(siteName, false);
    vscode.window.showInformationMessage("Successfully stoped server");
  } catch (error) {
    handleError(error, "Failed to stop Hexo server");
  }
};

// Start Hexo server
export const publishDraft = async (
  element: TreeItem,
  context: vscode.ExtensionContext
) => {
  const { siteDir, resourceUri } = element;
  const name = basename(resourceUri!.fsPath, ".md");
  try {
    await hexoExec(siteDir, `publish ${name} --debug`);

    const config = await getHexoConfig(siteDir);
    const postPath = join(
      siteDir,
      config.source_dir,
      POSTS_DIRNAME,
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
  element: TreeItem,
  _context: vscode.ExtensionContext
) => {
  vscode.window.showInformationMessage("Deploying...");
  try {
    await pushToGitHubPages(element);
    vscode.window.showInformationMessage(
      "Successfully deployed blog to GitHub pages"
    );
  } catch (error) {
    handleError(error, "Failed to deploy blog to GitHub pages");
  }
};

// Open Blog Local Preview
export const localPreview = async (
  element: TreeItem,
  context: vscode.ExtensionContext
) => {
  const {
    siteName,
    siteDir,
    resourceUri: { fsPath } = { fsPath: "" },
  } = element;

  // 同时打开文件在活动编辑器
  vscode.commands.executeCommand("vscode.open", Uri.file(fsPath));

  if (!fsPath) return;

  vscode.window.showInformationMessage("Opening...");
  try {
    if (!serversStatus.get(siteName)) await startHexoServer(element, context);
    const { address } = servers.get(siteName)!;
    const route = await getPreviewRoute(siteDir, fsPath);
    open(address + route);
  } catch (error) {
    handleError(error, "Failed to preview");
  }
};

// Apply theme
export const applyTheme = async (
  element: TreeItem,
  context: vscode.ExtensionContext
) => {
  const {
    siteName,
    siteDir,
    label,
    resourceUri: { fsPath } = { fsPath: "" },
  } = element;
  -(
    // 同时打开文件在活动编辑器
    vscode.commands.executeCommand("vscode.open", Uri.file(fsPath))
  );

  if (!fsPath) return;

  vscode.window.showInformationMessage("Applying...");
  try {
    // 应用主题
    await hexoExec(siteDir, `config theme ${label} --debug`);

    // 清除缓存
    await hexoExec(siteDir, "clean --debug");

    // 停止服务器
    if (serversStatus.get(siteName)) {
      await stopHexoServer(element, context);
      await startHexoServer(element, context);
    }

    vscode.window.showInformationMessage(
      `Successfully applied the theme "${label}".`
    );
  } catch (error) {
    handleError(error, "Failed to apply themee");
  }
};

// add theme
export const addTheme = async (
  element: TreeItem,
  context: vscode.ExtensionContext
) => {
  const { siteDir } = element;
  vscode.window.showInformationMessage("Loading...");

  const options = await searchNpmPackages("hexo-theme-", /^hexo-theme-[^-]+$/);
  const selection = await vscode.window.showQuickPick(options, {
    placeHolder: "Choose an option",
  });

  if (!selection) return;

  vscode.window.showInformationMessage("Installing...");

  try {
    await installNpmModule(siteDir, selection);

    refreshBlogsProvider(context);
  } catch (error) {
    handleError(error, "Failed to test");
  }
};

export const deleteTheme = async (
  element: TreeItem,
  context: vscode.ExtensionContext
): Promise<boolean> => {
  const { siteDir, label } = element;

  const themePath = join(siteDir, "themes", label);
  const themeConfigPath = join(siteDir, `_config.${label}.yml`);

  // Ask for user confirmation
  const confirmation = await vscode.window.showWarningMessage(
    `Delete "${label}" theme?`,
    { modal: true },
    "Delete"
  );

  if (confirmation !== "Delete") return false;

  // Return an empty array if the themes directory does not exist
  if (existsSync(themePath)) {
    try {
      rmSync(themePath, { recursive: true, force: true });
      vscode.window.showInformationMessage(
        `Successfully deleted "${label}" Theme.`
      );
    } catch (error) {
      handleError(error, `Error deleting "${label}" Theme.`);
    }
  }

  if (isModuleExisted(siteDir, `hexo-theme-${label}`)) {
    try {
      await execAsync(`npm uninstall hexo-theme-${label}`, {
        cwd: siteDir,
      });
      vscode.window.showInformationMessage(
        `"hexo-theme-${label}" npm module uninstalled successfully.`
      );
    } catch (error) {
      handleError(
        error,
        `Error uninstalling "hexo-theme-${label}" npm module .`
      );
    }
  }

  if (existsSync(themeConfigPath)) {
    const confirmation = await vscode.window.showWarningMessage(
      `Keep "${label}" Theme config?`,
      { modal: true },
      "Keep",
      "Delete"
    );

    if (confirmation === "Delete") {
      try {
        rmSync(themeConfigPath, { recursive: true, force: true });
        vscode.window.showInformationMessage(
          `Successfully deleted "${label}" Theme config.`
        );
      } catch (error) {
        handleError(error, `Error deleting "${label}" Theme config.`);
      }
    }
  }

  refreshBlogsProvider(context);
  return true; // Return the array of TreeItem representing themes
};

// add theme
export const addSite = async (
  element: TreeItem,
  context: vscode.ExtensionContext
) => {
  try {
    const siteName = await promptForName("Please enter the site name");
    if (!siteName) return;

    const octokit = await getOctokitInstance();
    const repoExists = await checkRepoExists(octokit, siteName);

    if (repoExists) {
      throw Error(`Site "${siteName}" already exists on github.`);
    }

    const siteDir = join(EXT_HOME_DIR, siteName);

    await initializeSite(siteDir);
    refreshBlogsProvider(context);
    await pushToGitHubPages({ siteDir, siteName } as TreeItem);
    await pushHexo();
  } catch (error) {
    handleError(error);
  }
};

export const deleteSite = async (
  element: TreeItem,
  context: vscode.ExtensionContext
): Promise<boolean> => {
  const { siteName, siteDir, label } = element;

  // Ask for user confirmation
  const confirmation = await vscode.window.showWarningMessage(
    `Delete "${label}" site?`,
    { modal: true },
    "Delete"
  );

  if (confirmation !== "Delete") return false;

  // Return an empty array if the themes directory does not exist
  if (existsSync(siteDir)) {
    try {
      rmSync(siteDir, { recursive: true, force: true });
      vscode.window.showInformationMessage(
        `Successfully deleted "${label}" site.`
      );
    } catch (error) {
      handleError(error, `Error deleting "${label}" site.`);
    }
  }

  const octokit = await getOctokitInstance();
  const repoExists = await checkRepoExists(octokit, siteName);

  const { data: user } = await octokit.rest.users.getAuthenticated();
  const loginName = user.login;

  if (repoExists) {
    const confirmation = await vscode.window.showWarningMessage(
      `Keep "${label}" github page?`,
      { modal: true },
      "Keep",
      "Delete"
    );

    if (confirmation === "Delete") {
      try {
        await deleteRemoteRepo(octokit, loginName, siteName);
      } catch (error) {
        handleError(error, `Error deleting "${label}" theme config.`);
      }
    }
  }

  return true;
};

// Test something
export const testSomething = async () => {
  try {
    vscode.window.showInformationMessage("Test completed successfully");
  } catch (error) {
    handleError(error, "Failed to test");
  }
};
