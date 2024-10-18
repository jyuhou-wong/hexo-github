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
import { basename, extname, join } from "path";
import {
  EXT_HEXO_STARTER_DIR,
  SOURCE_POSTS_DIRNAME,
  SOURCE_DRAFTS_DIRNAME,
} from "../services/config";
import { getHexoConfig } from "../services/hexoService";
import { existsSync, statSync } from "fs";
import { FSWatcher, watch } from "chokidar";

// Define the TreeItem class which represents each item in the tree
export class TreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string, // Label to display in the tree
    public readonly collapsibleState: vscode.TreeItemCollapsibleState, // State indicating whether the item can be expanded
    public readonly parent?: TreeItem, // Reference to the parent item
    public readonly uri?: Uri
  ) {
    super(label, collapsibleState);
  }
}

// Implement the TreeDataProvider to manage the tree structure
export class BlogsTreeDataProvider implements TreeDataProvider<TreeItem> {
  private _onDidChangeTreeData: EventEmitter<void> = new EventEmitter<void>(); // Event emitter for notifying tree changes
  readonly onDidChangeTreeData: Event<void> = this._onDidChangeTreeData.event; // Event to listen for tree changes
  private sourceDir: string = ""; // Directory containing the source files
  private watcher: FSWatcher = new FSWatcher(); // File system watcher for monitoring changes
  private uriCache: Map<string, TreeItem> = new Map(); // Cache for storing TreeItems by their URI

  constructor(private context: ExtensionContext) {
    this.context = context; // Store the extension context
  }

  // Get the label for the directory based on its name
  static getLabel(dirname: string = "Pages 页面") {
    switch (dirname) {
      case SOURCE_POSTS_DIRNAME:
        return "Articles 文章"; // Label for posts directory
      case SOURCE_DRAFTS_DIRNAME:
        return "Drafts 草稿"; // Label for drafts directory
      default:
        return "Pages 页面"; // Default label for other directories
    }
  }

  // Get the root items for the tree
  private async getRootItems(rootDir: string): Promise<TreeItem[]> {
    try {
      const dirents = await readdir(rootDir, { withFileTypes: true }); // Read directory entries
      const items = dirents
        .filter(
          (v) =>
            v.name === SOURCE_POSTS_DIRNAME || v.name === SOURCE_DRAFTS_DIRNAME
        )
        .map((dirent) => {
          const label = BlogsTreeDataProvider.getLabel(dirent.name); // Get label for the directory
          const uri = Uri.file(dirent.parentPath);
          const collapsibleState =
            dirent.name !== SOURCE_POSTS_DIRNAME
              ? TreeItemCollapsibleState.Expanded
              : TreeItemCollapsibleState.Collapsed; // Set collapsible state
          const item = new TreeItem(label, collapsibleState, undefined, uri); // Create a new TreeItem
          return item;
        });

      items.unshift(
        new TreeItem(
          BlogsTreeDataProvider.getLabel(),
          TreeItemCollapsibleState.Expanded
        )
      ); // Add the main label for pages
      return items; // Return the root items
    } catch (err) {
      console.error(err); // Log any errors
      return Promise.reject(err); // Reject the promise on error
    }
  }

  // Get the pages under a specific directory
  private async getPages(dir: string, parent: TreeItem): Promise<TreeItem[]> {
    try {
      const dirents = await readdir(dir, { withFileTypes: true }); // Read directory entries
      const items = dirents
        .filter((v) => {
          const pagePath = join(dir, v.name, "index.md"); // Construct the path to the index.md file
          return (
            v.name !== SOURCE_POSTS_DIRNAME &&
            v.name !== SOURCE_DRAFTS_DIRNAME &&
            existsSync(pagePath) // Ensure the file exists
          );
        })
        .map((dirent) => {
          const fullPath = join(dir, dirent.name, "index.md"); // Full path to the page
          const uri = Uri.file(fullPath); // Create a URI for the file
          const label = dirent.name; // Use the directory name as the label
          const collapsibleState = TreeItemCollapsibleState.None; // Set as non-collapsible
          const item = new TreeItem(label, collapsibleState, parent, uri); // Create a new TreeItem
          item.resourceUri = uri;

          item.command = {
            command: "vscode.open", // Command to open the file
            title: "Open File",
            arguments: [uri], // Arguments for the command
          };
          this.uriCache.set(uri.toString(), item); // Cache the TreeItem
          item.contextValue = extname(fullPath);
          return item; // Return the created item
        });
      return items; // Return the list of page items
    } catch (err) {
      console.error(err); // Log any errors
      return Promise.reject(err); // Reject the promise on error
    }
  }

