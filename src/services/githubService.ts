import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { Octokit } from "@octokit/rest";
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
  CONFIG_DIR,
  CONFIG_FILE_PATH,
  LOCAL_HEXO_DIR,
  LOCAL_HEXO_STARTER_DIR,
  ZIP_FILE_PATH,
  STARTER_REPO_ZIP_URL,
} from "./config";
import { hexoExec, initializeHexo } from "./hexoService";
import { installNpmModules } from "../utils";

// Ensure configuration directory exists
if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });

export const loadAccessToken = () => {
  let accessToken: string | null = null;
  if (fs.existsSync(CONFIG_FILE_PATH)) {
    accessToken =
      JSON.parse(fs.readFileSync(CONFIG_FILE_PATH, "utf8")).accessToken || null;
  }
  return accessToken;
};

const saveAccessToken = (accessToken: string) => {
  fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify({ accessToken }), "utf8");
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
export const getOctokitInstance = () => {
  if (!loadAccessToken()) {
    throw new Error("Access token is not set. Please log in first.");
  }
  return new Octokit({ auth: loadAccessToken() });
};

// Check if repository exists
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
        .pipe(unzipper.Extract({ path: LOCAL_HEXO_DIR }))
        .on("close", async () => {
          console.log("Extracted hexo-starter contents successfully.");
          const extractedDir = path.join(LOCAL_HEXO_DIR, "hexo-starter-master");
          const targetDir = path.join(LOCAL_HEXO_DIR, "hexo-starter");
          fs.renameSync(extractedDir, targetDir);
          fs.unlinkSync(ZIP_FILE_PATH);
          await installNpmModules(LOCAL_HEXO_STARTER_DIR);
          resolve();
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
  const git = simpleGit(LOCAL_HEXO_DIR);
  await git.init();
  console.log("Initialized local repository.");

  const readmePath = path.join(LOCAL_HEXO_DIR, "README.md");
  fs.writeFileSync(
    readmePath,
    "# Hexo GitHub Repository\n\nThis is the initial commit."
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
export const pushHexoRepo = async () => {
  const octokit = getOctokitInstance();
  const repoExists = await checkRepoExists("hexo-github-db", octokit);
  const localRepoExists = fs.existsSync(path.join(LOCAL_HEXO_DIR, ".git"));

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
    await simpleGit(LOCAL_HEXO_DIR).addRemote("origin", remoteUrl);
  }

  const git = simpleGit(LOCAL_HEXO_DIR);
  await git.add(".");
  await git.commit("feat: update hexo database");
  await git.push("origin", "main");
  console.log("Pushed to hexo-github-db successfully.");
};

// Pull Hexo repository
export const pullHexoRepo = async () => {
  const octokit = getOctokitInstance();
  const repoExists = await checkRepoExists("hexo-github-db", octokit);
  const localRepoPath = path.join(LOCAL_HEXO_DIR, ".git");
  const localRepoExists = fs.existsSync(localRepoPath);

  if (repoExists) {
    if (localRepoExists) {
      try {
        await simpleGit(LOCAL_HEXO_DIR).pull("origin", "main");
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

// Push to GitHub Pages
export const pushToGitHubPages = async () => {
  const octokit = getOctokitInstance();
  const hexo = await initializeHexo(LOCAL_HEXO_STARTER_DIR);
  const localPublicDir = path.join(
    LOCAL_HEXO_STARTER_DIR,
    hexo.config.public_dir
  );
  const { data: user } = await octokit.rest.users.getAuthenticated();

  const repoExists = await checkRepoExists(`${user.login}.github.io`, octokit);
  const localRepoExists = fs.existsSync(path.join(localPublicDir, ".git"));

  await hexoExec("generate");

  const git = simpleGit(localPublicDir);

  if (!localRepoExists) {
    await git.init();
    const remoteUrl = `https://${loadAccessToken()}:x-oauth-basic@github.com/${
      user.login
    }/${user.login}.github.io.git`;
    await git.addRemote("origin", remoteUrl);
  }

  const branches = await git.branchLocal();
  if (!branches.all.includes("main")) {
    await git.checkoutLocalBranch("main");
  } else {
    await git.checkout("main");
  }

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
