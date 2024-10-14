import { homedir } from "os";
import { join } from "path";
import * as simpleGit from "simple-git";
import * as fs from "fs";
import { loadAccessToken, getOctokitInstance } from "../services/githubService";
import minimist from "minimist";
import axios from "axios";
import * as unzipper from "unzipper";
import Hexo from "hexo";
import { exec } from "child_process"; // Import exec for running npm commands
import { arePathsEqual, checkNodeModulesExist } from "../utils";
import { promisify } from "util";

const homeDirectory: string = homedir();
const localHexoDir = join(homeDirectory, ".hexo-github");
const localHexoStarterDir = join(localHexoDir, "hexo-starter");
const git = simpleGit(localHexoDir);

const initializeHexo = async (dir: string) => {
  const hexo = new Hexo(dir, { debug: true });
  await hexo.init();
  return hexo;
};

const getCommand = (hexo: Hexo, args: any) => {
  if (!args.h && !args.help) {
    const command = args._.shift();
    if (command && hexo.extend.console.get(command)) {
      return command;
    }
  }
  return "help";
};

// Promisify exec for easier async/await usage
const execAsync = promisify(exec);

// Function to install npm modules in the specified directory
const installNpmModules = async (dirPath: string) => {
  try {
    await execAsync("npm install", { cwd: dirPath });
    console.log("NPM modules installed successfully.");
  } catch (error) {
    throw new Error(`Error installing NPM modules: ${error.stderr}`);
  }
};

// Function to check if the repository exists
const checkRepoExists = async (repoName: string, octokit: any) => {
  try {
    const { data: repos } = await octokit.rest.repos.listForAuthenticatedUser({
      type: "all",
    });
    return repos.some((repo) => repo.name === repoName);
  } catch (error) {
    throw new Error(`Error checking repository existence: ${error.message}`);
  }
};

// Function to add Hexo Starter as a submodule if it doesn't exist
const addHexoStarterSubmodule = async () => {
  const starterRepoZipUrl =
    "https://github.com/hexojs/hexo-starter/archive/refs/heads/master.zip";
  const zipFilePath = join(localHexoDir, "hexo-starter.zip");

  // Step 1: Download the ZIP file
  const response = await axios({
    method: "get",
    url: starterRepoZipUrl,
    responseType: "stream",
  });

  // Step 2: Save the ZIP file locally
  const writer = fs.createWriteStream(zipFilePath);
  response.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on("finish", async () => {
      // Step 3: Extract the ZIP file
      fs.createReadStream(zipFilePath)
        .pipe(unzipper.Extract({ path: localHexoDir }))
        .on("close", async () => {
          console.log("Extracted hexo-starter contents successfully.");
          // Rename the extracted folder if necessary
          const extractedDir = join(localHexoDir, "hexo-starter-master");
          const targetDir = join(localHexoDir, "hexo-starter");
          fs.renameSync(extractedDir, targetDir);

          // Clean up the ZIP file
          fs.unlinkSync(zipFilePath);

          await installNpmModules(localHexoStarterDir);

          resolve();
        })
        .on("error", (error) => {
          reject(new Error(`Error extracting ZIP file: ${error.message}`));
        });
    });

    writer.on("error", (error) => {
      reject(new Error(`Error writing ZIP file: ${error.message}`));
    });
  });
};

// Function to initialize local repository
const initializeLocalRepo = async () => {
  await git.init();
  console.log("Initialized local repository.");

  // Create a README file or any file to commit
  const readmePath = join(localHexoDir, "README.md");
  fs.writeFileSync(
    readmePath,
    "# Hexo GitHub Repository\n\nThis is the initial commit."
  );

  // Stage the README file
  await git.add(readmePath);

  // Create an initial commit
  await git.commit("Initial commit with README");

  // Check if 'main' branch exists, if not create it
  const branches = await git.branchLocal();
  if (!branches.all.includes("main")) {
    await git.checkoutLocalBranch("main"); // Create and switch to 'main' branch
  } else {
    await git.checkout("main"); // Switch to 'main' branch if it exists
  }

  // Now add the Hexo Starter submodule
  await addHexoStarterSubmodule();
  console.log("Added HexoStarter contents.");
};

