import Hexo from "hexo";
import minimist from "minimist";
import {
  arePathsEqual,
  checkNodeModulesExist,
  installNpmModules,
} from "../utils";
import { LOCAL_HEXO_STARTER_DIR } from "./config";
import { join } from "path";

// Initialize Hexo
export const initializeHexo = async (dir: string) => {
  const hexo = new Hexo(dir, { debug: true });
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

  if (!(await checkNodeModulesExist(LOCAL_HEXO_STARTER_DIR))) {
    console.log(
      `Modules are not installed in ${LOCAL_HEXO_STARTER_DIR}. Installing now...`
    );
    await installNpmModules(LOCAL_HEXO_STARTER_DIR);
  }

  const hexo = await initializeHexo(LOCAL_HEXO_STARTER_DIR);

  const argv = cmd
    .match(/(?:[^\s"]+|"[^"]*")+/g)!!
    .map((arg) => arg.replace(/"/g, ""));

  const args = minimist(argv, { string: ["_", "p", "path", "s", "slug"] });
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
  } finally {
    hexo.exit();
  }

  return result;
};

// Get preview URL for a given path
export const getPreviewUrl = async (path: string) => {
  const hexo = await initializeHexo(LOCAL_HEXO_STARTER_DIR);
  await hexo.load();

  const source_path = join(LOCAL_HEXO_STARTER_DIR, hexo.config.source_dir);
  const generators = await hexo._runGenerators();

  const matchingItem = generators.find(({ layout, data }) => {
    if (!layout || !data.source) return false;
    return arePathsEqual(path, join(source_path, data.source));
  });

  hexo.exit();

  if (!matchingItem) throw new Error("This file is not a blog document");

  return `http://localhost:${hexo.config.server.port}/${matchingItem.path}`;
};
