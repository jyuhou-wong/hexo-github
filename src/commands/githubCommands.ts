import * as vscode from "vscode";
import { pullHexoRepo, pushHexoRepo, startOAuthLogin } from "../services/githubService";
import { handleError } from "../utils";

// Log in to GitHub
export const loginToGitHub = async () => {
  try {
    await startOAuthLogin();
    vscode.window.showInformationMessage("Successfully logged in to GitHub!");
  } catch (error) {
    handleError(error, "Login failed");
  }
};

// Pull Hexo repository
export const pullHexoRepository = async () => {
  try {
    await pullHexoRepo();
    vscode.window.showInformationMessage("Successfully pulled hexo-github-db repository!");
  } catch (error) {
    handleError(error, "Pull failed");
  }
};

// Push to Hexo repository
export const pushHexoRepository = async () => {
  try {
    await pushHexoRepo();
    vscode.window.showInformationMessage("Successfully pushed to hexo-github-db repository!");
  } catch (error) {
    handleError(error, "Push failed");
  }
};
