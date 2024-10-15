import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { promisify } from "util";
import { exec } from "child_process";
import minimist from "minimist";

/**
 * Checks if the node_modules directory exists in the given path.
 * @param dirPath - The path to check.
 * @returns A promise that resolves to true if node_modules exists, false otherwise.
 */
export const checkNodeModulesExist = async (
  dirPath: string
): Promise<boolean> => {
  return new Promise((resolve) => {
    // Ensure the provided path is a directory
    fs.stat(dirPath, (err, stats) => {
      if (err || !stats.isDirectory()) {
        resolve(false);
        return;
      }

      // Check for the existence of the node_modules directory
      const nodeModulesPath = path.join(dirPath, "node_modules");
      fs.access(nodeModulesPath, fs.constants.F_OK, (err) => {
        resolve(!err); // If no error, node_modules exists
      });
    });
  });
};

/**
 * Checks if two paths are equal.
 * @param path1 - The first path.
 * @param path2 - The second path.
 * @returns Whether they are equal.
 */
export const arePathsEqual = (path1: string, path2: string): boolean => {
  // Normalize paths and replace separators
  const normalizedPath1 = path.normalize(
    path1.replace(/\\/g, "/").replace(/^[a-zA-Z]:\/|^\//, "")
  );
  const normalizedPath2 = path.normalize(
    path2.replace(/\\/g, "/").replace(/^[a-zA-Z]:\/|^\//, "")
  );

  // Compare the normalized paths
  return normalizedPath1 === normalizedPath2; // Case sensitive
};

/**
 * Handles errors by displaying an error message in the VS Code window.
 * @param error - The error object containing the error details, which can be of type Error or unknown.
 * @param message - A custom message to display along with the error. Defaults to "An error occurred".
 */
export const handleError = (
  error: unknown,
  message: string = "An error occurred"
) => {
  let errorMessage: string;

  if (error instanceof Error) {
    errorMessage = error.message;
  } else {
    errorMessage = `${message}: An unknown error occurred`;
  }

  vscode.window.showErrorMessage(errorMessage);
};

// Promisify exec for easier async/await usage
export const execAsync = promisify(exec);

// Install NPM modules
export const installNpmModules = async (dirPath: string) => {
  try {
    await execAsync("npm install", { cwd: dirPath });
    console.log("NPM modules installed successfully.");
  } catch (error) {
    handleError(error, "Error installing NPM modules");
  }
};

/**
 * Checks if a path is valid
 * @param path - The path to check
 * @returns Returns true if the path is valid, otherwise false
 */
export const isValidPath = (path: string | undefined): boolean => {
  // Regular expression to match invalid characters
  const invalidChars: RegExp = /[<>:"'|?*]/;

  // Check if the path is empty or contains invalid characters
  if (!path || invalidChars.test(path)) {
    return false;
  }

  // Further validity checks (can be extended as needed)
  if (path.length > 255) {
    return false; // Assuming the path length cannot exceed 255 characters
  }

  return true; // Path is valid
};

/**
 * Formats the address to create a full URL.
 *
 * @param {string} ip - The IP address of the server.
 * @param {number} port - The port number of the server.
 * @returns {string} - The formatted URL as a string.
 */
export const formatAddress = (ip: string, port: number) => {
  // Use 'localhost' for '0.0.0.0' or '::'
  const hostname = ip === "0.0.0.0" || ip === "::" ? "localhost" : ip;

  // Construct and return the full URL
  return new URL(`http://${hostname}:${port}`).toString();
};

/**
 * Parses command line arguments from a command string.
 *
 * @param {string} cmd - The command string containing arguments.
 * @returns {object} - An object containing the parsed arguments.
 */
export const getArgs = (cmd: string) => {
  // Match arguments including quoted strings
  const argv = cmd
    .match(/(?:[^\s"]+|"[^"]*")+/g)!!
    .map((arg) => arg.replace(/"/g, ""));

  // Parse the arguments using minimist
  const args = minimist(argv, { string: ["_", "p", "path", "s", "slug"] });

  return args;
};
