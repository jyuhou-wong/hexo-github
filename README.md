# Hexo-GitHub VSCode Plugin

Hexo-GitHub 是一个 VSCode 插件，旨在简化 Hexo 博客的管理与 GitHub 集成。用户可以通过该插件轻松地创建、更新和部署他们的 Hexo 博客。

## Demo

以下是使用该插件发布的博客的示例：

[博客 Demo](https://blog.hyh.ltd)

## 功能

- **登录到 GitHub**: 使用 OAuth 流程安全地登录到 GitHub。
- **拉取和推送**: 从 GitHub 拉取最新的博客内容，或将本地更改推送到 GitHub。
- **创建新博客**: 通过简单的命令创建新的 Hexo 博客文章。
- **启动和停止 Hexo 服务器**: 在本地启动 Hexo 服务器以预览博客，或停止服务器。
- **本地预览**: 在浏览器中打开本地博客的预览。
- **部署到 GitHub Pages**: 将博客部署到 GitHub Pages，使其在线可访问。
- **管理博客文件**: 在 VSCode 中管理博客的文件结构。

## 安装

1. **下载 VSIX 文件**: 前往 [发布页面](https://github.com/jyuhou-wong/hexo-github/releases) 下载最新的 VSIX 文件。
2. **安装插件**:
   - 在 VSCode 中，打开扩展视图（`Ctrl+Shift+X`）。
   - 点击右上角的三个点，选择 **Install from VSIX...**，然后选择下载的 VSIX 文件。

## 使用指南

该插件提供了两种主要的操作方式：通过命令面板和上下文菜单。

### 通过命令面板

1. **登录到 GitHub**:
   - 打开命令面板 (`Ctrl+Shift+P`)，输入 `Login to GitHub`，然后按照提示进行 OAuth 登录。

2. **拉取和推送**:
   - 使用 `Pull Hexo` 从 GitHub 拉取最新内容。
   - 使用 `Push Hexo` 将本地更改推送到 GitHub。

3. **创建新博客文章**:
   - 输入 `New Blog`，提供文章路径。

4. **启动和停止 Hexo 服务器**:
   - 使用 `Start Server` 启动 Hexo 服务器。
   - 使用 `Stop Server` 停止服务器。

5. **本地预览**:
   - 输入 `Local Preview`，在浏览器中查看博客的本地预览。

6. **部署到 GitHub Pages**:
   - 使用 `Deploy Blog` 将博客内容部署到 GitHub Pages。

### 自定义视图

插件提供了一个自定义视图，用于管理博客文件，如下图所示：

![Hexo GitHub: Blogs](resources/treeview.png)

#### 视图标题操作

- **Open Source Repository**: 打开源代码库。
- **Open Pages Repository**: 打开 GitHub Pages 库。
- **Open GitHub Pages**: 打开 GitHub Pages 网站。

#### 视图项目上下文操作

- **Local Preview**: 预览 Markdown 文件。
- **Add**: 添加新项目。
- **Publish**: 发布草稿。
- **Delete**: 删除项目。

### 通过上下文菜单

在编辑器中右键单击，可以直接访问以下命令：

- **Login to GitHub**
- **Pull Hexo**
- **Push Hexo**
- **Start Server** (仅在服务器未启动时可用)
- **Stop Server** (仅在服务器已启动时可用)
- **New Blog**
- **Local Preview**
- **Deploy Blog**

## 工作原理

1. **登录和认证**: 使用 `startOAuthLogin` 函数处理用户的 GitHub 登录请求，获取并存储访问令牌。
2. **仓库管理**: 使用 `pullHexo` 和 `pushHexo` 函数从 GitHub 拉取和推送博客内容。
3. **博客创建与管理**: 通过 `createNewBlogPost` 和 `addItem` 函数，用户可以创建新的博客文章或页面。
4. **Hexo 服务器管理**: 使用 `startHexoServer` 和 `stopHexoServer` 函数启动和停止本地 Hexo 服务器，支持草稿预览。
5. **预览和部署**: 使用 `localPreview` 函数在本地预览博客，通过 `pushToGitHubPages` 函数将博客部署到 GitHub Pages。
6. **树视图管理**: `BlogsTreeDataProvider` 类实现了博客文章的树视图展示，支持文件系统的变化监控。

## 依赖关系

该插件依赖以下 npm 包：

- `express`: 用于创建本地服务器以处理 OAuth 回调。
- `axios`: 用于进行 HTTP 请求。
- `simple-git`: 用于执行 Git 命令。
- `@octokit/rest`: GitHub 的 REST API 客户端。
- `open`: 用于在默认浏览器中打开 URL。
- `unzipper`: 用于解压 Hexo Starter 模板。

## 注意事项

- 确保在 GitHub 上创建 OAuth 应用，并获取 `Client ID` 和 `Client Secret`，并在代码中配置。
- 请妥善保管访问令牌，避免泄露。
- 在使用插件之前，请确保你的 Hexo 环境已经正确配置。

## 贡献

欢迎任何形式的贡献！请提交问题或拉取请求。

## 感谢

特别感谢 [Hexo](https://hexo.io/) 团队的支持和贡献，使得博客管理变得如此简单。

## 许可证

此项目使用 MIT 许可证。请参阅 [LICENSE](LICENSE) 文件以获取更多信息。

