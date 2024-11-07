import {
  TreeDataProvider,
  EventEmitter,
  Event,
  TreeItemCollapsibleState,
  Uri,
  ExtensionContext,
} from "vscode";
import * as vscode from "vscode";

import { readdir } from "fs/promises";
import { basename, join } from "path";
import {
  POSTS_DIRNAME,
  DRAFTS_DIRNAME,
  STARTER_THEMES_DIRNAME,
  HEXO_CONFIG_NAME,
  EXT_HOME_DIR,
} from "../services/config";
import { getHexoConfig } from "../services/hexoService";
import { existsSync, statSync } from "fs";
import { FSWatcher, watch } from "chokidar";
import { getThemesInPackageJson, getThemesInThemesDir } from "../utils";
import { localAccessToken, localUsername } from "../services/githubService";
import { logMessage } from "../extension";

// Define the TreeItem class which represents each item in the tree
export class TreeItem extends vscode.TreeItem {
  public siteDir: string = "";
  constructor(
    public readonly userName: string,
    public readonly siteName: string,
    public readonly label: string, // Label to display in the tree
    public readonly collapsibleState: vscode.TreeItemCollapsibleState, // State indicating whether the item can be expanded
    public readonly parent?: TreeItem, // Reference to the parent item
    public readonly uri?: Uri
  ) {
    super(label, collapsibleState);
    this.siteDir = join(EXT_HOME_DIR, userName, siteName);
  }
}

// Implement the TreeDataProvider to manage the tree structure
export class BlogsTreeDataProvider implements TreeDataProvider<TreeItem> {
  private _onDidChangeTreeData: EventEmitter<void> = new EventEmitter<void>(); // Event emitter for notifying tree changes
  readonly onDidChangeTreeData: Event<void> = this._onDidChangeTreeData.event; // Event to listen for tree changes
  private sourceDirs: Map<string, string> = new Map();
  private watchers: Map<string, FSWatcher> = new Map(); // File system watcher for monitoring changes
  private uriCache: Map<string, TreeItem> = new Map(); // Cache for storing TreeItems by their URI
  private timeout: NodeJS.Timeout | undefined;

  constructor(private context: ExtensionContext) {
    this.context = context; // Store the extension context
  }

  // Get the label for the directory based on its name
  static getLabel(name: string = "Pages 页面") {
    switch (name) {
      case HEXO_CONFIG_NAME:
        return "Configure 配置";
      case STARTER_THEMES_DIRNAME:
        return "Themes 主题"; // Label for themes directory
      case POSTS_DIRNAME:
        return "Articles 文章"; // Label for posts directory
      case DRAFTS_DIRNAME:
        return "Drafts 草稿"; // Label for drafts directory
      default:
        return "Pages 页面"; // Default label for other directories
    }
  }

  getTreeItem(element: TreeItem): TreeItem {
    return element; // Return the TreeItem itself
  }

  // Get the children of a specified TreeItem
  async getChildren(element?: TreeItem): Promise<TreeItem[]> {
    if (!localAccessToken || !localUsername) {
      return [];
    }

    if (!this.sourceDirs.size) {
      await this.setSourceDirs(EXT_HOME_DIR, localUsername); // Ensure source directory is set
    }

    const { userName, siteName } = element ?? {};

    if (!siteName || !userName) {
      return await this.getRootItems(EXT_HOME_DIR, localUsername);
    }

    if (element?.collapsibleState === 0) {
      return [];
    }

    // 防止新增站点没有缓存
    if (!this.sourceDirs.get(siteName)) {
      await this.setSourceDirs(EXT_HOME_DIR, userName); // Ensure source directory is set
    }

    if (element?.contextValue === "posts") {
      // If the element is the posts directory, get its children
      const postsDir = join(this.sourceDirs.get(siteName)!, POSTS_DIRNAME);
      return await this.getItems(postsDir, element);
    }

    if (element?.contextValue === "drafts") {
      // If the element is the drafts directory, get its children
      const draftsDir = join(this.sourceDirs.get(siteName)!, DRAFTS_DIRNAME);
      return await this.getItems(draftsDir, element);
    }

    if (element?.contextValue === "themes") {
      // If the element is the themes directory, get its children
      return await this.getThemes(element);
    }

    if (element?.contextValue === "pages") {
      // If the element is the main pages label, get the pages
      return await this.getPages(this.sourceDirs.get(siteName)!, element);
    }

    if (element?.contextValue === "site") {
      return await this.getSite(this.sourceDirs.get(siteName)!, element);
    }

    if (element?.uri) {
      // If the element has a resource URI, get its children
      return await this.getItems(element.uri.fsPath, element);
    }

    return [];
  }

