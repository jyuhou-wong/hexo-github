import { TreeItemCollapsibleState, Uri } from "vscode";
import * as vscode from "vscode";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "fs";
import { readdir, readFile } from "fs/promises";
import { basename, extname, join } from "path";
import { promisify } from "util";
import { exec } from "child_process";
import minimist from "minimist";
import {
  BlogsTreeDataProvider,
  TreeItem,
} from "./providers/blogsTreeDataProvider";
import axios from "axios";
import * as net from "net";
import { SimpleGit } from "simple-git";
import { DEFAULT_EMAIL, DEFAULT_USERNAME } from "./services/config";
import { load, dump } from "js-yaml";
import { logMessage } from "./extension";

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
    errorMessage = `${message}: ${error.message}`;
  } else {
    errorMessage = `${message}: An unknown error occurred`;
  }

  logMessage(errorMessage, false, "error");

  logMessage(errorMessage, true, "error");
};

// Promisify exec for easier async/await usage
export const execAsync = promisify(exec);

// Uninstall NPM modules
export const uninstallNpmModule = async (dirPath: string, name: string) => {
  try {
    await execAsync(`npm uninstall ${name}`, { cwd: dirPath });
    logMessage(`"${name}" uninstalled successfully.`, true);
  } catch (error) {
    handleError(error, `Error uninstalling "${name}"`);
  }
};

export const isModuleExisted = (
  workspaceRoot: string,
  moduleName: string,
  modulesDirname: string = "node_modules"
) => {
  const moduleDir = join(workspaceRoot, modulesDirname, moduleName);
  return existsSync(moduleDir);
};

// Install NPM modules
export const installNpmModule = async (dirPath: string, name: string) => {
  try {
    logMessage(`Installing "${name}" module.`, true);
    await execAsync(`npm install ${name}`, { cwd: dirPath });
    logMessage(`"${name}" installed successfully.`, true);
    return true;
  } catch (error) {
    handleError(error, `Error installing "${name}"`);
    return false;
  }
};

// Install NPM modules
export const installNpmModules = async (dirPath: string) => {
  try {
    logMessage("Installing NPM modules...", true);
    await execAsync("npm install", { cwd: dirPath });
    logMessage("NPM modules installed successfully.", true);
    return true;
  } catch (error) {
    handleError(error, "Error installing NPM modules");
    return false;
  }
};

/**
 * Installs missing dependencies from the specified directory's package.json.
 * @param dirPath - The directory path containing the package.json file.
 */
export const installMissingDependencies = async (dirPath: string) => {
  const packageJsonPath = join(dirPath, "package.json");

  // Check if package.json exists
  if (!existsSync(packageJsonPath)) {
    vscode.window.showWarningMessage(
      "package.json not found in the specified directory."
    );
    return;
  }

  // Read and parse package.json
  const packageJson = JSON.parse(await readFile(packageJsonPath, "utf-8"));

  const { dependencies = {}, devDependencies = {} } = packageJson;

  // Combine dependencies and devDependencies into a single array
  const allDependencies = { ...dependencies, ...devDependencies };

  // Check each dependency and install if missing
  for (const packageName of Object.keys(allDependencies)) {
    const installed = isModuleExisted(dirPath, packageName);
    if (installed) {
      continue;
    }
    await installNpmModule(dirPath, packageName); // Install the missing package
  }
};

/**
 * Installs specified modules in the given directory if they are not already installed.
 * @param dirPath - The directory path where the modules will be installed.
 * @param modules - An array of module names to install.
 */
