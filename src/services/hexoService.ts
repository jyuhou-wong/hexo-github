import * as vscode from "vscode";
import Hexo from "hexo";
import {
  arePathsEqual,
  getArgs,
  handleError,
  installMissingDependencies,
  openFile,
  revealItem,
} from "../utils";
import { EXT_HEXO_STARTER_DIR, DRAFTS_DIRNAME, POSTS_DIRNAME } from "./config";
import { join, sep } from "path";
import { existsSync } from "fs";
import { Uri } from "vscode";

interface Args {
  debug?: boolean;
  safe?: boolean;
  silent?: boolean;
  draft?: boolean;
  drafts?: boolean;
  _?: string[];
  output?: string;
  config?: string;
  [key: string]: any;
}

// Initialize Hexo
export const initializeHexo = async (
  siteDir: string = EXT_HEXO_STARTER_DIR,
  args: Args = {}
) => {
  // 初始化之前安装丢失的插件
  await installMissingDependencies(siteDir);

  const hexo = new Hexo(siteDir, args);
  await hexo.init();
  return hexo;
};

// Get command from args
const getCommand = (hexo: Hexo, args: any) => {
  if (!args.h && !args.help) {
    const command = args._.shift();
    if (command && hexo.extend.console.get(command)) {
      return command;
    }
  }
  return "help";
};

// Execute Hexo command
export const hexoExec = async (siteDir: string, cmd: string) => {
  if (!cmd) throw new Error("Command cannot be empty!");

  const args = getArgs(cmd);

  const hexo = await initializeHexo(siteDir, args);
  const command = getCommand(hexo, args);

  process.on("SIGINT", () => {
    hexo.unwatch();
    hexo.exit();
  });

  let result: any;
  try {
    result = await hexo.call(command, args);
  } catch (err) {
    hexo.exit(err);
    handleError(err);
  } finally {
    hexo.exit();
  }

  return result;
};

// Get preview URL for a given path
export const getPreviewRoute = async (
  siteDir: string,
  path: string,
  cmd: string = "--draft --debug"
) => {
  const args = getArgs(cmd);
  const hexo = await initializeHexo(siteDir, args);
  await hexo.load();

  const source_dir = hexo.source_dir;
  const generators = await hexo._runGenerators();

  const matchingItem = generators.find(({ layout, data }: any) => {
    if (!layout || !data.source) return false;
    return arePathsEqual(path, join(source_dir, data.source));
  });

  hexo.exit();

  if (!matchingItem) throw new Error("This file is not a blog document");

  return matchingItem.path;
};

// Get Hexo config
export const getHexoConfig = async (siteDir: string) => {
  const hexo = await initializeHexo(siteDir, {});
  return hexo.config;
};

// 处理创建文件的通用逻辑
export const handleCreateFile = async (
  siteDir: string,
  name: string,
  type: string,
  context: vscode.ExtensionContext,
  parentPath?: string
) => {
  const hexo = await initializeHexo(siteDir, {});
  let path: string;

  if (type === "Page") {
    path = join(hexo.source_dir, parentPath || name, "index.md");
    if (existsSync(path)) throw new Error(`Page ${name} already exists`);
    await hexoExec(siteDir, `new page "${name}"`);
  } else if (type === "Draft") {
    path = join(hexo.source_dir, DRAFTS_DIRNAME, `${name}.md`);
    if (existsSync(path)) throw new Error(`Draft ${name} already exists`);
    await hexoExec(siteDir, `new draft "${name}"`);
  } else {
    // Assume it's a Blog
    const postDir = join(hexo.source_dir, POSTS_DIRNAME);

    const relativePath = parentPath
      ? parentPath.substring(postDir.length + sep.length).replace(/[/\\]/g, "/")
      : "";

    path = join(parentPath ?? postDir, `${name}.md`);
    if (existsSync(path)) {
      await openFile(path);
      await revealItem(Uri.file(path), context);
      throw new Error(`Blog ${name} already exists`);
    }
    await hexoExec(siteDir, `new --path "${relativePath}/${name}"`);
  }

  await openFile(path);
  await revealItem(Uri.file(path), context);
};
