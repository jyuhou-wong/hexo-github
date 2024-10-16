import {
  TreeItem,
  TreeDataProvider,
  EventEmitter,
  Event,
  TreeItemCollapsibleState,
  Uri,
  ExtensionContext,
} from "vscode";
import * as vscode from "vscode";

import { readdir } from "fs/promises";
import { basename, dirname, join } from "path";
import {
  EXT_HEXO_STARTER_DIR,
  SOURCE_POSTS_DIRNAME,
  SOURCE_DRAFTS_DIRNAME,
} from "../services/config";
import { getHexoConfig } from "../services/hexoService";
import { existsSync, statSync } from "fs";
import { FSWatcher, watch } from "chokidar";
import { arePathsEqual } from "../utils";

const getLabel = (dirname: string = "Pages 页面") => {
  switch (dirname) {
    case SOURCE_POSTS_DIRNAME:
      return "Articles 文章";
    case SOURCE_DRAFTS_DIRNAME:
      return "Drafts 草稿";
    default:
      return "Pages 页面";
  }
};

export class BlogTreeItem extends vscode.TreeItem {
  constructor(public readonly name: string, public readonly uri: vscode.Uri) {
    super(uri);

    this.label = name.replace(/\.md$/i, ""); // 去掉文件扩展名

    const isDirectory = statSync(uri.fsPath).isDirectory();

    if (isDirectory) {
      this.collapsibleState = TreeItemCollapsibleState.Collapsed;
    }

    // 如果不是目录，设置打开文件的命令
    if (!isDirectory) {
      this.command = {
        command: "vscode.open",
        title: "Open File",
        arguments: [uri],
      };
    }
  }
}

const getItems = async (path: string): Promise<TreeItem[]> => {
  try {
    const dirents = await readdir(path, { withFileTypes: true });
    return dirents.map((dirent) => {
      const fullPath = join(path, dirent.name);
      const uri = Uri.file(fullPath);
      return new BlogTreeItem(dirent.name, uri);
    });
  } catch (err) {
    console.error(err);
    return Promise.reject(err);
  }
};

const getPages = async (dir: string): Promise<TreeItem[]> => {
  try {
    const dirents = await readdir(dir, { withFileTypes: true });
    return dirents
      .filter((v) => {
        const pagePath = join(dir, v.name, "index.md");
        return (
          v.name !== SOURCE_POSTS_DIRNAME &&
          v.name !== SOURCE_DRAFTS_DIRNAME &&
          existsSync(pagePath)
        );
      })
      .map((dirent) => {
        const fullPath = join(dir, dirent.name, "index.md");
        const uri = Uri.file(fullPath);
        return new BlogTreeItem(dirent.name, uri);
      });
  } catch (err) {
    console.error(err);
    return Promise.reject(err);
  }
};

const getRootItems = async (rootDir: string): Promise<TreeItem[]> => {
  try {
    const dirents = await readdir(rootDir, { withFileTypes: true });
    const items = dirents
      .filter(
        (v) =>
          v.name === SOURCE_POSTS_DIRNAME || v.name === SOURCE_DRAFTS_DIRNAME
      )
      .map((dirent) => {
        const item = new TreeItem(
          getLabel(dirent.name),
          TreeItemCollapsibleState.Collapsed
        );
        if (dirent.name !== SOURCE_POSTS_DIRNAME) {
          item.collapsibleState = TreeItemCollapsibleState.Expanded;
        }
        return item;
      });

    items.unshift(new TreeItem(getLabel(), TreeItemCollapsibleState.Expanded));
    return items;
  } catch (err) {
    console.error(err);
    return Promise.reject(err);
  }
};

export class BlogsTreeDataProvider implements TreeDataProvider<TreeItem> {
  private _onDidChangeTreeData: EventEmitter<void> = new EventEmitter<void>();
  readonly onDidChangeTreeData: Event<void> = this._onDidChangeTreeData.event;
  private sourceDir: string = "";
  private watcher: FSWatcher = new FSWatcher();

  constructor(private context: ExtensionContext) {
    this.context = context;
  }

  getParent(element: TreeItem): vscode.ProviderResult<TreeItem> {
    const parentPath = dirname(element.resourceUri!!.fsPath);

    if (arePathsEqual(parentPath, this.sourceDir)) {
      return undefined;
    }

    const parent = new BlogTreeItem(basename(parentPath), Uri.file(parentPath));

    parent.collapsibleState = TreeItemCollapsibleState.Expanded;

    // 如果是最顶层的
    if (arePathsEqual(dirname(parentPath), this.sourceDir)) {
      parent.label = getLabel(parent.name);
    }

    return parent;
  }

  getTreeItem(element: TreeItem): TreeItem {
    return element;
  }

  async getChildren(element?: TreeItem): Promise<TreeItem[]> {
    if (!this.sourceDir) await this.setSourceDir();

    if (element?.resourceUri) {
      // 如果 element 是一个有效的资源 URI，获取该目录下的子项
      return await getItems(element.resourceUri.fsPath);
    }

    if (element?.label === getLabel(SOURCE_POSTS_DIRNAME)) {
      // 如果是文章目录，获取该目录下的子项
      return await getItems(join(this.sourceDir, SOURCE_POSTS_DIRNAME));
    }

    if (element?.label === getLabel(SOURCE_DRAFTS_DIRNAME)) {
      // 如果是草稿目录，获取该目录下的子项
      return await getItems(join(this.sourceDir, SOURCE_DRAFTS_DIRNAME));
    }

    if (element?.label === getLabel()) {
      // 如果是根节点，获取页面
      return await getPages(this.sourceDir);
    }

    // 默认返回根节点的子项
    return await getRootItems(this.sourceDir);
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  dispose(): void {
    this.watcher.close();
  }

  watchSourceDir(dir: string): void {
    this.watcher = watch(dir, {
      persistent: true,
      ignoreInitial: true, // 忽略初始事件
    });

    // 通用的事件处理函数
    const handleEvent = (eventType: string, path: string) => {
      console.log(`${eventType} event: ${path}`);
      this.refresh(); // 调用 refresh 方法
    };

    // 监听文件和目录的事件
    this.watcher.on("add", (path) => handleEvent("File added", path));
    this.watcher.on("addDir", (path) => handleEvent("Directory added", path));
    this.watcher.on("unlink", (path) => handleEvent("File removed", path));
    this.watcher.on("unlinkDir", (path) =>
      handleEvent("Directory removed", path)
    );
    this.watcher.on("change", (path) => handleEvent("File renamed", path));
  }

  async setSourceDir() {
    const config = await getHexoConfig();
    this.sourceDir = join(EXT_HEXO_STARTER_DIR, config.source_dir);
    this.watchSourceDir(this.sourceDir);
  }
}
