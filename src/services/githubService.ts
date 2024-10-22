import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import express from "express";
import open from "open";
import { createServer } from "http";
import axios from "axios";
import simpleGit from "simple-git";
import * as unzipper from "unzipper";
import {
  GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET,
  REDIRECT_URI,
  EXT_HEXO_STARTER_DIR,
  ZIP_FILE_PATH,
  STARTER_REPO_ZIP_URL,
  HEXO_STARTER_DIRNAME,
  EXT_CONFIG_PATH,
  EXT_HOME_DIR,
  EXT_CONFIG_NAME,
} from "./config";
import { hexoExec, initializeHexo } from "./hexoService";
import { copyFiles, installNpmModules } from "../utils";
import type { ExcludePattern } from "../utils";

// Ensure configuration directory exists
if (!fs.existsSync(EXT_CONFIG_PATH)) {
  fs.mkdirSync(EXT_CONFIG_PATH, { recursive: true });
}

export const loadAccessToken = () => {
  let accessToken: string | null = null;
  if (fs.existsSync(EXT_CONFIG_PATH)) {
    accessToken =
      JSON.parse(fs.readFileSync(EXT_CONFIG_PATH, "utf8")).accessToken || null;
  }
  return accessToken;
};

const saveAccessToken = (accessToken: string) => {
  fs.writeFileSync(EXT_CONFIG_PATH, JSON.stringify({ accessToken }), "utf8");
};

