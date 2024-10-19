import { Uri } from "vscode";
import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { promisify } from "util";
import { exec } from "child_process";
import minimist from "minimist";
import { BlogsTreeDataProvider } from "./providers/blogsTreeDataProvider";

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
  return Uri.file(path1).fsPath === Uri.file(path2).fsPath;
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
    vscode.window.showInformationMessage("NPM modules installed successfully.");
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

/**
 * Type for the exclusion patterns.
 */
export type ExcludePattern = string | RegExp;

/**
 * Recursively copies files from the source directory to the target directory.
 *
 * @param {string} src - The source directory path.
 * @param {string} dest - The destination directory path.
 * @param {ExcludePattern[]} exclude - An array of patterns to exclude (string or RegExp).
 */
export const copyFiles = (
  src: string,
  dest: string,
  exclude: ExcludePattern[] = []
) => {
  // Ensure the source path exists
  if (!fs.existsSync(src)) {
    throw new Error(`Source directory "${src}" does not exist.`);
  }

  // Create the destination directory if it doesn't exist
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  // Read the contents of the source directory
  const items = fs.readdirSync(src);

  items.forEach((item) => {
    const srcItem = path.join(src, item);
    const destItem = path.join(dest, item);

    // Check if the item matches any of the exclude patterns
    const isExcluded = exclude.some((pattern) => {
      if (typeof pattern === "string") {
        return item === pattern || item.startsWith(pattern.replace(/\*/g, "")); // Simple wildcard support
      } else if (pattern instanceof RegExp) {
        return pattern.test(item);
      }
      return false;
    });

    if (isExcluded) {
      return; // Skip excluded items
    }

    // Check if the item is a directory
    if (fs.statSync(srcItem).isDirectory()) {
      copyFiles(srcItem, destItem);
    } else {
      // Copy the file
      fs.copyFileSync(srcItem, destItem);
    }
  });
};

/**
 * Reveals an item in the Blogs TreeView based on the provided URI.
 *
 * @param {vscode.Uri} uri - The URI of the item to reveal.
 * @param {vscode.ExtensionContext} context - The extension context.
 */
export const revealItem = async (
  uri: vscode.Uri,
  context: vscode.ExtensionContext
) => {
  const prevUri = context.globalState.get<vscode.Uri>("prevUri");

  if (uri.fsPath === prevUri?.fsPath) {
    return;
  }

  context.globalState.update("prevUri", uri);

  const blogsTreeView: vscode.TreeView<vscode.TreeItem> =
    context.subscriptions.find(
      (subscription) =>
        typeof subscription === "object" &&
        (subscription as any).title === "Blogs"
    ) as vscode.TreeView<vscode.TreeItem>;

  const blogsProvider: BlogsTreeDataProvider | undefined =
    context.subscriptions.find(
      (subscription) => subscription instanceof BlogsTreeDataProvider
    );

  if (blogsProvider && blogsTreeView) {
    const item = await blogsProvider.findNodeByUri(uri);
    if (item) {
      blogsTreeView.reveal(item, {
        expand: true,
        focus: true,
      });
    }
  }
};

/**
 * Deletes an item (file or directory) after user confirmation.
 *
 * @param {vscode.Uri} uri - The URI of the item to delete.
 */
export const deleteItem = async (uri: vscode.Uri) => {
  // Ask for user confirmation
  const confirmation = await vscode.window.showWarningMessage(
    `Are you sure you want to delete "${uri.fsPath}"?`,
    { modal: true },
    "Delete",
    "Cancel"
  );

  if (confirmation === "Delete") {
    try {
      // Delete the item (file or directory)
      fs.rmSync(uri.fsPath, { recursive: true, force: true });
      vscode.window.showInformationMessage(`Deleted "${uri.fsPath}" successfully.`);
    } catch (error) {
      handleError(error, "Error deleting item")
    }
  }
};