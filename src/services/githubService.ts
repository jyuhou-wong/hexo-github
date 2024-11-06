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
  ZIP_FILE_PATH,
  STARTER_REPO_ZIP_URL,
  EXT_CONFIG_PATH,
  EXT_HOME_DIR,
  COPYRIGHT_REPLACE_STRING,
  COPYRIGHT_SEARCH_REGEX,
} from "./config";
import { hexoExec, initializeHexo } from "./hexoService";
import {
  clearDirectory,
  handleError,
  installNpmModules,
  refreshBlogsProvider,
  replaceLastInHtmlLinks,
  setGitUser,
} from "../utils";
import { TreeItem } from "../providers/blogsTreeDataProvider";

export let localUsername: string = "";
export let localAccessToken: string = "";

// 确保插件用户目录存在
if (!fs.existsSync(EXT_HOME_DIR)) {
  fs.mkdirSync(EXT_HOME_DIR, { recursive: true });
}

interface Config {
  [userName: string]: {
    accessToken?: string;
  };
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
export const loadAccessToken = async (): Promise<string | undefined> => {
  let config: Config = {};

  if (fs.existsSync(EXT_CONFIG_PATH)) {
    const rawData = fs.readFileSync(EXT_CONFIG_PATH, "utf8");
    try {
      config = JSON.parse(rawData);
    } catch (error) {
      handleError(error, "Error parsing config file");
    }
  }

  const users = Object.keys(config);
  const userName = users.length ? users[0] : null;

  if (!userName) {
    return;
  }

  const userConfig = config[userName];

  const { accessToken } = userConfig;

  if (!accessToken) {
    return;
  }

  const latestName = await getLoginName(accessToken);

  if (!latestName) {
    removeAccessToken(userName);
    return;
  }

  saveAccessToken(latestName, accessToken);

  return accessToken; // 如果没有访问令牌，返回 null
};

// 保存访问令牌
export const saveAccessToken = (
  userName: string,
  accessToken: string
): void => {
  let config: Config = {
    [userName]: { accessToken },
  };
  fs.writeFileSync(EXT_CONFIG_PATH, JSON.stringify(config, null, 2), "utf8");

  // 保存token同时创建对应用户目录
  const userDir = path.join(EXT_HOME_DIR, userName);
  if (!fs.existsSync(userDir)) {
    fs.mkdirSync(userDir, { recursive: true });
  }

  localUsername = userName;
  localAccessToken = accessToken;
  vscode.commands.executeCommand(
    "setContext",
    "vscode-hexo-github.isLogin",
    true
  );
  vscode.commands
    .executeCommand("vscode-hexo-github.refreshTreeview")
    .then(() => vscode.commands.executeCommand("vscode-hexo-github.pullHexo"));
};

// 移除访问令牌
export const removeAccessToken = (userName: string) => {
  let config: Config = {};

  if (fs.existsSync(EXT_CONFIG_PATH)) {
    const rawData = fs.readFileSync(EXT_CONFIG_PATH, "utf8");
    try {
      config = JSON.parse(rawData);
    } catch (error) {
      handleError(error, "Error parsing config file");
    }
  }

  if (config[userName]) {
    delete config[userName];
    fs.writeFileSync(EXT_CONFIG_PATH, JSON.stringify(config, null, 2), "utf8");
  }

  localUsername = "";
  localAccessToken = "";

  vscode.commands.executeCommand(
    "setContext",
    "vscode-hexo-github.isLogin",
    false
  );
  vscode.commands.executeCommand("vscode-hexo-github.refreshTreeview");
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
        const octokit = await getUserOctokitInstance(data.access_token);

        const { data: user } = await octokit.rest.users.getAuthenticated();
        const loginName = user.login;

        saveAccessToken(loginName, data.access_token);

        vscode.window.showInformationMessage(`Logged in as ${loginName}`);

        res.send("Login successful! You can close this window.");
      } else {
        throw new Error("Access token not found in response");
      }
    } catch (error) {
      handleError(error, "Error during authentication");
      res.send("Login failed! Please check the console for details.");
    } finally {
      server.close();
    }
  });

  server.listen(3000, async () => {
    const authUrl = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${REDIRECT_URI}&scope=repo%20delete_repo%20user`;
    await open(authUrl);
  });
};

// 吊销令牌
export const revokeAccessToken = async (
  access_token: string
): Promise<void> => {
  const octokit = await getAppOctokitInstance();

  try {
    // 吊销当前访问令牌
    const response = await octokit.rest.apps.deleteToken({
      client_id: GITHUB_CLIENT_ID,
      access_token,
    });
    vscode.window.showInformationMessage("Token revoked successfully.");
  } catch (error) {
    handleError(error, "Error revoking token");
  }
};

// 获取 User Octokit 实例
export const getUserOctokitInstance = async (
  accessToken: string
): Promise<any> => {
  if (!accessToken) {
    throw new Error("Access token is not set. Please log in first.");
  }
  const { Octokit } = await import("@octokit/rest");
  return new Octokit({ auth: accessToken });
};

// 获取 App Octokit 实例
export const getAppOctokitInstance = async (): Promise<any> => {
  const { Octokit } = await import("@octokit/rest");
  const { createOAuthAppAuth } = await import("@octokit/auth-oauth-app");
  return new Octokit({
    authStrategy: createOAuthAppAuth,
    auth: {
      clientType: "oauth-app",
      clientId: GITHUB_CLIENT_ID,
      clientSecret: GITHUB_CLIENT_SECRET,
    },
  });
};

//
export const getLoginName = async (
  accessToken: string
): Promise<string | undefined> => {
  const octokit = await getUserOctokitInstance(accessToken);
  try {
    const { data: user } = await octokit.rest.users.getAuthenticated();
    return user.login;
  } catch (error) {
    // 不抛出错误直接返回
    console.error(error);
    return;
  }
};

// 检查仓库是否存在
export const checkRepoExists = async (
  octokit: any,
  repoName: string
): Promise<any> => {
  try {
    const { data: repos } = await octokit.rest.repos.listForAuthenticatedUser({
      type: "all",
    });
    return repos.find((repo: { name: string }) => repo.name === repoName);
  } catch (error) {
    throw error;
  }
};

// 初始化本地仓库
export const initializeSite = async (siteDir: string): Promise<void> => {
  if (fs.existsSync(siteDir)) {
    throw new Error(`site ${path.basename(siteDir)} already exists`);
  }

  vscode.window.showInformationMessage("Creating...");

  const response = await axios({
    method: "get",
    url: STARTER_REPO_ZIP_URL,
    responseType: "stream",
  });
  const writer = fs.createWriteStream(ZIP_FILE_PATH);

  response.data.pipe(writer);

  return new Promise<void>((resolve, reject) => {
    writer.on("finish", async () => {
      fs.createReadStream(ZIP_FILE_PATH)
        .pipe(unzipper.Extract({ path: EXT_HOME_DIR }))
        .on("close", async () => {
          vscode.window.showInformationMessage(
            "Extracted hexo-starter contents successfully."
          );
          const extractedDir = path.join(EXT_HOME_DIR, "hexo-starter-master");
          fs.renameSync(extractedDir, siteDir);
          fs.unlinkSync(ZIP_FILE_PATH);
          await installNpmModules(siteDir);
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

    vscode.window.showInformationMessage("GitHub Pages 已启用");
  } catch (error) {
    handleError(error, "启用 GitHub Pages 时出错");
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
    vscode.window.showInformationMessage(response.status);
  } catch (error) {
    handleError(error, "Error enabling HTTPS for GitHub Pages");
  }
};

// 创建远程仓库
export const createRemoteRepo = async (
  octokit: any,
  repoName: string
): Promise<void> => {
  const response = await octokit.rest.repos.createForAuthenticatedUser({
    name: repoName,
    private: true,
  });
  vscode.window.showInformationMessage(
    `Created repository: ${response.data.full_name}`
  );
};

// 删除远程仓库
export const deleteRemoteRepo = async (
  octokit: any,
  owner: string,
  repoName: string
): Promise<void> => {
  try {
    await octokit.rest.repos.delete({ owner, repo: repoName });
    vscode.window.showInformationMessage(`Deleted repository: ${repoName}`);
  } catch (error: any) {
    vscode.window.showErrorMessage("Error deleting repository:", error.message);
  }
};

// 推送到 Hexo 仓库
export const pushHexo = async (
  context: vscode.ExtensionContext
): Promise<void> => {
  await pullHexo(context);

  const git = simpleGit(path.join(EXT_HOME_DIR, localUsername));
  await setGitUser(git);

  await git.add(".");
  await git.commit(
    "Update by https://github.com/jyuhou-wong/vscode-hexo-github"
  );
  await git.push("origin", "main");
  vscode.window.showInformationMessage(
    "Pushed to vscode-hexo-github-db successfully."
  );
};

// 拉取 Hexo 仓库
export const pullHexo = async (
  context: vscode.ExtensionContext
): Promise<void> => {
  const octokit = await getUserOctokitInstance(localAccessToken);
  const repoExists = await checkRepoExists(octokit, "vscode-hexo-github-db");
  const userDir = path.join(EXT_HOME_DIR, localUsername);

  const git = simpleGit(userDir);
  await setGitUser(git);

  const localRepoExists = fs.existsSync(path.join(userDir, ".git"));

  if (repoExists) {
    await handleExistingRepo(git, localRepoExists);
  } else {
    await handleNonExistingRepo(octokit, git, localRepoExists);
  }

  vscode.window.showInformationMessage(
    "Pulled latest changes from vscode-hexo-github-db successfully."
  );

  refreshBlogsProvider(context);
};

// 处理已存在的仓库
const handleExistingRepo = async (
  git: SimpleGit,
  localRepoExists: boolean
): Promise<void> => {
  if (localRepoExists) {
    await git.pull("origin", "main", [
      "--allow-unrelated-histories",
      "--strategy-option=theirs",
    ]);
    vscode.window.showInformationMessage(
      "Pulled latest changes from vscode-hexo-github-db successfully."
    );
  } else {
    await initializeLocalRepo(git);
  }
};

// 初始化本地仓库
const initializeLocalRepo = async (git: SimpleGit): Promise<void> => {
  vscode.window.showInformationMessage(
    "Local repository does not exist. Pulling..."
  );
  await git.init();
  await checkoutBranch(git);
  await git.add(".");
  await git.commit(
    "Update by https://github.com/jyuhou-wong/vscode-hexo-github"
  );
  const remoteUrl = `https://${localAccessToken}:x-oauth-basic@github.com/${localUsername}/vscode-hexo-github-db.git`;
  await git.addRemote("origin", remoteUrl);
  await git.pull("origin", "main", [
    "--allow-unrelated-histories",
    "--strategy-option=theirs",
  ]);
};

// 处理不存在的仓库
const handleNonExistingRepo = async (
  octokit: any,
  git: SimpleGit,
  localRepoExists: boolean
): Promise<void> => {
  if (!localRepoExists) {
    vscode.window.showInformationMessage(
      "Remote vscode-hexo-github-db and local repository do not exist. Creating..."
    );
    await createLocalRepo(octokit, git);
  } else {
    vscode.window.showInformationMessage(
      "Local repository exists but remote vscode-hexo-github-db does not exist. Creating..."
    );
    await createRemoteRepo(octokit, "vscode-hexo-github-db");
    await git.push("origin", "main");
  }
};

// 创建本地仓库
const createLocalRepo = async (octokit: any, git: SimpleGit): Promise<void> => {
  await git.init();

  const readmePath = path.join(EXT_HOME_DIR, localUsername, "README.md");
  fs.writeFileSync(
    readmePath,
    "# Hexo GitHub Pages Repository\n\nThis is my blog released by using [vscode-hexo-github](https://github.com/jyuhou-wong/vscode-hexo-github) vscode extensions."
  );

  const gitignorePath = path.join(EXT_HOME_DIR, localUsername, ".gitignore");
  fs.writeFileSync(gitignorePath, "node_modules/\npublic/");

  await git.add(".");
  await git.commit("Initial repository");

  const remoteUrl = `https://${localAccessToken}:x-oauth-basic@github.com/${localUsername}/vscode-hexo-github-db.git`;
  await git.addRemote("origin", remoteUrl);
  await checkoutBranch(git);
  await createUserPageRepoIfNeeded(localUsername);
  await createRemoteRepo(octokit, "vscode-hexo-github-db");
  await git.push("origin", "main");
};

// 检查并创建用户页面仓库
const createUserPageRepoIfNeeded = async (loginName: string): Promise<void> => {
  const userPageRepoName = `${loginName}.github.io`;
  const userPageDir = path.join(EXT_HOME_DIR, localUsername, userPageRepoName);
  if (!fs.existsSync(userPageDir)) {
    await initializeSite(userPageDir);
    await pushToGitHubPages({
      userName: localUsername,
      siteDir: userPageDir,
      siteName: userPageRepoName,
    } as TreeItem);
  }
};

// 切换到主分支
const checkoutBranch = async (git: SimpleGit): Promise<void> => {
  const branches = await git.branchLocal();
  if (!branches.all.includes("main")) {
    await git.checkoutLocalBranch("main");
  } else {
    await git.checkout("main");
  }
};

// Push to GitHub Pages
export const pushToGitHubPages = async (element: TreeItem): Promise<void> => {
  const { userName, siteDir, siteName } = element;

  const octokit = await getUserOctokitInstance(localAccessToken);

  const hexo = await initializeHexo(siteDir);
  const publicDir = hexo.public_dir;

  const repoExists = await checkRepoExists(octokit, siteName);

  if (!repoExists) {
    const response = await octokit.rest.repos.createForAuthenticatedUser({
      name: siteName,
    });
    vscode.window.showInformationMessage(
      `Created repository: ${response.data.full_name}`
    );
  }

  const publicDirExists = fs.existsSync(publicDir);
  if (!publicDirExists) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  const git = simpleGit(publicDir);
  await setGitUser(git);

  const localRepoExists = fs.existsSync(path.join(publicDir, ".git"));
  if (!localRepoExists) {
    await git.init();
    const remoteUrl = `https://${localAccessToken}:x-oauth-basic@github.com/${userName}/${siteName}.git`;
    await git.addRemote("origin", remoteUrl);

    const branches = await git.branchLocal();
    if (!branches.all.includes("main")) {
      await git.checkoutLocalBranch("main");
    } else {
      await git.checkout("main");
    }

    // 从远程仓库 origin 获取 main 分支的最新提交
    if (repoExists) {
      await git.pull("origin", "main", [
        "--allow-unrelated-histories",
        "--strategy-option=ours",
      ]);
    }

    // 只保留 .git，防止其他文件干扰
    clearDirectory(publicDir, [".git"]);
  }

  await hexoExec(siteDir, "generate");

  replaceLastInHtmlLinks(
    publicDir,
    ".html",
    COPYRIGHT_SEARCH_REGEX,
    COPYRIGHT_REPLACE_STRING
  );

  const userDir = path.join(EXT_HOME_DIR, userName);

  const items = fs.readdirSync(userDir);

  const excludeFiles = [".gitignore", "config.json"];

  items.forEach((item) => {
    const srcItem = path.join(userDir, item);
    const destItem = path.join(publicDir, item);
    if (
      !fs.statSync(srcItem).isDirectory() &&
      !excludeFiles.some((v) => v === item)
    ) {
      fs.copyFileSync(srcItem, destItem);
    }
  });

  await git.add(".");
  await git.commit(
    "Deploy by https://github.com/jyuhou-wong/vscode-hexo-github"
  );
  await git.push("origin", "main", { "--force": null });

  if (!repoExists) {
    // 启用 GitHub Pages
    await enableGitHubPages({
      octokit,
      owner: userName,
      repo: siteName,
      branch: "main",
      path: "/",
    });

    await enableHttps({ octokit, owner: userName, repo: siteName });
  }

  vscode.window.showInformationMessage("Pushed to GitHub Pages successfully.");
};

// 打开 Hexo 数据库仓库
export const openDatabaseGit = async (): Promise<void> => {
  const octokit = await getUserOctokitInstance(localAccessToken);

  const dbRepoExists = await checkRepoExists(octokit, "vscode-hexo-github-db");

  if (!dbRepoExists) {
    throw new Error(`"vscode-hexo-github-db" not found`);
  }

  const dbGitUrl = `https://github.com/${localUsername}/vscode-hexo-github-db`;
  open(dbGitUrl);
};

// 打开用户页面仓库
export const openPageGit = async (element: TreeItem): Promise<void> => {
  const { siteName } = element;

  const octokit = await getUserOctokitInstance(localAccessToken);

  const pageRepo = await checkRepoExists(octokit, siteName);

  if (!pageRepo) {
    throw new Error(`"${siteName}" not found`);
  }

  open(pageRepo.html_url);
};

// 打开 GitHub Pages 网站
export const openUserPage = async (element: TreeItem): Promise<void> => {
  const { userName, siteName } = element;

  const octokit = await getUserOctokitInstance(localAccessToken);

  const pageRepo = await checkRepoExists(octokit, siteName);

  if (!pageRepo) {
    throw new Error(`"${siteName}" not found`);
  }

  const pageUrl = `https://${userName}.github.io/${siteName}`;
  open(pageUrl);
};
