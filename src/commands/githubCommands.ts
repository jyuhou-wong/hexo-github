import * as vscode from "vscode";
import { startOAuthLogin } from "../services/githubService";
import { pullHexoRepo, pushHexoRepo } from "../services/hexoService";

// Log in to GitHub
export const loginToGitHub = async () => {
  try {
    await startOAuthLogin();
    vscode.window.showInformationMessage("Successfully logged in to GitHub!");
  } catch (error) {
    vscode.window.showErrorMessage(`Login failed: ${error.message}`);
  }
};

// Pull Hexo repository
export const pullHexoRepository = async () => {
  try {
    await pullHexoRepo();
    vscode.window.showInformationMessage(
      "Successfully pulled hexo-github-db repository!"
    );
  } catch (error) {
    vscode.window.showErrorMessage(`Pull failed: ${error.message}`);
  }
};

// Push to Hexo repository
export const pushHexoRepository = async () => {
  try {
    await pushHexoRepo();
    vscode.window.showInformationMessage(
      "Successfully pushed to hexo-github-db repository!"
    );
  } catch (error) {
    vscode.window.showErrorMessage(`Push failed: ${error.message}`);
  }
};
