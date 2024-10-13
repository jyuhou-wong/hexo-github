import { homedir } from "os";
import { join } from "path";
import * as simpleGit from "simple-git";
import * as fs from "fs";
import { loadAccessToken, getOctokitInstance } from "./github";
import minimist from "minimist";
import axios from "axios";
import * as unzipper from "unzipper";
import Hexo from "hexo";

const homeDirectory: string = homedir();
const localHexoDir = join(homeDirectory, ".hexo-github");
const localHexoStarterDir = join(localHexoDir, "hexo-starter");
const git = simpleGit(localHexoDir);

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
        .on("close", () => {
          console.log("Extracted hexo-starter contents successfully.");
          // Optionally, rename the extracted folder if necessary
          fs.renameSync(
            join(localHexoDir, "hexo-starter-master"),
            join(localHexoDir, "hexo-starter")
          );
          // Clean up the ZIP file
          fs.unlinkSync(zipFilePath);
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
        "Local repository does not exist. Please run pushToHexoRepo first."
      );
    }
  } else {
    if (!localRepoExists) {
      throw new Error(
        "Repository hexo-github-db does not exist on GitHub. Please run pushToHexoRepo to create it."
      );
    } else {
      throw new Error(
        "Local repository exists but remote does not. Please run pushToHexoRepo to create it."
      );
    }
  }
};

export const hexoExec = (cmd: string) => {
  const hexo = new Hexo(localHexoStarterDir, {
    debug: true,
  });

  const argv = cmd.split(/\s+/);
  const args = minimist(argv, { string: ["_", "p", "path", "s", "slug"] });

  return hexo.init().then(() => {

    let cmd = 'help';

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
      .then(() => hexo.exit())
      .catch((err: any) => hexo.exit(err));
  });
};