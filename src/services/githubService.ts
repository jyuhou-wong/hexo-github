import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import express from "express";
import open from "open";
import { createServer } from "http";
import axios from "axios";
import { simpleGit, SimpleGit } from "simple-git";
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

      const loginName = await getLoginName();
      vscode.window.showInformationMessage(`Logged in as ${loginName}`);

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

export const getLoginName = async () => {
  const octokit = await getOctokitInstance();
  const { data: user } = await octokit.rest.users.getAuthenticated();
  return user.login;
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

// 初始化本地仓库
const initializeLocalRepo = async (git: SimpleGit) => {
  const readmePath = path.join(EXT_HOME_DIR, "README.md");
  fs.writeFileSync(
    readmePath,
    "# Hexo GitHub Pages Repository\n\nThis is my blog."
  );
  await git.add(readmePath);
  await git.commit("Initial commit with README");
  await downloadAndExtractStarter();
  console.log("Added HexoStarter contents.");
};

// 创建远程仓库
const createRemoteRepo = async (octokit: any) => {
  const response = await octokit.rest.repos.createForAuthenticatedUser({
    name: "hexo-github-db",
    private: true,
  });
  console.log(`Created repository: ${response.data.full_name}`);
};

// 处理推送逻辑
const handlePush = async (git: SimpleGit) => {
  await git.add(".");
  await git.commit("feat: update hexo database");
  await git.push("origin", "main");
  console.log("Pushed to hexo-github-db successfully.");
};

// 检查并初始化本地仓库
const checkAndInitializeLocalRepo = async (git: SimpleGit) => {
  const localRepoExists = fs.existsSync(path.join(EXT_HOME_DIR, ".git"));

  if (!localRepoExists) {
    await git.init();
    await git.add(".");
    console.log("Initialized local repository.");
    const loginName = await getLoginName();
    const remoteUrl = `https://${loadAccessToken()}:x-oauth-basic@github.com/${loginName}/hexo-github-db.git`;
    await git.addRemote("origin", remoteUrl);

    const branches = await git.branchLocal();
    if (!branches.all.includes("main")) {
      await git.checkoutLocalBranch("main");
    }
    await git.pull("origin", "main");
  }

  return localRepoExists;
};

// 推送到 Hexo 仓库
export const pushHexo = async () => {
  const octokit = await getOctokitInstance();
  const repoExists = await checkRepoExists("hexo-github-db", octokit);
  const git = simpleGit(EXT_HOME_DIR);

  // 检查本地仓库
  await checkAndInitializeLocalRepo(git);

  if (!repoExists) {
    await initializeLocalRepo(git); // 初始化并创建远程仓库
    await createRemoteRepo(octokit);
  }

  await handlePush(git);
};

// 拉取 Hexo 仓库
export const pullHexo = async () => {
  const octokit = await getOctokitInstance();
  const repoExists = await checkRepoExists("hexo-github-db", octokit);
  const git = simpleGit(EXT_HOME_DIR);
  const localRepoExists = fs.existsSync(path.join(EXT_HOME_DIR, ".git"));

  if (repoExists) {
    if (localRepoExists) {
      await git.pull("origin", "main");
      vscode.window.showInformationMessage(
        "Pulled latest changes from hexo-github-db successfully."
      );
    } else {
      vscode.window.showInformationMessage(
        "Local repository does not exist. Creating..."
      );
      if (await checkAndInitializeLocalRepo(git)) {
        await git.pull("origin", "main");
      }
    }
  } else {
    if (!localRepoExists) {
      vscode.window.showInformationMessage(
        "Remote hexo-github-db and local repository do not exist. Creating..."
      );
      await pushHexo();
    } else {
      vscode.window.showInformationMessage(
        "Local repository exists but remote hexo-github-db does not exist. Creating..."
      );
      await pushHexo();
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

  const loginName = await getLoginName();

  const repoExists = await checkRepoExists(`${loginName}.github.io`, octokit);

  const localPublicDirExists = fs.existsSync(localPublicDir);
  if (!localPublicDirExists) fs.mkdirSync(localPublicDir, { recursive: true });

  const git = simpleGit(localPublicDir);

  const localRepoExists = fs.existsSync(path.join(localPublicDir, ".git"));
  if (!localRepoExists) {
    await git.init();
    const remoteUrl = `https://${loadAccessToken()}:x-oauth-basic@github.com/${loginName}/${loginName}.github.io.git`;
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
      name: `${loginName}.github.io`,
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

  const loginName = await getLoginName();

  const dbRepoExists = await checkRepoExists("hexo-github-db", octokit);

  if (!dbRepoExists) {
    throw new Error(`"hexo-github-db" not found`);
  }

  const dbGitUrl = `https://github.com/${loginName}/hexo-github-db`;
  open(dbGitUrl);
};

export const openPageGit = async () => {
  const octokit = await getOctokitInstance();

  const loginName = await getLoginName();

  const userPageRepoExists = await checkRepoExists(
    `${loginName}.github.io`,
    octokit
  );

  if (!userPageRepoExists) {
    throw new Error(`"${loginName}.github.io" not found`);
  }

  const pageGitUrl = `https://github.com/${loginName}/${loginName}.github.io`;
  open(pageGitUrl);
};

// Open GitHub Pages
export const openUserPage = async () => {
  const octokit = await getOctokitInstance();

  const loginName = await getLoginName();

  const userPageRepoExists = await checkRepoExists(
    `${loginName}.github.io`,
    octokit
  );

  if (!userPageRepoExists) {
    throw new Error(`"${loginName}.github.io" not found`);
  }

  const userPageUrl = `https://${loginName}.github.io`;
  open(userPageUrl);
};