  // Get items (files and directories) under a specified path
  private async getItems(path: string, parent: TreeItem): Promise<TreeItem[]> {
    try {
      const dirents = await readdir(path, { withFileTypes: true }); // Read directory entries
      const items = dirents.map((dirent) => {
        const fullPath = join(path, dirent.name); // Full path to the item
        const uri = Uri.file(fullPath); // Create a URI for the item
        const isDirectory = statSync(uri.fsPath).isDirectory(); // Check if it is a directory

        const label = isDirectory
          ? basename(uri.fsPath) // Use the directory name as the label
          : basename(uri.fsPath).replace(/\.md$/i, ""); // Remove .md extension for files

        const collapsibleState = isDirectory
          ? TreeItemCollapsibleState.Collapsed // Set as collapsible if it is a directory
          : TreeItemCollapsibleState.None; // Non-collapsible for files

        const item = new TreeItem(label, collapsibleState, parent, uri); // Create a new TreeItem
        item.resourceUri = uri;

        if (!isDirectory) {
          // If it is not a directory, set the command to open the file
          item.command = {
            command: "vscode.open",
            title: "Open File",
            arguments: [uri], // Arguments for the command
          };
        }

        item.contextValue = extname(fullPath);

        this.uriCache.set(uri.toString(), item); // Cache the TreeItem
        return item; // Return the created item
      });
      return items; // Return the list of items
    } catch (err) {
      console.error(err); // Log any errors
      return Promise.reject(err); // Reject the promise on error
    }
  }

  getTreeItem(element: TreeItem): TreeItem {
    return element; // Return the TreeItem itself
  }

  // Get the children of a specified TreeItem
  async getChildren(element?: TreeItem): Promise<TreeItem[]> {
    if (!this.sourceDir) await this.setSourceDir(); // Ensure source directory is set

    if (element?.collapsibleState === 0) {
      return [];
    }

    if (
      element?.label === BlogsTreeDataProvider.getLabel(SOURCE_POSTS_DIRNAME)
    ) {
      // If the element is the posts directory, get its children
      return await this.getItems(
        join(this.sourceDir, SOURCE_POSTS_DIRNAME),
        element
      );
    }

    if (
      element?.label === BlogsTreeDataProvider.getLabel(SOURCE_DRAFTS_DIRNAME)
    ) {
      // If the element is the drafts directory, get its children
      return await this.getItems(
        join(this.sourceDir, SOURCE_DRAFTS_DIRNAME),
        element
      );
    }

    if (element?.label === BlogsTreeDataProvider.getLabel()) {
      // If the element is the main pages label, get the pages
      return await this.getPages(this.sourceDir, element);
    }

    if (element?.uri) {
      // If the element has a resource URI, get its children
      return await this.getItems(element.uri.fsPath, element);
    }

    // Default case: return the root items
    return await this.getRootItems(this.sourceDir);
  }

  getParent(element: TreeItem): vscode.ProviderResult<TreeItem> {
    return element.parent; // Return the parent of the TreeItem
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
    this.uriCache.clear(); // Clear the cache on refresh
    this._onDidChangeTreeData.fire(); // Notify that the tree data has changed
  }

  dispose(): void {
    this.watcher.close(); // Close the watcher when disposing
  }

  // Watch the source directory for changes
  watchSourceDir(dir: string): void {
    this.watcher = watch(dir, {
      persistent: true,
      ignoreInitial: true, // Ignore initial events
    });

    // Generic event handler function
    const handleEvent = (eventType: string, path: string) => {
      console.log(`${eventType} event: ${path}`); // Log the event
      this.refresh(); // Refresh the tree
    };

    // Listen for file and directory events
    this.watcher.on("add", (path) => handleEvent("File added", path));
    this.watcher.on("addDir", (path) => handleEvent("Directory added", path));
    this.watcher.on("unlink", (path) => handleEvent("File removed", path));
    this.watcher.on("unlinkDir", (path) =>
      handleEvent("Directory removed", path)
    );
    this.watcher.on("change", (path) => handleEvent("File renamed", path));
  }

  // Set the source directory based on the Hexo configuration
  async setSourceDir() {
    const config = await getHexoConfig(); // Get Hexo configuration
    this.sourceDir = join(EXT_HEXO_STARTER_DIR, config.source_dir); // Set the source directory
    this.watchSourceDir(this.sourceDir); // Start watching the source directory
  }
}