export const startOAuthLogin = async () => {
  const app = express();
  const server = createServer(app);

  app.get("/auth/callback", async (req, res) => {
    const { code } = req.query;

    try {
      const { data } = await axios.post(
        `https://github.com/login/oauth/access_token`,
        {
          client_id: GITHUB_CLIENT_ID,
          client_secret: GITHUB_CLIENT_SECRET,
          code,
        },
        { headers: { Accept: "application/json" } }
      );

      saveAccessToken(data.access_token);
      const { Octokit } = await import("@octokit/rest");

      const octokit = new Octokit({ auth: loadAccessToken() });
      const { data: user } = await octokit.rest.users.getAuthenticated();
      vscode.window.showInformationMessage(`Logged in as ${user.login}`);

      res.send("Login successful! You can close this window.");
    } catch (error: any) {
      vscode.window.showErrorMessage(
        `Error during authentication: ${error.message}`
      );
      res.send("Login failed! Please check the console for details.");
    } finally {
      server.close();
    }
  });

  server.listen(3000, async () => {
    const authUrl = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${REDIRECT_URI}&scope=repo%20user`;
    await open(authUrl);
  });
};

// Get Octokit instance
export const getOctokitInstance = async () => {
  if (!loadAccessToken()) {
    throw new Error("Access token is not set. Please log in first.");
  }
  const { Octokit } = await import("@octokit/rest");
  return new Octokit({ auth: loadAccessToken() });
};

// Check if repository exists
const checkRepoExists = async (repoName: string, octokit: any) => {
  try {
    const { data: repos } = await octokit.rest.repos.listForAuthenticatedUser({
      type: "all",
    });
    return repos.some((repo: { name: string }) => repo.name === repoName);
  } catch (error) {
    throw error;
  }
};

// Download and extract Hexo Starter
const downloadAndExtractStarter = async () => {
  const response = await axios({
    method: "get",
    url: STARTER_REPO_ZIP_URL,
    responseType: "stream",
  });
  const writer = fs.createWriteStream(ZIP_FILE_PATH);

  response.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on("finish", async () => {
      fs.createReadStream(ZIP_FILE_PATH)
        .pipe(unzipper.Extract({ path: EXT_HOME_DIR }))
        .on("close", async () => {
          console.log("Extracted hexo-starter contents successfully.");
          const extractedDir = path.join(EXT_HOME_DIR, "hexo-starter-master");
          fs.renameSync(extractedDir, EXT_HEXO_STARTER_DIR);
          fs.unlinkSync(ZIP_FILE_PATH);
          const result = await installNpmModules(EXT_HEXO_STARTER_DIR);
          resolve(result);
        })
        .on("error", (error) =>
          reject(new Error(`Error extracting ZIP file: ${error.message}`))
        );
    });

    writer.on("error", (error) =>
      reject(new Error(`Error writing ZIP file: ${error.message}`))
    );
  });
};

// Initialize local repository
const initializeLocalRepo = async () => {
  const git = simpleGit(EXT_HOME_DIR);
  await git.init();
  console.log("Initialized local repository.");

  const readmePath = path.join(EXT_HOME_DIR, "README.md");
  fs.writeFileSync(
    readmePath,
    "# Hexo GitHub Pages Repository\n\nThis is my blog."
  );
  await git.add(readmePath);
  await git.commit("Initial commit with README");

  const branches = await git.branchLocal();
  if (!branches.all.includes("main")) {
    await git.checkoutLocalBranch("main");
  } else {
    await git.checkout("main");
  }

  await downloadAndExtractStarter();
  console.log("Added HexoStarter contents.");
};

// Push changes to the Hexo GitHub repository
export const pushHexo = async () => {
  const octokit = await getOctokitInstance();
  const repoExists = await checkRepoExists("hexo-github-db", octokit);
  const localRepoExists = fs.existsSync(path.join(EXT_HOME_DIR, ".git"));

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
    const { data: user } = await octokit.rest.users.getAuthenticated();
    const remoteUrl = `https://${loadAccessToken()}:x-oauth-basic@github.com/${
      user.login
    }/hexo-github-db.git`;
    await simpleGit(EXT_HOME_DIR).addRemote("origin", remoteUrl);
  }

  const git = simpleGit(EXT_HOME_DIR);
  await git.add(".");
  await git.commit("feat: update hexo database");
  await git.push("origin", "main");
  console.log("Pushed to hexo-github-db successfully.");
};

// Pull Hexo repository
export const pullHexo = async () => {
  const octokit = await getOctokitInstance();
  const repoExists = await checkRepoExists("hexo-github-db", octokit);
  const localRepoPath = path.join(EXT_HOME_DIR, ".git");
  const localRepoExists = fs.existsSync(localRepoPath);

  if (repoExists) {
    if (localRepoExists) {
      try {
        await simpleGit(EXT_HOME_DIR).pull("origin", "main");
        console.log("Pulled latest changes from hexo-github-db successfully.");
      } catch (error) {
        throw error;
      }
    } else {
      throw new Error(
        "Local repository does not exist. Please run pushHexo first."
      );
    }
  } else {
    if (!localRepoExists) {
      throw new Error(
        "Repository hexo-github-db does not exist on GitHub. Please run pushHexo to create it."
      );
    } else {
      throw new Error(
        "Local repository exists but remote does not. Please run pushHexo to create it."
      );
    }
  }
};

// Push to GitHub Pages
export const pushToGitHubPages = async () => {
  const octokit = await getOctokitInstance();
  const hexo = await initializeHexo();
  const localPublicDir = path.join(
    EXT_HEXO_STARTER_DIR,
    hexo.config.public_dir
  );

  const { data: user } = await octokit.rest.users.getAuthenticated();

  const repoExists = await checkRepoExists(`${user.login}.github.io`, octokit);

  const localPublicDirExists = fs.existsSync(localPublicDir);
  if (!localPublicDirExists) fs.mkdirSync(localPublicDir, { recursive: true });

  const git = simpleGit(localPublicDir);

  const localRepoExists = fs.existsSync(path.join(localPublicDir, ".git"));
  if (!localRepoExists) {
    await git.init();
    const remoteUrl = `https://${loadAccessToken()}:x-oauth-basic@github.com/${
      user.login
    }/${user.login}.github.io.git`;
    await git.addRemote("origin", remoteUrl);

    const branches = await git.branchLocal();
    if (!branches.all.includes("main")) {
      await git.checkoutLocalBranch("main");
    } else {
      await git.checkout("main");
    }

    if (repoExists) await git.pull("origin", "main");
  }

  await hexoExec("generate");

  const excludePatterns: ExcludePattern[] = [
    ".git",
    HEXO_STARTER_DIRNAME,
    EXT_CONFIG_NAME,
  ];

  copyFiles(EXT_HOME_DIR, localPublicDir, excludePatterns);

  if (!repoExists) {
    const response = await octokit.rest.repos.createForAuthenticatedUser({
      name: `${user.login}.github.io`,
    });
    console.log(`Created repository: ${response.data.full_name}`);
  }

  await git.add(".");
  await git.commit("Deploy to GitHub Pages");
  await git.push("origin", "main", { "--force": null });
  console.log("Pushed to GitHub Pages successfully.");
};

export const openDatabaseGit = async () => {
  const octokit = await getOctokitInstance();

  const { data: user } = await octokit.rest.users.getAuthenticated();

  const dbRepoExists = await checkRepoExists("hexo-github-db", octokit);

  if (!dbRepoExists) {
    throw new Error(`"hexo-github-db" not found`);
  }

  const dbGitUrl = `https://github.com/${user.login}/hexo-github-db`;
  open(dbGitUrl);
};

export const openPageGit = async () => {
  const octokit = await getOctokitInstance();

  const { data: user } = await octokit.rest.users.getAuthenticated();

  const userPageRepoExists = await checkRepoExists(
    `${user.login}.github.io`,
    octokit
  );

  if (!userPageRepoExists) {
    throw new Error(`"${user.login}.github.io" not found`);
  }

  const pageGitUrl = `https://github.com/${user.login}/${user.login}.github.io`;
  open(pageGitUrl);
};

// Open GitHub Pages
export const openUserPage = async () => {
  const octokit = await getOctokitInstance();

  const { data: user } = await octokit.rest.users.getAuthenticated();

  const userPageRepoExists = await checkRepoExists(
    `${user.login}.github.io`,
    octokit
  );

  if (!userPageRepoExists) {
    throw new Error(`"${user.login}.github.io" not found`);
  }

  const userPageUrl = `https://${user.login}.github.io`;
  open(userPageUrl);
};
