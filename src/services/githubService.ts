import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { homedir } from "os";
import { Octokit } from "@octokit/rest";
import express from "express";
import open from "open";
import { createServer } from "http";
import axios from "axios";

const clientId = "Ov23liWFfmPY4dF89N4o";
const clientSecret = "14209332d10ea46c0d1900cad18fa12b6fb802a8";
const redirectUri = "http://localhost:3000/auth/callback";
const configDir = path.join(homedir(), ".hexo-github");
const configFilePath = path.join(configDir, "config.json");

// Ensure configuration directory exists
if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true });

export const loadAccessToken = () => {
  let accessToken: string | null = null;
  if (fs.existsSync(configFilePath)) {
    accessToken =
      JSON.parse(fs.readFileSync(configFilePath, "utf8")).accessToken || null;
  }
  return accessToken;
};

const saveAccessToken = (accessToken: string) => {
  fs.writeFileSync(configFilePath, JSON.stringify({ accessToken }), "utf8");
};

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