  getParent(element: TreeItem): vscode.ProviderResult<TreeItem> {
    return element.parent; // Return the parent of the TreeItem
  }

  // Get the root items for the tree
  private async getRootItems(
    rootDir: string,
    localUsername: string
  ): Promise<TreeItem[]> {
    try {
      const siteDir = join(rootDir, localUsername);
      const dirents = await readdir(siteDir, { withFileTypes: true }); // Read directory entries
      const items = dirents
        .filter(
          (v) =>
            statSync(join(siteDir, v.name)).isDirectory() && v.name !== ".git"
        )
        .map((dirent) => {
          const siteName = dirent.name; // Get label for the directory
          const uri = Uri.file(join(siteDir, siteName));
          const collapsibleState = TreeItemCollapsibleState.Collapsed;
          const item = new TreeItem(
            localUsername,
            siteName,
            siteName,
            collapsibleState,
            undefined,
            uri
          );
          item.contextValue = "site";
          return item;
        });
      return items; // Return the root items
    } catch (err: any) {
      logMessage(err.message, false, "error");
      return Promise.reject(err); // Reject the promise on error
    }
  }

  private async getSite(
    rootDir: string,
    parent: TreeItem
  ): Promise<TreeItem[]> {
    const { userName, siteName } = parent;
    try {
      const dirents = await readdir(rootDir, { withFileTypes: true }); // Read directory entries
      const items = dirents
        .filter((v) => v.name === POSTS_DIRNAME || v.name === DRAFTS_DIRNAME)
        .map((dirent) => {
          const label = BlogsTreeDataProvider.getLabel(dirent.name); // Get label for the directory
          const uri = Uri.file(join(rootDir, dirent.name));
          const collapsibleState =
            dirent.name !== POSTS_DIRNAME
              ? TreeItemCollapsibleState.Expanded
              : TreeItemCollapsibleState.Collapsed; // Set collapsible state
          const item = new TreeItem(
            userName,
            siteName,
            label,
            collapsibleState,
            parent,
            uri
          ); // Create a new TreeItem
          item.contextValue = dirent.name.replace(/^_/, "");
          return item;
        });

      const pages = new TreeItem(
        userName,
        siteName,
        BlogsTreeDataProvider.getLabel(),
        TreeItemCollapsibleState.Expanded,
        parent
      );
      pages.contextValue = "pages";

      const themes = new TreeItem(
        userName,
        siteName,
        BlogsTreeDataProvider.getLabel(STARTER_THEMES_DIRNAME),
        TreeItemCollapsibleState.Collapsed,
        parent
      );
      themes.contextValue = "themes";

      const configUri = Uri.file(
        join(EXT_HOME_DIR, userName, siteName, HEXO_CONFIG_NAME)
      );
      const config = new TreeItem(
        userName,
        siteName,
        BlogsTreeDataProvider.getLabel(HEXO_CONFIG_NAME),
        TreeItemCollapsibleState.None,
        parent,
        configUri
      );
      config.resourceUri = configUri;
      config.command = {
        command: "vscode.open", // Command to open the file
        title: "Open File",
        arguments: [configUri], // Arguments for the command
      };
      config.contextValue = "config";
      this.uriCache.set(configUri.toString(), config);

      items.unshift(pages); // Add the pages label
      items.unshift(themes); // Add the themes label
      items.unshift(config); // Add the config label

      return items; // Return the root items
    } catch (err: any) {
      logMessage(err.message, false, "error");
      return Promise.reject(err); // Reject the promise on error
    }
  }

