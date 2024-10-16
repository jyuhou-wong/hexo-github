import { homedir } from "os";
import { join } from "path";

// GitHub OAuth Configuration
export const GITHUB_CLIENT_ID = "Ov23liWFfmPY4dF89N4o";
export const GITHUB_CLIENT_SECRET = "14209332d10ea46c0d1900cad18fa12b6fb802a8";
export const REDIRECT_URI = "http://localhost:3000/auth/callback";

// Directories and File Paths
export const HOME_DIRECTORY = homedir();
export const CONFIG_DIR = join(HOME_DIRECTORY, ".hexo-github");
export const CONFIG_FILE_PATH = join(CONFIG_DIR, "config.json");
export const LOCAL_HEXO_DIR = join(HOME_DIRECTORY, ".hexo-github");
export const LOCAL_HEXO_STARTER_DIR = join(LOCAL_HEXO_DIR, "hexo-starter");
export const ZIP_FILE_PATH = join(LOCAL_HEXO_DIR, "hexo-starter.zip");
export const STARTER_REPO_ZIP_URL = "https://github.com/hexojs/hexo-starter/archive/refs/heads/master.zip";

// Directories Name
export const SOURCE_POSTS_DIRNAME = "_posts"
export const SOURCE_DRAFTS_DIRNAME = "_drafts"