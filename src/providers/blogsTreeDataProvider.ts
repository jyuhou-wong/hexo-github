import {
  TreeItem,
  TreeDataProvider,
  EventEmitter,
  Event,
  TreeItemCollapsibleState,
  Uri,
} from "vscode";
import { readdir } from "fs/promises"; // 使用 Promise 风格的 fs
import { join } from "path";
import { LOCAL_HEXO_STARTER_DIR } from "../services/config"; // 确保路径正确
import { getHexoConfig } from "../services/hexoService";

export class BlogsTreeDataProvider implements TreeDataProvider<TreeItem> {
  private _onDidChangeTreeData: EventEmitter<void> = new EventEmitter<void>();
  readonly onDidChangeTreeData: Event<void> = this._onDidChangeTreeData.event;
  source_dir: string = "";

  constructor(private context: any) {}

  async setSourceDir() {
    const config = await getHexoConfig();
    this.source_dir = join(LOCAL_HEXO_STARTER_DIR, config.source_dir);
  }

  getTreeItem(element: TreeItem): TreeItem {
    return element;
  }

  async getChildren(element?: TreeItem): Promise<TreeItem[]> {
    if (!this.source_dir) {
      await this.setSourceDir();
    }

    const directoryPath = element
      ? element.resourceUri!!.fsPath
      : this.source_dir;

    try {
      const dirents = await readdir(directoryPath, { withFileTypes: true });
      const items: TreeItem[] = dirents.map((dirent) => {
        const isDirectory = dirent.isDirectory();
        const fullPath = join(directoryPath, dirent.name); // 构建完整路径
        const uri = Uri.file(fullPath); // 创建 Uri

        const item = new TreeItem(
          uri,
          isDirectory
            ? TreeItemCollapsibleState.Collapsed
            : TreeItemCollapsibleState.None
        );

        if (!isDirectory) {
          item.command = {
            command: "vscode.open",
            title: "Open File",
            arguments: [uri], // 传递 resourceUri
          };
        }

        return item;
      });

      return items;
    } catch (err) {
      console.error(err);
      return Promise.reject(err);
    }
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }
}