  private async getThemes(parent: TreeItem): Promise<TreeItem[]> {
    const { userName, siteName, siteDir } = parent;

    const localThemes = await getThemesInThemesDir(
      userName,
      siteName,
      siteDir,
      parent
    );
    const npmThemes = await getThemesInPackageJson(
      userName,
      siteName,
      siteDir,
      parent
    );

    // Create an object from local themes for easy lookup
    const localThemesObject = Object.fromEntries(
      localThemes.map((v) => [v.label, v])
    );

    // Create an object from npm themes for easy lookup
    const npmThemesObject = Object.fromEntries(
      npmThemes.map((v) => [v.label, v])
    );

    // Combine both theme objects
    const allThemesObject = Object.assign(npmThemesObject, localThemesObject);

    const themes = Object.values(allThemesObject);

    themes.forEach((v) => this.uriCache.set(v.resourceUri!!.toString(), v));

    return themes; // Return all unique themes as an array
  }

  // Get the pages under a specific directory
  private async getPages(dir: string, parent: TreeItem): Promise<TreeItem[]> {
    const { userName, siteName } = parent;

    try {
      const dirents = await readdir(dir, { withFileTypes: true }); // Read directory entries
      const items = dirents
        .filter((v) => {
          const pagePath = join(dir, v.name, "index.md"); // Construct the path to the index.md file
          return (
            v.name !== POSTS_DIRNAME &&
            v.name !== DRAFTS_DIRNAME &&
            existsSync(pagePath) // Ensure the file exists
          );
        })
        .map((dirent) => {
          const fullPath = join(dir, dirent.name, "index.md"); // Full path to the page
          const uri = Uri.file(fullPath); // Create a URI for the file
          const label = dirent.name; // Use the directory name as the label
          const collapsibleState = TreeItemCollapsibleState.None; // Set as non-collapsible
          const item = new TreeItem(
            userName,
            siteName,
            label,
            collapsibleState,
            parent,
            uri
          ); // Create a new TreeItem
          item.resourceUri = uri;

          item.command = {
            command: "vscode.open", // Command to open the file
            title: "Open File",
            arguments: [uri], // Arguments for the command
          };
          this.uriCache.set(uri.toString(), item); // Cache the TreeItem
          item.contextValue = "page";
          return item; // Return the created item
        });
      return items; // Return the list of page items
    } catch (err: any) {
      logMessage(err.message, false, "error");
      return Promise.reject(err); // Reject the promise on error
    }
  }

  // Get items (files and directories) under a specified path
  private async getItems(dir: string, parent: TreeItem): Promise<TreeItem[]> {
    const { userName, siteName } = parent;

    try {
      const dirents = await readdir(dir, { withFileTypes: true }); // Read directory entries
      const items = dirents.map((dirent) => {
        const fullPath = join(dir, dirent.name); // Full path to the item
        const uri = Uri.file(fullPath); // Create a URI for the item
        const isDirectory = statSync(uri.fsPath).isDirectory(); // Check if it is a directory

        const label = isDirectory
          ? basename(uri.fsPath) // Use the directory name as the label
          : basename(uri.fsPath).replace(/\.md$/i, ""); // Remove .md extension for files

        const collapsibleState = isDirectory
          ? TreeItemCollapsibleState.Collapsed // Set as collapsible if it is a directory
          : TreeItemCollapsibleState.None; // Non-collapsible for files

        const item = new TreeItem(
          userName,
          siteName,
          label,
          collapsibleState,
          parent,
          uri
        ); // Create a new TreeItem
        item.resourceUri = uri;

        if (!isDirectory) {
          // If it is not a directory, set the command to open the file
          item.command = {
            command: "vscode.open",
            title: "Open File",
            arguments: [uri], // Arguments for the command
          };

          if (/\.md$/i.test(basename(uri.fsPath))) {
            item.contextValue = "md";
          }

          if (parent.contextValue === "drafts") {
            item.contextValue = "draft";
          }
        } else {
          item.contextValue = "folder";
        }

        this.uriCache.set(uri.toString(), item); // Cache the TreeItem
        return item; // Return the created item
      });
      return items; // Return the list of items
    } catch (err: any) {
      logMessage(err.message, false, "error");
      return Promise.reject(err); // Reject the promise on error
    }
  }

