# Hexo-GitHub VSCode Plugin

[![License](https://img.shields.io/github/license/jyuhou-wong/hexo-github.svg)](https://github.com/jyuhou-wong/hexo-github/blob/master/LICENSE)
[![Build Status](https://github.com/jyuhou-wong/hexo-github/workflows/Release/badge.svg)](https://github.com/jyuhou-wong/hexo-github/actions)
[![Github Downloads](https://img.shields.io/github/downloads/jyuhou-wong/hexo-github/total.svg)](http://gra.caldis.me/?url=https://github.com/jyuhou-wong/hexo-github)
<a title="Hits" target="_blank" href="https://github.com/jyuhou-wong/hexo-github"><img src="https://hits.b3log.org/jyuhou-wong/hexo-github.svg"></a>
[![Github Release Version](https://img.shields.io/github/v/release/jyuhou-wong/hexo-github?color=green&include_prereleases)](https://github.com/jyuhou-wong/hexo-github/releases/latest)

Hexo-GitHub 是一个 VSCode 插件，专注于通过直观的可视化操作简化 Hexo 博客的管理与 GitHub 集成。用户可以通过该插件轻松地创建、更新和部署他们的 Hexo 博客。

## Demo

以下是使用该插件发布的博客的示例：

[博客 Demo](https://blog.hyh.ltd)

## 功能

- **可视化操作**: 支持大多数 Hexo 命令的可视化操作，简化博客管理。
- **登录到 GitHub**: 使用 OAuth 流程安全地登录到 GitHub。
- **拉取和推送**: 从 GitHub 拉取最新的博客内容，或将本地更改推送到 GitHub。
- **创建新博客**: 通过简单的操作创建新的 Hexo 博客文章。
- **启动和停止 Hexo 服务器**: 在本地启动 Hexo 服务器以预览博客，或停止服务器。
- **本地预览**: 在浏览器中打开本地博客的预览。
- **部署到 GitHub Pages**: 将博客部署到 GitHub Pages，使其在线可访问。
- **管理博客文件**: 在 VSCode 中管理博客的文件结构。
- **主题动态切换**: 支持 Hexo 主题的动态切换和安装。
- **配置支持**: 在自定义视图中显示和修改配置。

## 安装

1. **下载 VSIX 文件**: 前往 [发布页面](https://github.com/jyuhou-wong/hexo-github/releases) 下载最新的 VSIX 文件。
2. **安装插件**:
   - 在 VSCode 中，打开扩展视图（`Ctrl+Shift+X`）。
   - 点击右上角的三个点，选择 **Install from VSIX...**，然后选择下载的 VSIX 文件。

## 使用指南

### 可视化操作

插件提供了一个直观的可视化操作界面，用户可以通过上下文菜单轻松进行以下操作：

- **拉取和推送**: 通过导航菜单进行拉取和推送操作。
- **新增站点**: 通过导航菜单添加新的 Hexo 博客站点。
- **打开源代码库**: 快速访问 GitHub 上的源代码库。

#### 上下文菜单操作

- **部署博客**: 将博客内容部署到 GitHub Pages。
- **打开页面库**: 访问 GitHub Pages 库。
- **打开 GitHub Pages**: 在浏览器中查看博客。
- **删除站点**: 删除博客站点。
- **管理主题**: 添加、应用或删除 Hexo 主题。
- **本地预览**: 预览 Markdown 文件。
- **添加项目**: 添加新页面、草稿或博客文章。
- **发布草稿**: 将草稿发布为正式文章。
- **删除项目**: 删除博客项目。

### 视图和菜单

![Hexo GitHub: Blogs](resources/treeview.png)

## 工作原理

1. **登录和认证**: 使用 `startOAuthLogin` 函数处理用户的 GitHub 登录请求，获取并存储访问令牌。
2. **仓库管理**: 使用 `pullHexo` 和 `pushHexo` 函数从 GitHub 拉取和推送博客内容。
3. **博客创建与管理**: 通过 `createNewBlogPost` 和 `addItem` 函数，用户可以创建新的博客文章或页面。
4. **Hexo 服务器管理**: 使用 `startHexoServer` 和 `stopHexoServer` 函数启动和停止本地 Hexo 服务器，支持草稿预览。
5. **预览和部署**: 使用 `localPreview` 函数在本地预览博客，通过 `pushToGitHubPages` 函数将博客部署到 GitHub Pages。
6. **主题和配置管理**: 支持在自定义视图中动态切换主题和显示配置。
7. **树视图管理**: `BlogsTreeDataProvider` 类实现了博客文章的树视图展示，支持文件系统的变化监控。

## 依赖关系

该插件依赖以下 npm 包：

- `express`: 用于创建本地服务器以处理 OAuth 回调。
- `axios`: 用于进行 HTTP 请求。
- `simple-git`: 用于执行 Git 命令。
- `@octokit/rest`: GitHub 的 REST API 客户端。
- `open`: 用于在默认浏览器中打开 URL。
- `unzipper`: 用于解压 Hexo Starter 模板。

## 前置条件

- 用户已安装 Node.js 18 及以上版本，并且具有 npm 包管理器。

## Change Log

All notable changes to the "hexo-github" extension will be documented in this file.

### [2.0.9] - 2024-10-29

#### Added
- Added extension icon.

### [2.0.8] - 2024-10-29

#### Changed
- Changed display name.

### [2.0.6] - 2024-10-28

#### Added
- Added required modules installing method within the initialization of Hexo.

### [2.0.5] - 2024-10-28

#### Fixed
- Fixed default user page creation issue.
- Fixed configuration creation and git initialization issue.

### [2.0.3] - 2024-10-28

#### Added
- Release of version 2.0.3.
- `viewsWelcome` feature.

### [2.0.2] - 2024-10-27

#### Added
- Support for pull and push methods.

### [2.0.1] - 2024-10-27

#### Added
- Release of beta version.
- Site creation support.
- Multiple site support.

### [1.0.7] - 2024-10-25

#### Changed
- Refactored push and pull methods.

### [1.0.6] - 2024-10-23

#### Added
- Support for theme installation.

### [1.0.5] - 2024-10-23

#### Fixed
- Release issue.

### [1.0.4] - 2024-10-23

#### Added
- Support for dynamic theme switching.

### [1.0.3] - 2024-10-22

#### Added
- Dynamic theme switching.
- Theme installation support.
- Configuration display in custom explorer.

#### Fixed
- Button display issue.

### [1.0.2] - 2024-10-20

#### Added
- URL shortcuts and icons.
- Auto-locate target file method.
- Blog explorer panel.

#### Fixed
- TreeView and explorer layout issues.

### [1.0.1] - 2024-10-19

#### Added
- Initial features and fixes, including local preview support.

## 贡献

欢迎任何形式的贡献！请提交问题或拉取请求。

## 感谢

特别感谢 [Hexo](https://hexo.io/) 团队的支持和贡献，使得博客管理变得如此简单。

## 许可证

此项目使用 MIT 许可证。请参阅 [LICENSE](LICENSE) 文件以获取更多信息。
