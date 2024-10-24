import { homedir } from "os";
import { join } from "path";

// GitHub OAuth Configuration
export const GITHUB_CLIENT_ID = "Ov23liWFfmPY4dF89N4o";
export const GITHUB_CLIENT_SECRET = "14209332d10ea46c0d1900cad18fa12b6fb802a8";
export const REDIRECT_URI = "http://localhost:3000/auth/callback";

// HEXO Config Name
export const HEXO_CONFIG_NAME = "_config.yml";


// HEXO Directories Name
export const POSTS_DIRNAME = "_posts";
export const DRAFTS_DIRNAME = "_drafts";

export const STARTER_THEMES_DIRNAME = "themes";

// Extension Directories Name
export const HEXO_STARTER_DIRNAME = "hexo-starter";
export const EXT_CONFIG_NAME = "config.json";
export const EXT_HOME_DIRNAME = ".hexo-github";

// Directories and File Paths
export const HOME_DIRECTORY = homedir();
export const EXT_HOME_DIR = join(HOME_DIRECTORY, EXT_HOME_DIRNAME);

export const EXT_CONFIG_PATH = join(EXT_HOME_DIR, EXT_CONFIG_NAME);
export const EXT_HEXO_STARTER_DIR = join(EXT_HOME_DIR, HEXO_STARTER_DIRNAME);
export const ZIP_FILE_PATH = join(EXT_HOME_DIR, `${HEXO_STARTER_DIRNAME}.zip`);
export const STARTER_REPO_ZIP_URL =
"https://github.com/hexojs/hexo-starter/archive/refs/heads/master.zip";

export const HEXO_CONFIG_PATH = join(EXT_HEXO_STARTER_DIR, HEXO_CONFIG_NAME);