  // Find a TreeItem by its URI
  async findNodeByUri(uri: vscode.Uri): Promise<TreeItem | undefined> {
    const cachedNode = this.uriCache.get(uri.toString()); // Check the cache first
    if (cachedNode) {
      return cachedNode; // If found in cache, return it
    }

    const searchNode = async (
      items: TreeItem[]
    ): Promise<TreeItem | undefined> => {
      for (const item of items) {
        if (
          item.resourceUri &&
          item.resourceUri.toString() === uri.toString()
        ) {
          return item; // Return the item if its URI matches
        }
        const child = await this.getChildren(item); // Get children of the current item
        if (child) {
          const found = await searchNode(child); // Recursively search in children
          if (found) {
            return found; // Return found item
          }
        }
      }
      return undefined; // Return undefined if not found
    };

    const rootItems = await this.getChildren(); // Get root items
    return searchNode(rootItems); // Start searching from root items
  }

  refresh(): void {
    // 清除之前的 timeout
    if (this.timeout) {
      clearTimeout(this.timeout);
    }

    // 设置一个新的 timeout
    this.timeout = setTimeout(() => {
      this.sourceDirs.clear(); // 清楚source
      this.uriCache.clear(); // 清除缓存
      this._onDidChangeTreeData.fire(); // 通知数据已更改
    }, 100); // 100 毫秒的防抖延迟
  }

  dispose(): void {
    this.watchers.forEach((v) => v.close()); // Close the watcher when disposing
  }

  // Watch the source directory for changes
  private watchSourceDir(dir: string): FSWatcher {
    const watcher = watch(dir, {
      persistent: true,
      ignoreInitial: true, // Ignore initial events
    });

    // Generic event handler function
    const handleEvent = (eventType: string, path: string) => {
      logMessage(`${eventType} event: ${path}`); // Log the event
      this.refresh(); // Refresh the tree
    };

    // Listen for file and directory events
    watcher.on("add", (path) => handleEvent("File added", path));
    watcher.on("addDir", (path) => handleEvent("Directory added", path));
    watcher.on("unlink", (path) => handleEvent("File removed", path));
    watcher.on("unlinkDir", (path) => handleEvent("Directory removed", path));
    watcher.on("change", (path) => handleEvent("File renamed", path));
    return watcher;
  }

  private async setSourceDirs(rootDir: string, userName: string) {
    const userDir = join(rootDir, userName);
    const dirents = await readdir(userDir, { withFileTypes: true }); // Read directory entries
    for (const dirent of dirents) {
      if (
        !statSync(join(userDir, dirent.name)).isDirectory() ||
        dirent.name === ".git"
      ) {
        continue;
      }
      const siteName = dirent.name;
      const siteDir = join(userDir, dirent.name);
      const config = await getHexoConfig(siteDir); // Get Hexo configuration
      const sourceDir = join(siteDir, config.source_dir);
      this.sourceDirs.set(siteName, sourceDir); // Start watching the source directory
      this.watchers.set(siteName, this.watchSourceDir(sourceDir));
    }
  }
}
