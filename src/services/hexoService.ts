import { homedir } from "os";
import { join } from "path";
import * as simpleGit from "simple-git";
import * as fs from "fs";
import { loadAccessToken, getOctokitInstance } from "../services/githubService";
import minimist from "minimist";
import axios from "axios";
import * as unzipper from "unzipper";
import Hexo from "hexo";
import { window } from "vscode"; // Import VS Code window for notifications
import { exec } from "child_process"; // Import exec for running npm commands
import { arePathsEqual, checkNodeModulesExist } from "../utils";
import { promisify } from "util";

const homeDirectory: string = homedir();
const localHexoDir = join(homeDirectory, ".hexo-github");
const localHexoStarterDir = join(localHexoDir, "hexo-starter");
const git = simpleGit(localHexoDir);

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
    return repos.some((repo) => repo.name === repoName && repo.private);
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

// Function to set remote URL with personal access token
const setGitRemoteWithToken = (token: string) => {
  const remoteUrl = `https://${token}:x-oauth-basic@github.com/jyuhou-wong/hexo-github-db.git`;
  return git.addRemote("origin", remoteUrl);
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
    await setGitRemoteWithToken(loadAccessToken() as any); // Set remote with token
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

export const getRouteById = async (_id: string) => {
  const hexo = new Hexo(localHexoStarterDir, {
    debug: true,
  });

  await hexo.init();
  await hexo.load();

  const source_path = join(localHexoStarterDir, hexo.config.source_dir);

  const generators = await hexo._runGenerators();

  const matchingItem = generators.find(({ layout, data }) => {
    if (!layout) return false;
    return arePathsEqual(_id, join(source_path, data.source));
  });

  hexo.exit();

  if (!matchingItem) throw new Error("该文件不是博客文档");

  return `http://localhost:${hexo.config.server.port}/${matchingItem.path}`;
};

export const hexoExec = async (cmd: string) => {
  if (!(await checkNodeModulesExist(localHexoStarterDir))) {
    console.log(
      `Modules are not installed in ${localHexoStarterDir}. Installing now...`
    );
    await installNpmModules(localHexoStarterDir);
  }

  const hexo = new Hexo(localHexoStarterDir, {
    debug: true,
  });

  const argv = cmd.split(/\s+/);
  const args = minimist(argv, { string: ["_", "p", "path", "s", "slug"] });

  return hexo.init().then(() => {
    let cmd = "help";

    if (!args.h && !args.help) {
      const c = args._.shift();
      if (c && hexo.extend.console.get(c)) cmd = c;
    }

    process.on("SIGINT", () => {
      hexo.unwatch();
      hexo.exit();
    });

    return hexo
      .call(cmd, args)
      .then(() => {
        hexo.exit();
      })
      .catch((err: any) => hexo.exit(err));
  });
};
