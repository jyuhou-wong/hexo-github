# Hexo-GitHub VSCode Plugin

## 中文版

Hexo-GitHub 是一个 VSCode 插件，旨在简化 Hexo 博客的管理与 GitHub 集成。用户可以通过该插件轻松地创建、更新和部署他们的 Hexo 博客。

### 功能

- **登录到 GitHub**: 使用 OAuth 流程安全地登录到 GitHub。
- **创建私有库**: 在 GitHub 上创建新的私有库以存储 Hexo 博客。
- **克隆私有库**: 从 GitHub 克隆现有的 Hexo 博客库。
- **拉取和推送**: 从 GitHub 拉取最新的博客内容，或将本地更改推送到 GitHub。
- **创建新博客**: 通过简单的命令创建新的 Hexo 博客文章。
- **启动和停止 Hexo 服务器**: 在本地启动 Hexo 服务器以预览博客，或停止服务器。
- **本地预览**: 在浏览器中打开本地博客的预览。
- **部署到 GitHub Pages**: 将博客部署到 GitHub Pages，使其在线可访问。

### 安装

1. **下载 VSIX 文件**: 前往 [发布页面](https://github.com/jyuhou-wong/hexo-github/releases) 下载最新的 VSIX 文件。
2. **安装插件**:
   - 在 VSCode 中，打开扩展视图（`Ctrl+Shift+X`）。
   - 点击右上角的三个点，选择 **Install from VSIX...**，然后选择下载的 VSIX 文件。

### 使用指南

该插件提供了两种主要的操作方式：通过命令面板和上下文菜单。

#### 通过命令面板

1. **登录到 GitHub**:
   - 打开命令面板 (`Ctrl+Shift+P`)，输入 `Login to GitHub`，然后按照提示进行 OAuth 登录。

2. **创建新私有库**:
   - 输入 `Create Private Repository`，提供库名并完成创建。

3. **克隆私有库**:
   - 输入 `Clone Hexo Repository`，提供要克隆的库的 URL。

4. **拉取和推送**:
   - 使用 `Pull Hexo Repository` 从 GitHub 拉取最新内容。
   - 使用 `Push Hexo Repository` 将本地更改推送到 GitHub。

5. **创建新博客文章**:
   - 输入 `New Blog`，提供文章路径。

6. **启动和停止 Hexo 服务器**:
   - 使用 `Start Server` 启动 Hexo 服务器。
   - 使用 `Stop Server` 停止服务器。

7. **本地预览**:
   - 输入 `Local Preview`，在浏览器中查看博客的本地预览。

8. **部署到 GitHub Pages**:
   - 使用 `Deploy Blog` 将博客内容部署到 GitHub Pages。

#### 通过上下文菜单

在编辑器中右键单击，可以直接访问以下命令：

- **Login to GitHub**
- **Pull Hexo Repository**
- **Push Hexo Repository**
- **Start Server**
- **Stop Server**
- **New Blog**
- **Local Preview**
- **Deploy Blog**

### 工作原理

1. **OAuth 登录**: 使用 GitHub 的 OAuth 授权流程，安全地获取访问令牌。
2. **GitHub API**: 通过 Octokit 库与 GitHub API 交互，执行拉取、推送、创建库等操作。
3. **Hexo CLI**: 使用 Hexo CLI 命令来管理博客文章和服务器。
4. **本地存储**: 将访问令牌和配置存储在本地，确保用户体验流畅。

### 依赖

该插件依赖以下 npm 包：

- `express`: 用于创建本地服务器以处理 OAuth 回调。
- `node-fetch`: 用于进行 HTTP 请求。
- `simple-git`: 用于执行 Git 命令。
- `@octokit/rest`: GitHub 的 REST API 客户端。
- `open`: 用于在默认浏览器中打开 URL。

### 注意事项

- 确保在 GitHub 上创建 OAuth 应用，并获取 `Client ID` 和 `Client Secret`，并在代码中配置。
- 请妥善保管访问令牌，避免泄露。

### 贡献

欢迎任何形式的贡献！请提交问题或拉取请求。

### 感谢

特别感谢 [Hexo](https://hexo.io/) 团队的支持和贡献，使得博客管理变得如此简单。

### 许可证

此项目使用 MIT 许可证。请参阅 [LICENSE](LICENSE) 文件以获取更多信息。

---

## English Version

Hexo-GitHub is a VSCode plugin designed to simplify the management of Hexo blogs with GitHub integration. Users can easily create, update, and deploy their Hexo blogs through this plugin.

### Features

- **Login to GitHub**: Securely log in to GitHub using OAuth.
- **Create Private Repository**: Create new private repositories on GitHub to store Hexo blogs.
- **Clone Private Repository**: Clone existing Hexo blog repositories from GitHub.
- **Pull and Push**: Pull the latest blog content from GitHub or push local changes to GitHub.
- **Create New Blog**: Create new Hexo blog posts through simple commands.
- **Start and Stop Hexo Server**: Start a local Hexo server to preview blogs or stop the server.
- **Local Preview**: Open a local preview of the blog in the browser.
- **Deploy to GitHub Pages**: Deploy the blog to GitHub Pages for online access.

### Installation

1. **Download the VSIX file**: Go to the [releases page](https://github.com/jyuhou-wong/hexo-github/releases) and download the latest VSIX file.
2. **Install the plugin**:
   - In VSCode, open the Extensions view (`Ctrl+Shift+X`).
   - Click on the three dots in the upper right corner and select **Install from VSIX...**, then choose the downloaded VSIX file.

### Usage Guide

The plugin provides two main operation methods: via the command palette and the context menu.

#### Using the Command Palette

1. **Login to GitHub**:
   - Open the command palette (`Ctrl+Shift+P`), type `Login to GitHub`, and follow the prompts to log in via OAuth.

2. **Create a New Private Repository**:
   - Type `Create Private Repository`, provide the repository name, and complete the creation.

3. **Clone a Private Repository**:
   - Type `Clone Hexo Repository`, providing the URL of the repository to clone.

4. **Pull and Push**:
   - Use `Pull Hexo Repository` to pull the latest content from GitHub.
   - Use `Push Hexo Repository` to push local changes to GitHub.

5. **Create a New Blog Post**:
   - Type `New Blog`, providing the path for the post.

6. **Start and Stop Hexo Server**:
   - Use `Start Server` to start the Hexo server.
   - Use `Stop Server` to stop the server.

7. **Local Preview**:
   - Type `Local Preview` to view a local preview of the blog in the browser.

8. **Deploy to GitHub Pages**:
   - Use `Deploy Blog` to deploy the blog content to GitHub Pages.

#### Using the Context Menu

Right-click in the editor to access the following commands directly:

- **Login to GitHub**
- **Pull Hexo Repository**
- **Push Hexo Repository**
- **Start Server**
- **Stop Server**
- **New Blog**
- **Local Preview**
- **Deploy Blog**

### How It Works

1. **OAuth Login**: Uses GitHub's OAuth authorization flow to securely obtain an access token.
2. **GitHub API**: Interacts with the GitHub API via the Octokit library to perform pull, push, and repository creation operations.
3. **Hexo CLI**: Manages blog posts and servers using Hexo CLI commands.
4. **Local Storage**: Stores access tokens and configurations locally for a smooth user experience.

### Dependencies

The plugin relies on the following npm packages:

- `express`: Creates a local server to handle OAuth callbacks.
- `node-fetch`: Performs HTTP requests.
- `simple-git`: Executes Git commands.
- `@octokit/rest`: GitHub REST API client.
- `open`: Opens URLs in the default browser.

### Notes

- Ensure you create an OAuth application on GitHub and obtain the `Client ID` and `Client Secret`, and configure them in the code.
- Safeguard your access tokens to prevent leaks.

### Contribution

Contributions of any kind are welcome! Please submit issues or pull requests.

### Acknowledgments

Special thanks to the [Hexo](https://hexo.io/) team for their support and contributions, making blog management so simple.

### License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for more information.