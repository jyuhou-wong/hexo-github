import * as vscode from "vscode";
import {
  localAccessToken,
  localUsername,
  openDatabaseGit,
  openPageGit,
  openUserPage,
  pullHexo,
  pushHexo,
  removeAccessToken,
  revokeAccessToken,
  startOAuthLogin,
} from "../services/githubService";
import { executeWithFeedback } from "../utils";
import { TreeItem } from "../providers/blogsTreeDataProvider";

// Log in to GitHub
export const loginToGitHub = async (
  element: TreeItem,
  context: vscode.ExtensionContext
) => {
  await startOAuthLogin();
};

// Log out to GitHub
export const logoutFromGitHub = async (
  element: TreeItem,
  context: vscode.ExtensionContext
) => {
  // 向github请求吊销令牌
  await revokeAccessToken(localAccessToken);
  // 清除本地touken
  await removeAccessToken(localUsername);
};


// Pull Hexo repository
export const pullHexoRepository = async (
  element: TreeItem,
  context: vscode.ExtensionContext
) => {
  await pullHexo(context);
};

// Push to Hexo repository
export const pushHexoRepository = async (
  element: TreeItem,
  context: vscode.ExtensionContext
) => {
  await pushHexo(context);
};

// Open source Git repository (assuming this should be a different action)
export const openSourceRepository = async (
  element: TreeItem,
  context: vscode.ExtensionContext
) => {
  await executeWithFeedback(
    openDatabaseGit, // Assuming this should be a different function
    "Successfully opened source repository!",
    "Open failed"
  );
};

// Open source Git repository (assuming this should be a different action)
export const openPageRepository = async (
  element: TreeItem,
  context: vscode.ExtensionContext
) => {
  await executeWithFeedback(
    () => openPageGit(element), // Assuming this should be a different function
    "Successfully opened github pages repository!",
    "Open failed"
  );
};

// Open source Git repository (assuming this should be a different action)
export const openPage = async (
  element: TreeItem,
  context: vscode.ExtensionContext
) => {
  await executeWithFeedback(
    () => openUserPage(element), // Assuming this should be a different function
    "Successfully opened github pages!",
    "Open failed"
  );
};
