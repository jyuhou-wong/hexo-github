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
import { TreeItem } from "../providers/blogsTreeDataProvider";

// 确保配置目录存在
if (!fs.existsSync(EXT_CONFIG_PATH)) {
  fs.mkdirSync(EXT_CONFIG_PATH, { recursive: true });
}

// 定义接口
interface Config {
  accessToken: string | null;
}

interface EnableGitHubPagesParams {
  octokit: any;
  owner: string;
  repo: string;
  branch?: string;
  path?: string;
}

interface EnableGitHubPagesHttps {
  octokit: any;
  owner: string;
  repo: string;
}

// 加载访问令牌
export const loadAccessToken = (): string | null => {
  let config: Config = { accessToken: null };
  if (fs.existsSync(EXT_CONFIG_PATH)) {
    const rawData = fs.readFileSync(EXT_CONFIG_PATH, "utf8");
    try {
      config = JSON.parse(rawData) as Config;
    } catch (error) {
      console.error("Error parsing config file:", error);
    }
  }
  return config.accessToken;
};

// 保存访问令牌
const saveAccessToken = (accessToken: string): void => {
  const config: Config = { accessToken };
  fs.writeFileSync(EXT_CONFIG_PATH, JSON.stringify(config), "utf8");
};

// OAuth 登录
export const startOAuthLogin = async (): Promise<void> => {
  const app = express();
  const server = createServer(app);

  app.get("/auth/callback", async (req, res) => {
    const code = req.query.code as string;

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

      if (data.access_token) {
        saveAccessToken(data.access_token);

        const loginName = await getLoginName();
        vscode.window.showInformationMessage(`Logged in as ${loginName}`);

        res.send("Login successful! You can close this window.");
      } else {
        throw new Error("Access token not found in response");
      }
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

// 获取 Octokit 实例
export const getOctokitInstance = async (): Promise<any> => {
  const token = loadAccessToken();
  if (!token) {
    throw new Error("Access token is not set. Please log in first.");
  }
  const { Octokit } = await import("@octokit/rest");
  return new Octokit({ auth: token });
};

// 获取登录名
export const getLoginName = async (): Promise<string> => {
  const octokit = await getOctokitInstance();
  const { data: user } = await octokit.rest.users.getAuthenticated();
  return user.login;
};

// 检查仓库是否存在
export const checkRepoExists = async (
  octokit: any,
  repoName: string
): Promise<boolean> => {
  try {
    const { data: repos } = await octokit.rest.repos.listForAuthenticatedUser({
      type: "all",
    });
    return repos.some((repo: { name: string }) => repo.name === repoName);
  } catch (error) {
    throw error;
  }
};

// 下载并解压 Hexo Starter
const downloadAndExtractStarter = async (): Promise<void> => {
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
          await installNpmModules(EXT_HEXO_STARTER_DIR);
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

// 初始化本地仓库
const initializeLocalRepo = async (git: SimpleGit): Promise<void> => {
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
const createRemoteRepo = async (
  octokit: any,
  repoName: string
): Promise<void> => {
  const response = await octokit.rest.repos.createForAuthenticatedUser({
    name: repoName,
    private: true,
  });
  console.log(`Created repository: ${response.data.full_name}`);
};

export const deleteRemoteRepo = async (
  octokit: any,
  owner: string,
  repoName: string
): Promise<void> => {
  try {
    const response = await octokit.rest.repos.delete({
      owner,
      repo: repoName,
    });
    console.log(`Deleted repository: ${repoName}`);
  } catch (error: any) {
    console.error("Error deleting repository:", error.message);
  }
};

// 定义 `enableGitHubPages` 方法
export const enableGitHubPages = async ({
  octokit,
  owner,
  repo,
  branch = "main",
  path = "/",
}: EnableGitHubPagesParams): Promise<void> => {
  try {
    const response = await octokit.request("POST /repos/{owner}/{repo}/pages", {
      owner,
      repo,
      source: {
        branch,
        path,
      },
    });

    console.log("GitHub Pages 已启用:", response.data);
  } catch (error: any) {
    console.error("启用 GitHub Pages 时出错:", error.message);
  }
};

// 启用 HTTPS
export const enableHttps = async ({
  octokit,
  owner,
  repo,
}: EnableGitHubPagesHttps): Promise<void> => {
  try {
    const response = await octokit.request("PUT /repos/{owner}/{repo}/pages", {
      owner,
      repo,
      https_enforced: true, // 默认启用 HTTPS
    });
    console.log(response.status);
  } catch (error: any) {
    console.error("Error enabling HTTPS for GitHub Pages:", error.message);
  }
};

// 处理推送逻辑
const handlePush = async (git: SimpleGit): Promise<void> => {
  await git.add(".");
  await git.commit("feat: update hexo database");
  await git.push("origin", "main");
  console.log("Pushed to hexo-github-db successfully.");
};

// 检查并初始化本地仓库
const checkAndInitializeLocalRepo = async (
  git: SimpleGit
): Promise<boolean> => {
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
    } else {
      await git.checkout("main");
    }
    await git.pull("origin", "main");
  }

  return localRepoExists;
};

// 推送到 Hexo 仓库
export const pushHexo = async (): Promise<void> => {
  const octokit = await getOctokitInstance();
  const repoExists = await checkRepoExists(octokit, "hexo-github-db");
  const git = simpleGit(EXT_HOME_DIR);

  // 检查本地仓库
  await checkAndInitializeLocalRepo(git);

  if (!repoExists) {
    await initializeLocalRepo(git); // 初始化并创建远程仓库
    await createRemoteRepo(octokit, "hexo-github-db");
  }

  await handlePush(git);
};

// 拉取 Hexo 仓库
export const pullHexo = async (): Promise<void> => {
  const octokit = await getOctokitInstance();
  const repoExists = await checkRepoExists(octokit, "hexo-github-db");
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
export const pushToGitHubPages = async (element: TreeItem): Promise<void> => {
  const octokit = await getOctokitInstance();
  const hexo = await initializeHexo();
  const localPublicDir = path.join(
    EXT_HEXO_STARTER_DIR,
    hexo.config.public_dir
  );

  const { siteDir } = element;

  const loginName = await getLoginName();

  const userPageRepoName = `${loginName}.github.io`;
  const repoExists = await checkRepoExists(octokit, userPageRepoName);

  const localPublicDirExists = fs.existsSync(localPublicDir);
  if (!localPublicDirExists) fs.mkdirSync(localPublicDir, { recursive: true });

  const git = simpleGit(localPublicDir);

  const localRepoExists = fs.existsSync(path.join(localPublicDir, ".git"));
  if (!localRepoExists) {
    await git.init();
    const remoteUrl = `https://${loadAccessToken()}:x-oauth-basic@github.com/${loginName}/${userPageRepoName}.git`;
    await git.addRemote("origin", remoteUrl);

    const branches = await git.branchLocal();
    if (!branches.all.includes("main")) {
      await git.checkoutLocalBranch("main");
    } else {
      await git.checkout("main");
    }

    if (repoExists) await git.pull("origin", "main");
  }

  await hexoExec(siteDir, "generate");

  const excludePatterns: ExcludePattern[] = [
    ".git",
    HEXO_STARTER_DIRNAME,
    EXT_CONFIG_NAME,
  ];

  copyFiles(EXT_HOME_DIR, localPublicDir, excludePatterns);

  if (!repoExists) {
    const response = await octokit.rest.repos.createForAuthenticatedUser({
      name: userPageRepoName,
    });
    console.log(`Created repository: ${response.data.full_name}`);

    // 启用 GitHub Pages
    await enableGitHubPages({
      octokit,
      owner: loginName,
      repo: userPageRepoName,
      branch: "main",
      path: "/",
    });
  }

  await git.add(".");
  await git.commit("Deploy to GitHub Pages");
  await git.push("origin", "main", { "--force": null });
  console.log("Pushed to GitHub Pages successfully.");
};

// 打开 Hexo 数据库仓库
export const openDatabaseGit = async (): Promise<void> => {
  const octokit = await getOctokitInstance();

  const loginName = await getLoginName();

  const dbRepoExists = await checkRepoExists(octokit, "hexo-github-db");

  if (!dbRepoExists) {
    throw new Error(`"hexo-github-db" not found`);
  }

  const dbGitUrl = `https://github.com/${loginName}/hexo-github-db`;
  open(dbGitUrl);
};

// 打开用户页面仓库
export const openPageGit = async (element: TreeItem): Promise<void> => {
  const octokit = await getOctokitInstance();

  const loginName = await getLoginName();

  const userPageRepoName = `${loginName}.github.io`;
  const userPageRepoExists = await checkRepoExists(octokit, userPageRepoName);

  if (!userPageRepoExists) {
    throw new Error(`"${userPageRepoName}" not found`);
  }

  const pageGitUrl = `https://github.com/${loginName}/${userPageRepoName}`;
  open(pageGitUrl);
};

// 打开 GitHub Pages 网站
export const openUserPage = async (element: TreeItem): Promise<void> => {
  const octokit = await getOctokitInstance();

  const loginName = await getLoginName();

  const userPageRepoName = `${loginName}.github.io`;
  const userPageRepoExists = await checkRepoExists(octokit, userPageRepoName);

  if (!userPageRepoExists) {
    throw new Error(`"${userPageRepoName}" not found`);
  }

  const userPageUrl = `https://${loginName}.github.io`;
  open(userPageUrl);
};