export const installModules = async (dirPath: string, modules: string[]) => {
  // Ensure the directory exists
  if (!existsSync(dirPath)) {
    logMessage(`Directory "${dirPath}" does not exist.`, true, "error");
    return;
  }

  // Check each module and install if missing
  for (const moduleName of modules) {
    const installed = await isModuleExisted(dirPath, moduleName);
    if (installed) {
      continue;
    }
    await installNpmModule(dirPath, moduleName); // Install the missing module
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
 * Checks if a file name is valid.
 * @param fileName - The file name to check.
 * @returns Returns true if the file name is valid, otherwise false.
 */
export const isValidFileName = (fileName: string | undefined): boolean => {
  // Regular expression to match invalid characters
  const invalidChars: RegExp = /[<>:"'|?*\\/]/;

  // Check if the file name is empty or contains invalid characters
  if (!fileName || invalidChars.test(fileName)) {
    return false;
  }

  // Further validity checks (can be extended as needed)
  if (fileName.length === 0 || fileName.length > 255) {
    return false; // Assuming the file name cannot be empty or exceed 255 characters
  }

  return true; // File name is valid
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
  if (!existsSync(src)) {
    throw new Error(`Source directory "${src}" does not exist.`);
  }

  // Create the destination directory if it doesn't exist
  if (!existsSync(dest)) {
    mkdirSync(dest, { recursive: true });
  }

  // Read the contents of the source directory
  const items = readdirSync(src);

  items.forEach((item) => {
    const srcItem = join(src, item);
    const destItem = join(dest, item);

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
    if (statSync(srcItem).isDirectory()) {
      copyFiles(srcItem, destItem);
    } else {
      // Copy the file
      copyFileSync(srcItem, destItem);
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

export const deleteItem = async (
  args: any,
  context: vscode.ExtensionContext
) => {
  let path = args.resourceUri.fsPath;
  let { label, contextValue } = args;

  let prompt: string = "";

  switch (contextValue) {
    case "site":
      prompt = `Are you sure you want to delete site "${label}"`;
      break;

    case "theme":
      prompt = `Are you sure you want to delete theme "${label}" and its config`;
      break;

    case "page":
      path = path.replace(/[\\/]+index.md$/i, "");
      prompt = `Are you sure you want to delete page "${label}"`;
      break;

    case "draft":
      prompt = `Are you sure you want to delete draft "${label}"`;
      break;

    case "post":
      prompt = `Are you sure you want to delete post "${label}"`;
      break;

    case "folder":
      prompt = `Are you sure you want to delete the directory "${label}" and all its files?`;
      break;

    default:
      prompt = `Are you sure you want to delete "${label}"`;
      break;
  }

  // Ask for user confirmation
  const confirmation = await vscode.window.showWarningMessage(
    prompt,
    { modal: true },
    "Delete"
  );

  if (confirmation === "Delete") {
    try {
      // Delete the item (file or directory)
      rmSync(path, { recursive: true, force: true });
      logMessage(`Deleted "${path}" successfully.`, true);
    } catch (error) {
      handleError(error, "Error deleting item");
    }
  }
};

/**
 * Creates a new directory.
 * @param path - The path of the directory to create.
 */
export const createDirectory = (path: string) => {
  mkdirSync(path, { recursive: true });
  logMessage(`Subdirectory ${basename(path)} created.`, true);
};

/**
 * Opens an existing file.
 * @param path - The path of the file to open.
 */
export const openFile = async (path: string) => {
  const document = await vscode.workspace.openTextDocument(path);
  await vscode.window.showTextDocument(document);
  logMessage(`File ${basename(path)} opened for editing.`, true);
};

/**
 * Prompts the user for a name.
 * @param placeholder - The placeholder text for the input box.
 * @returns Returns the name if valid, otherwise undefined.
 */
export const promptForName = async (
  placeHolder: string,
  args: object = {}
): Promise<string | undefined> => {
  const name = await vscode.window.showInputBox({ placeHolder, ...args });
  if (!name) {
    return name;
  }
  if (!isValidFileName(name)) {
    logMessage("Invalid name. Please try again.", true, "error");
    return undefined; // Return undefined to indicate an invalid name
  }
  return name;
};

/**
 * Executes a user command after prompting for input.
 * @param placeholder - The placeholder text for the input box.
 * @param action - A function that takes the command string and returns a Promise.
 */
export const executeUserCommand = async (
  placeholder: string,
  action: (cmd: string) => Promise<void>
) => {
  // Show an input box to prompt the user for a command
  const userInput = await vscode.window.showInputBox({
    placeHolder: placeholder,
  });

  if (userInput) {
    // Remove the "hexo" prefix from the input command and trim whitespace
    const cmd = userInput.replace(/^\s*hexo\s*/i, "").trim();
    try {
      // Execute the action with the cleaned command
      await action(cmd);
    } catch (error) {
      // Handle any errors that occur during command execution
      handleError(error, "Failed to execute command");
    }
  } else {
    // Warn the user if no command was entered
    logMessage("No command entered!", true, "error");
  }
};

/**
 * Executes an asynchronous action with feedback messages.
 * @param action - A function that returns a Promise representing the action to execute.
 * @param successMessage - The message to display upon successful execution.
 * @param errorMessage - The message to display if an error occurs.
 */
export const executeWithFeedback = async (
  action: () => Promise<void>,
  successMessage: string,
  errorMessage: string
) => {
  try {
    await action(); // Execute the provided action
    logMessage(successMessage, true); // Show success message
  } catch (error) {
    handleError(error, errorMessage); // Handle errors and show error message
  }
};

/**
 * Searches for npm packages matching the given text and filters them with a regex if provided.
 * @param text - The text to search for in package names.
 * @param regex - An optional regex to further filter the results.
 * @returns A promise that resolves to an array of matching package names.
 */
export const searchNpmPackages = async (
  text: string,
  regex?: RegExp
): Promise<string[]> => {
  try {
    let allPackages: any[] = [];
    let from = 0;
    const size = 250;

    // Fetch packages until all are retrieved
    while (true) {
      const response = await axios.get(
        "https://registry.npmjs.org/-/v1/search",
        {
          params: {
            text, // Pass the text parameter to the API
            size,
            from,
            popularity: 1.0,
          },
        }
      );

      const packages = response.data.objects;
      allPackages = allPackages.concat(packages); // Combine the current batch with all previously fetched packages

      // If the number of packages fetched is less than the size, we've reached the end
      if (packages.length < size) {
        break;
      }

      // Increment 'from' to fetch the next batch
      from += size;
    }

    // Filter packages based on the regex if provided
    let matchedPackages = allPackages;
    if (regex) {
      matchedPackages = matchedPackages.filter((pkg) =>
        regex.test(pkg.package.name)
      );
    }

    return matchedPackages.map((pkg) => pkg.package.name); // Return only the package names
  } catch (error) {
    logMessage(`Error fetching npm packages: ${error}`, false, "error");
    throw error; // Re-throw error for handling in the calling function
  }
};

/**
 * Retrieves all themes from the specified themes directory.
 * @param workspaceRoot - The root path of the workspace.
 * @param themeDir - The name of the themes directory (default is "themes").
 * @returns A promise that resolves to an array of TreeItem representing the themes.
 */
export const getThemesInThemesDir = async (
  userName: string,
  siteName: string,
  workspaceRoot: string,
  parent: TreeItem,
  themeDir: string = "themes"
): Promise<TreeItem[]> => {
  const themesDir = join(workspaceRoot, themeDir);

  // Return an empty array if the themes directory does not exist
  if (!existsSync(themesDir)) {
    return [];
  }

  // Read the themes directory and filter for subdirectories
  const themes = (await readdir(themesDir, { withFileTypes: true }))
    .filter(({ name }) => statSync(join(themesDir, name)).isDirectory())
    .map(({ name }) => {
      const uri = getThemeConfig(
        workspaceRoot,
        Uri.file(join(themesDir, name)),
        name
      );
      const item = new TreeItem(
        userName,
        siteName,
        name,
        TreeItemCollapsibleState.None,
        parent,
        uri
      );
      item.resourceUri = uri;
      item.command = {
        command: "vscode.open",
        title: "Open File",
        arguments: [uri], // Arguments for the command
      };
      item.contextValue = "theme";
      return item;
    });

  return themes; // Return the array of TreeItem representing themes
};

/**
 * Reads all themes listed in the package.json file.
 * @param workspaceRoot - The root path of the workspace.
 * @param regex - A regular expression to filter theme names (default matches "hexo-theme-*").
 * @returns An array of TreeItem representing the themes found in package.json.
 */
export const getThemesInPackageJson = (
  userName: string,
  siteName: string,
  workspaceRoot: string,
  parent: TreeItem,
  regex: RegExp = /^hexo-theme-[^-]+$/i
): TreeItem[] => {
  const packageJsonPath = join(workspaceRoot, "package.json");

  // Return an empty array if the package.json file does not exist
  if (!existsSync(packageJsonPath)) {
    return [];
  }

  // Read and parse the package.json file
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));

  // Convert a module name to a TreeItem
  const toDep = (moduleName: string): TreeItem => {
    const themeDir = join(workspaceRoot, "node_modules", moduleName);
    const themeName = moduleName.replace(/^hexo-theme-/, "");
    const uri = getThemeConfig(workspaceRoot, Uri.file(themeDir), themeName);
    const item = new TreeItem(
      userName,
      siteName,
      themeName,
      vscode.TreeItemCollapsibleState.None,
      parent,
      uri
    );
    item.resourceUri = uri;
    item.command = {
      command: "vscode.open",
      title: "Open File",
      arguments: [uri], // Arguments for the command
    };
    item.contextValue = "theme";
    return item;
  };

  // Filter dependencies and devDependencies based on the regex and existence
  const themes = Object.keys(packageJson.dependencies).filter(
    (v: string) => regex.test(v) && isModuleExisted(workspaceRoot, v)
  );
  const devThemes = Object.keys(packageJson.devDependencies ?? {}).filter(
    (v: string) => regex.test(v) && isModuleExisted(workspaceRoot, v)
  );

  return [...new Set([...themes, ...devThemes])].map(toDep); // Return unique themes as TreeItems
};

export const getThemeConfig = (
  workspaceRoot: string,
  uri: Uri,
  name: string
): Uri => {
  const configPath = join(uri.fsPath, "_config.yml");
  const destPath = join(workspaceRoot, `_config.${name}.yml`);

  if (existsSync(destPath)) {
    return Uri.file(destPath);
  }

  if (!existsSync(configPath)) {
    writeFileSync(destPath, "", "utf8");
    return Uri.file(destPath);
  }

  copyFileSync(configPath, destPath);

  return Uri.file(destPath);
};

/**
 * Generates a random available port.
 * @returns A promise that resolves to a random available port number.
 */
export const getRandomAvailablePort = async (): Promise<number> => {
  return new Promise((resolve, reject) => {
    const server = net.createServer();

    // Attempt to listen on a random port
    server.listen(0, () => {
      const port = (server.address() as net.AddressInfo).port;
      server.close(() => resolve(port)); // Resolve with the available port
    });

    // Handle errors (e.g., if the port is occupied)
    server.on("error", () => {
      server.close();
      reject(new Error("Could not find an available port."));
    });
  });
};

/**
 * Refreshes the BlogsTreeDataProvider if it exists.
 * @param context - The extension context.
 */
export const refreshBlogsProvider = (context: vscode.ExtensionContext) => {
  const blogsProvider: BlogsTreeDataProvider | undefined =
    context.subscriptions.find(
      (subscription) => subscription instanceof BlogsTreeDataProvider
    );

  if (blogsProvider) {
    blogsProvider.refresh(); // Call refresh if the provider exists
  } else {
    logMessage("BlogsTreeDataProvider not found.", true, "error");
  }
};

/**
 * Initializes the source directory by creating default folders for the provided items.
 * @param sourceDir - The source directory where the folders will be created.
 * @param items - An array of item names for which folders will be created.
 */
export const initSourceItem = (sourceDir: string, items: string[]) => {
  // Ensure the source directory exists
  if (!existsSync(sourceDir)) {
    vscode.window.showErrorMessage(
      `Source directory "${sourceDir}" does not exist.`
    );
    return;
  }

  // Create folders for each item if they do not already exist
  for (const item of items) {
    const itemDir = join(sourceDir, item);
    if (!existsSync(itemDir)) {
      mkdirSync(itemDir);
      logMessage(`Created folder: "${item}"`, true);
    }
  }
};

/**
 * Recursively replaces the last occurrence of specific patterns in HTML anchor tags in files of a specified type within a given directory.
 * @param dirPath - The directory path to search in.
 * @param fileType - The file extension to filter files (e.g., '.html').
 * @param regex - The regular expression used to find matches.
 * @param replacement - The replacement string, which can use $1, $2, etc. for matched groups.
 */
export const replaceLastInHtmlLinks = (
  dirPath: string,
  fileType: string,
  regex: RegExp,
  replacement: string
) => {
  // Check if the directory exists
  if (!existsSync(dirPath)) {
    logMessage(`Directory "${dirPath}" does not exist.`);
    return;
  }

  // Read all items in the directory
  const items = readdirSync(dirPath);

  // Loop through each item
  for (const item of items) {
    const itemPath = join(dirPath, item);
    const stat = statSync(itemPath);

    if (stat.isDirectory()) {
      // If the item is a directory, recurse into it
      replaceLastInHtmlLinks(itemPath, fileType, regex, replacement);
    } else if (extname(item) === fileType) {
      // If the item is a file of the specified type, read and replace content
      const content = readFileSync(itemPath, "utf-8");

      // Find the last match of the regex
      const matches = [...content.matchAll(regex)];
      if (matches.length > 0) {
        const lastMatch = matches[matches.length - 1];
        const lastMatchIndex = lastMatch.index!;

        // Replace only the last occurrence
        const newContent =
          content.slice(0, lastMatchIndex) +
          content.slice(lastMatchIndex).replace(regex, replacement);

        // Only write back if there are changes
        if (content !== newContent) {
          writeFileSync(itemPath, newContent, "utf-8");
          logMessage(`Updated: ${itemPath}`);
        }
      }
    }
  }
};

/**
 * Sets the username and email for the current Git repository.
 * @param git - The simpleGit instance.
 * @param username - The username to set. Defaults to DEFAULT_USERNAME.
 * @param email - The email to set. Defaults to DEFAULT_EMAIL.
 */
export const setGitUser = async (
  git: SimpleGit,
  username: string = DEFAULT_USERNAME,
  email: string = DEFAULT_EMAIL
) => {
  try {
    await git.addConfig("user.name", username);
    await git.addConfig("user.email", email);
    logMessage(`Git user set: ${username} <${email}>`);
  } catch (error) {
    logMessage(
      `Error setting Git user: ${(error as Error).message}`,
      false,
      "error"
    );
  }
};

/**
 * Clears the specified directory, excluding certain files and folders.
 * @param dir - The path of the directory to clear.
 * @param exclude - An array of files and folders to exclude from deletion.
 */
export const clearDirectory = (dir: string, exclude: string[] = []) => {
  // Check if the directory exists
  if (!existsSync(dir)) {
    logMessage(`Directory does not exist: ${dir}`, false, "error");
    return;
  }

  // Read all files and folders in the directory
  const items = readdirSync(dir);

  items.forEach((item) => {
    const itemPath = join(dir, item);

    // Check if the current item is in the exclude list
    if (!exclude.includes(item)) {
      // Remove file or folder
      rmSync(itemPath, { recursive: true, force: true });
      logMessage(`Deleted: ${itemPath}`);
    } else {
      logMessage(`Skipped: ${itemPath}`);
    }
  });
};

/**
 * Modifies a specific field in a YAML file.
 * @param filePath - The path to the YAML file.
 * @param fieldPath - The dot-separated path to the field to modify (e.g., 'parent.child').
 * @param newValue - The new value to set for the field.
 * @throws Will throw an error if the file cannot be read or written.
 */
export const modifyYamlField = (
  filePath: string,
  fieldPath: string,
  newValue: any
) => {
  try {
    const fileContents = readFileSync(filePath, "utf8");
    const data = load(fileContents) as Record<string, any>;

    const fields = fieldPath.split(".");
    let current = data;

    for (let i = 0; i < fields.length - 1; i++) {
      if (!(fields[i] in current)) {
        throw new Error(`Field path does not exist: ${fieldPath}`);
      }
      current = current[fields[i]];
    }

    current[fields[fields.length - 1]] = newValue;

    const updatedYaml = dump(data);
    writeFileSync(filePath, updatedYaml, "utf8");
    logMessage(`Successfully updated ${fieldPath} to ${newValue}`);
  } catch (error) {
    handleError(error, "Error modifying YAML file");
  }
};