// Function to push changes to the hexo-github-db repository
export const pushHexoRepo = async () => {
  const octokit = getOctokitInstance();
  const repoExists = await checkRepoExists("hexo-github-db", octokit);
  const localRepoExists = fs.existsSync(join(localHexoDir, ".git"));

  if (!repoExists && !localRepoExists) {
    await initializeLocalRepo();
    console.log("Local repository initialized. Creating remote repository...");
  }

  if (!repoExists) {
    const response = await octokit.rest.repos.createForAuthenticatedUser({
      name: "hexo-github-db",
      private: true,
    });
    console.log(`Created repository: ${response.data.full_name}`);
    const remoteUrl = `https://${loadAccessToken()}:x-oauth-basic@github.com/${
      user.login
    }/hexo-github-db.git`;
    await git.addRemote("origin", remoteUrl);
  }

  await git.add(".");
  await git.commit("feat: update hexo database");

  await git.push("origin", "main");
  console.log("Pushed to hexo-github-db successfully.");
};

// Main function to pull Hexo repository
export const pullHexoRepo = async () => {
  const octokit = getOctokitInstance();
  const repoExists = await checkRepoExists("hexo-github-db", octokit);
  const localRepoPath = join(localHexoDir, ".git");
  const localRepoExists = fs.existsSync(localRepoPath);

  if (repoExists) {
    if (localRepoExists) {
      try {
        await git.pull("origin", "main");
        console.log("Pulled latest changes from hexo-github-db successfully.");
      } catch (error) {
        throw new Error(`Error pulling from repository: ${error.message}`);
      }
    } else {
      throw new Error(
        "Local repository does not exist. Please run pushHexoRepo first."
      );
    }
  } else {
    if (!localRepoExists) {
      throw new Error(
        "Repository hexo-github-db does not exist on GitHub. Please run pushHexoRepo to create it."
      );
    } else {
      throw new Error(
        "Local repository exists but remote does not. Please run pushHexoRepo to create it."
      );
    }
  }
};

export const getPreviewUrl = async (path: string) => {
  const hexo = await initializeHexo(localHexoStarterDir);
  await hexo.load();

  const source_path = join(localHexoStarterDir, hexo.config.source_dir);

  const generators = await hexo._runGenerators();

  const matchingItem = generators.find(({ layout, data }) => {
    if (!layout || !data.source) return false;
    return arePathsEqual(path, join(source_path, data.source));
  });

  hexo.exit();

  if (!matchingItem) throw new Error("该文件不是博客文档");

  return `http://localhost:${hexo.config.server.port}/${matchingItem.path}`;
};

export const pushToGitHubPages = async () => {
  const octokit = getOctokitInstance();
  const hexo = await initializeHexo(localHexoStarterDir);

  const localPublicDir = join(localHexoStarterDir, hexo.config.public_dir);

  const { data: user } = await octokit.rest.users.getAuthenticated();

  const repoExists = await checkRepoExists(`${user.login}.github.io`, octokit);
  const localRepoExists = fs.existsSync(join(localPublicDir, ".git"));

  // 生成静态文件
  await hexoExec("generate");

  const git = simpleGit(localPublicDir);

  if (!localRepoExists) {
    await git.init(); // 初始化 Git 仓库

    const remoteUrl = `https://${loadAccessToken()}:x-oauth-basic@github.com/${
      user.login
    }/${user.login}.github.io.git`;
    await git.addRemote("origin", remoteUrl);
  } 

  const branches = await git.branchLocal();
  if (!branches.all.includes("main")) {
    await git.checkoutLocalBranch("main"); // 如果 'main' 不存在则创建
  } else {
    await git.checkout("main"); // 切换到 'main' 分支
  }

  // 如果仓库不存在，则创建一个新的 GitHub 仓库
  if (!repoExists) {
    const response = await octokit.rest.repos.createForAuthenticatedUser({
      name: `${user.login}.github.io`,
    });
    console.log(`Created repository: ${response.data.full_name}`);
  }

  // 添加并提交更改
  await git.add(".");
  await git.commit("Deploy to GitHub Pages");

  // 推送到 'main' 分支
  await git.push("origin", "main", { "--force": null }); // 使用 --force 以防出现问题
  console.log("Pushed to main successfully.");
};

export const hexoExec = async (cmd: string) => {
  if (!(await checkNodeModulesExist(localHexoStarterDir))) {
    console.log(
      `Modules are not installed in ${localHexoStarterDir}. Installing now...`
    );
    await installNpmModules(localHexoStarterDir);
  }

  const hexo = await initializeHexo(localHexoStarterDir);
  const argv = cmd.split(/\s+/);
  const args = minimist(argv, { string: ["_", "p", "path", "s", "slug"] });

  const command = getCommand(hexo, args);

  process.on("SIGINT", () => {
    hexo.unwatch();
    hexo.exit();
  });

  try {
    await hexo.call(command, args);
  } catch (err) {
    hexo.exit(err);
  } finally {
    hexo.exit();
  }
};
