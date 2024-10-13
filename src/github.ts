import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { homedir } from "os";
import { Octokit } from "@octokit/rest";
import express from "express";
import open from "open";
import { createServer } from "http";
import axios from "axios"; // Import axios

const clientId = "Ov23liWFfmPY4dF89N4o"; // GitHub application client ID
const clientSecret = "14209332d10ea46c0d1900cad18fa12b6fb802a8"; // GitHub application client secret
const redirectUri = "http://localhost:3000/auth/callback";
const configDir = path.join(homedir(), ".hexo-github"); // Configuration directory
const configFilePath = path.join(configDir, "config.json"); // Configuration file path

// Ensure configuration directory exists
if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true });

// Load access token from configuration file
export const loadAccessToken = () => {
  let accessToken: string | null = null; // Store access token
  if (fs.existsSync(configFilePath)) {
    accessToken = JSON.parse(fs.readFileSync(configFilePath, "utf8")).accessToken || null;
  }
  return accessToken
};

// Save access token to configuration file
const saveAccessToken = (accessToken: string) => {
  fs.writeFileSync(configFilePath, JSON.stringify({ accessToken }), "utf8");
};

// Start OAuth login process
export const startOAuthLogin = async () => {
  const app = express();
  const server = createServer(app);

  app.get("/auth/callback", async (req, res) => {
    const { code } = req.query;

    try {
      const { data } = await axios.post(
        `https://github.com/login/oauth/access_token`,
        { client_id: clientId, client_secret: clientSecret, code },
        { headers: { Accept: "application/json" } }
      );

      saveAccessToken(data.access_token); // Save access token

      const octokit = new Octokit({ auth: loadAccessToken() });
      const { data: user } = await octokit.rest.users.getAuthenticated();
      vscode.window.showInformationMessage(`Logged in as ${user.login}`);

      res.send("Login successful! You can close this window.");
    } catch (error: any) {
      vscode.window.showErrorMessage(`Error during authentication: ${error.message}`);
      res.send("Login failed! Please check the console for details.");
    } finally {
      server.close(); // Close server
    }
  });

  server.listen(3000, async () => {
    const authUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=repo%20user`;
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