import * as vscode from "vscode";
import Hexo from "hexo";
import {
  arePathsEqual,
  checkNodeModulesExist,
  getArgs,
  handleError,
  installNpmModules,
} from "../utils";
import { EXT_HEXO_STARTER_DIR } from "./config";
import { join } from "path";

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
export const initializeHexo = async (args: Args = {}) => {
  const hexo = new Hexo(EXT_HEXO_STARTER_DIR, args);
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
export const hexoExec = async (cmd: string) => {
  if (!cmd) throw new Error("Command cannot be empty!");

  if (!(await checkNodeModulesExist(EXT_HEXO_STARTER_DIR))) {
    vscode.window.showInformationMessage(
      `Modules are not installed in ${EXT_HEXO_STARTER_DIR}. Installing now...`
    );
    await installNpmModules(EXT_HEXO_STARTER_DIR);
  }

  const args = getArgs(cmd);

  const hexo = await initializeHexo(args);
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
export const getPreviewUrl = async (
  path: string,
  cmd: string = "--draft --debug"
) => {
  const args = getArgs(cmd);
  const hexo = await initializeHexo(args);
  await hexo.load();

  const source_path = join(EXT_HEXO_STARTER_DIR, hexo.config.source_dir);
  const generators = await hexo._runGenerators();

  const matchingItem = generators.find(({ layout, data }: any) => {
    if (!layout || !data.source) return false;
    return arePathsEqual(path, join(source_path, data.source));
  });

  hexo.exit();

  if (!matchingItem) throw new Error("This file is not a blog document");

  return `http://localhost:${(hexo.config.server as any).port}/${
    matchingItem.path
  }`;
};

// Get Hexo config
export const getHexoConfig = async () => {
  const hexo = await initializeHexo();
  return hexo.config;
};
