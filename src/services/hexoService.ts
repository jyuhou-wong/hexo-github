import * as vscode from "vscode";
import Hexo from "hexo";
import {
  arePathsEqual,
  getArgs,
  handleError,
  initSourceItem,
  installMissingDependencies,
  installModules,
  modifyYamlField,
  openFile,
} from "../utils";
import {
  DRAFTS_DIRNAME,
  HEXO_CONFIG_NAME,
  POSTS_DIRNAME,
  REQUIRED_MODULES,
} from "./config";
import { basename, join, sep } from "path";
import { existsSync, readFileSync, rmSync } from "fs";
import { getCName, localUsername } from "./githubService";
import { load } from "js-yaml";

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
export const initializeHexo = async (siteDir: string, args: Args = {}) => {
  // 初始化之前安装 package 中丢失的插件
  await installMissingDependencies(siteDir);

  // 确保已经安装了必备插件
  await installModules(siteDir, REQUIRED_MODULES);

  const configPath = join(siteDir, HEXO_CONFIG_NAME);

  const siteName = basename(siteDir);
  const configContents = readFileSync(configPath, "utf8");
  const config = load(configContents) as Record<string, any>;

  let url = "";

  // 如果存在 CNAME，以 CNAME 为准
  const cname = getCName(localUsername, siteName);
  if (cname) {
    url = `http://${cname}`;
  } else {
    if (siteName === `${localUsername}.github.io`) {
      url = `https://${localUsername}.github.io`;
    } else {
      url = `https://${localUsername}.github.io/${siteName}`;
    }
  }

  if (config.url !== url) {
    modifyYamlField(configPath, "url", url);

    // 修改了配置要确保清除缓存
    const publicDir = join(siteDir, config.public_dir);
    if (existsSync(publicDir)) {
      rmSync(publicDir, { recursive: true, force: true });
    }
  }

  // 初始化 HEXO
  const hexo = new Hexo(siteDir, args);
  await hexo.init();

  // 确保草稿和文章目录都存在，以防止视图渲染出问题
  initSourceItem(hexo.source_dir, [POSTS_DIRNAME, DRAFTS_DIRNAME]);
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
  if (!cmd) {
    throw new Error("Command cannot be empty!");
  }

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
    if (!layout || !data.source) {
      return false;
    }
    return arePathsEqual(path, join(source_dir, data.source));
  });

  hexo.exit();

  if (!matchingItem) {
    throw new Error("This file is not a blog document");
  }

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
    if (existsSync(path)) {
      await openFile(path);
      throw new Error(`Page ${name} already exists`);
    }
    await hexoExec(siteDir, `new page "${name}"`);
  } else if (type === "Draft") {
    path = join(hexo.source_dir, DRAFTS_DIRNAME, `${name}.md`);
    if (existsSync(path)) {
      await openFile(path);
      throw new Error(`Draft ${name} already exists`);
    }
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
      throw new Error(`Blog ${name} already exists`);
    }
    await hexoExec(siteDir, `new --path "${relativePath}/${name}"`);
  }

  await openFile(path);
};
