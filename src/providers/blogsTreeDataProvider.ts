import {
  TreeItem,
  TreeDataProvider,
  EventEmitter,
  Event,
  TreeItemCollapsibleState,
  Uri,
} from "vscode";
import { readdir } from "fs/promises";
import { join } from "path";
import {
  LOCAL_HEXO_STARTER_DIR,
  SOURCE_POSTS_DIRNAME,
  SOURCE_DRAFTS_DIRNAME,
} from "../services/config";
import { getHexoConfig } from "../services/hexoService";
import { existsSync } from "fs";

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

const createTreeItem = (
  name: string,
  uri: Uri,
  isDirectory: boolean
): TreeItem => {
  const item = new TreeItem(
    uri,
    isDirectory
      ? TreeItemCollapsibleState.Collapsed
      : TreeItemCollapsibleState.None
  );
  item.label = name.replace(/\.md$/i, "");
  if (!isDirectory) {
    item.command = {
      command: "vscode.open",
      title: "Open File",
      arguments: [uri],
    };
  }
  return item;
};

const getItems = async (path: string) => {
  try {
    const dirents = await readdir(path, { withFileTypes: true });
    return dirents.map((dirent) => {
      const fullPath = join(path, dirent.name);
      const uri = Uri.file(fullPath);
      return createTreeItem(dirent.name, uri, dirent.isDirectory());
    });
  } catch (err) {
    console.error(err);
    return Promise.reject(err);
  }
};

const getPages = async (dir: string) => {
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
        return createTreeItem(dirent.name, uri, false);
      });
  } catch (err) {
    console.error(err);
    return Promise.reject(err);
  }
};

const getRootItems = async (rootDir: string) => {
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

  constructor(private context: any) {}

  async setSourceDir() {
    const config = await getHexoConfig();
    this.sourceDir = join(LOCAL_HEXO_STARTER_DIR, config.source_dir);
  }

  getTreeItem(element: TreeItem): TreeItem {
    return element;
  }

  async getChildren(element?: TreeItem): Promise<TreeItem[]> {
    if (!this.sourceDir) await this.setSourceDir();

    if (element?.resourceUri) {
      return getItems(element.resourceUri.fsPath);
    }

    if (element?.label === getLabel(SOURCE_POSTS_DIRNAME)) {
      return getItems(join(this.sourceDir, SOURCE_POSTS_DIRNAME));
    }

    if (element?.label === getLabel(SOURCE_DRAFTS_DIRNAME)) {
      return getItems(join(this.sourceDir, SOURCE_DRAFTS_DIRNAME));
    }

    if (element?.label === getLabel()) {
      return getPages(this.sourceDir);
    }

    return getRootItems(this.sourceDir);
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }
}
