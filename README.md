# Hexo-GitHub VSCode Plugin

Hexo-GitHub 是一个 VSCode 插件，旨在简化 Hexo 博客的管理与 GitHub 集成。用户可以通过该插件轻松地创建、更新和部署他们的 Hexo 博客。

## 功能

- **登录到 GitHub**: 使用 OAuth 流程安全地登录到 GitHub。
- **创建私有库**: 在 GitHub 上创建新的私有库以存储 Hexo 博客。
- **克隆私有库**: 从 GitHub 克隆现有的 Hexo 博客库。
- **拉取和推送**: 从 GitHub 拉取最新的博客内容，或将本地更改推送到 GitHub。
- **创建新博客**: 通过简单的命令创建新的 Hexo 博客文章。
- **启动和停止 Hexo 服务器**: 在本地启动 Hexo 服务器以预览博客，或停止服务器。
- **本地预览**: 在浏览器中打开本地博客的预览。
- **部署到 GitHub Pages**: 将博客部署到 GitHub Pages，使其在线可访问。

## 安装

1. 确保你的机器上安装了 [Node.js](https://nodejs.org/) 和 [npm](https://www.npmjs.com/)。
2. 克隆本仓库：
   ```bash
   git clone https://github.com/jyuhou-wong/hexo-github.git
   cd hexo-github
   ```
3. 安装依赖：
   ```bash
   npm install
   ```
4. 在 VSCode 中打开该项目，并按 `F5` 启动插件开发环境。

## 使用指南

1. **登录到 GitHub**:
   - 通过命令面板（`Ctrl+Shift+P`）输入 `Login to GitHub`，然后按照提示进行 OAuth 登录。

2. **创建新私有库**:
   - 在命令面板中输入 `Create Private Repository`，输入库名并完成创建。

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

## 依赖

该插件依赖以下 npm 包：

- `express`: 用于创建本地服务器以处理 OAuth 回调。
- `node-fetch`: 用于进行 HTTP 请求。
- `simple-git`: 用于执行 Git 命令。
- `@octokit/rest`: GitHub 的 REST API 客户端。
- `open`: 用于在默认浏览器中打开 URL。

## 注意事项

- 确保在 GitHub 上创建 OAuth 应用，并获取 `Client ID` 和 `Client Secret`，并在代码中配置。
- 请妥善保管访问令牌，避免泄露。

## 贡献

欢迎任何形式的贡献！请提交问题或拉取请求。

## 许可证

此项目使用 MIT 许可证。请参阅 LICENSE 文件以获取更多信息。