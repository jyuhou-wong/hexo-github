import { homedir } from "os";
import { join, sep } from "path";
import * as simpleGit from "simple-git";
import * as fs from "fs";
import { loadAccessToken, getOctokitInstance } from "./github";
import Hexo from "hexo";

const homeDirectory: string = homedir();
const localHexoDir = join(homeDirectory, ".hexo-github");
const localHexoStarterDir = join(localHexoDir, "hexo-starter");
const git = simpleGit(localHexoDir);

// Function to check if the repository exists
const checkRepoExists = async (repoName: string, octokit: any) => {
  try {
    const { data: repos } = await octokit.rest.repos.listForAuthenticatedUser({ type: "all" });
    return repos.some(repo => repo.name === repoName && repo.private);
  } catch (error) {
    throw new Error(`Error checking repository existence: ${error.message}`);
  }
};

// Function to add Hexo Starter as a submodule if it doesn't exist
const addHexoStarterSubmodule = async () => {
  const starterRepo = "https://github.com/hexojs/hexo-starter";
  await git.submoduleAdd(starterRepo, 'hexo-starter');
  console.log("Added hexo-starter as a submodule successfully.");
};

// Function to initialize local repository
const initializeLocalRepo = async () => {
  await git.init();
  console.log("Initialized local repository.");

  // Create a README file or any file to commit
  const readmePath = join(localHexoDir, "README.md");
  fs.writeFileSync(readmePath, "# Hexo GitHub Repository\n\nThis is the initial commit.");
  
  // Stage the README file
  await git.add(readmePath);
  
  // Create an initial commit
  await git.commit("Initial commit with README");

  // Check if 'main' branch exists, if not create it
  const branches = await git.branchLocal();
  if (!branches.all.includes('main')) {
    await git.checkoutLocalBranch('main'); // Create and switch to 'main' branch
  } else {
    await git.checkout('main'); // Switch to 'main' branch if it exists
  }

  // Now add the Hexo Starter submodule
  await addHexoStarterSubmodule();
  console.log("Added HexoStarter submodule.");
};

// Function to set remote URL with personal access token
const setGitRemoteWithToken = (token: string) => {
  const remoteUrl = `https://${token}:x-oauth-basic@github.com/jyuhou-wong/hexo-github-db.git`;
  return git.addRemote("origin", remoteUrl);
};

// Function to push changes to the hexo-github-db repository
export const pushToHexoRepo = async () => {
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
      throw new Error("Local repository does not exist. Please run pushToHexoRepo first.");
    }
  } else {
    if (!localRepoExists) {
      throw new Error("Repository hexo-github-db does not exist on GitHub. Please run pushToHexoRepo to create it.");
    } else {
      throw new Error("Local repository exists but remote does not. Please run pushToHexoRepo to create it.");
    }
  }
};

export const hexoExec = (cmd: string, args: object) => {
  const hexo = new Hexo(localHexoStarterDir, {
    debug: true,
  });

  hexo.plugin_dir = "D:\\MyProjects\\hexo-github\\node_modules\\";

  hexo.init().then(() => {
    process.on("SIGINT", () => {
      hexo.unwatch();
      hexo.exit();
    });
    hexo
      .call(cmd, args)
      .then(() => hexo.exit())
      .catch((err: any) =>
        hexo.exit(err)
      );
  });
};
