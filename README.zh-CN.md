# Minikyu

[English](README.md) | **简体中文** | [繁體中文](README.zh-TW.md) | [日本語](README.ja.md) | [한국어](README.ko.md)

[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE.md)
[![CI](https://github.com/sinhong2011/minikyu/actions/workflows/ci.yml/badge.svg)](https://github.com/sinhong2011/minikyu/actions/workflows/ci.yml)
[![GitHub Stars](https://img.shields.io/github/stars/sinhong2011/minikyu.svg)](https://github.com/sinhong2011/minikyu/stargazers)
[![Docker Image](https://img.shields.io/docker/v/sinhong2011/minikyu-web?label=docker&sort=semver)](https://hub.docker.com/r/sinhong2011/minikyu-web)

一款精美的 [Miniflux](https://miniflux.app) 客户端——Miniflux 是一个极简且有态度的 RSS 阅读器。基于 **Tauri v2**、**React 19** 和 **TypeScript** 构建。

同一套代码构建两个应用：支持 macOS、Windows、Linux 的**原生桌面应用**，以及可自托管、在任意浏览器（包括手机）中打开的**可安装 PWA**。

> **注意：** Minikyu 需要一个正在运行的 [Miniflux](https://miniflux.app) 实例（自托管或云端）作为后端。Miniflux 负责订阅源的抓取、解析和存储——Minikyu 在此基础上提供丰富的桌面体验。

## 截图

![Minikyu 主界面](docs/screenshots/main.png)
![Minikyu 阅读视图](docs/screenshots/capture-2.png)

## 功能

- 📰 **RSS 订阅管理** - 订阅、分类管理、OPML 导入导出
- 🎧 **播客播放器** - 内置音频播放器，可从工具栏和命令面板访问
- 🔍 **命令面板** - 通过 `Cmd+K` 快速访问所有操作，包括主题和语言切换
- ⌨️ **键盘快捷键** - 丰富的导航、阅读和操作快捷键
- 🧘 **禅模式** - 无干扰阅读体验（按 `Z` 切换）
- 📖 **专注模式** - 沉浸式文章阅读
- 🎨 **主题与外观** - 浅色/深色/跟随系统主题，自定义背景图片（本地文件或 URL）、透明度/模糊/平铺控制和毛玻璃效果
- 🌐 **多语言** - 英语、简体中文、繁体中文、日语、韩语
- 🌏 **AI 翻译** - LLM 驱动的文章翻译，支持配置翻译服务
- 👆 **手势控制** - 可配置的滑动手势，支持下拉刷新
- 🪟 **快捷窗口** - 全局快捷键浮动窗口，随时随地快速访问
- ☁️ **云同步** - 通过 S3 兼容存储或 WebDAV 备份和同步偏好设置，支持防抖自动推送和启动时拉取
- 🔄 **同步与自动更新** - 实时 Miniflux 同步与进度跟踪，自动应用更新
- 🖥️ **跨平台** - 支持 macOS、Windows 和 Linux
- 🌍 **可安装 PWA** - 浏览器中的同款阅读器：可添加到主屏幕，支持手机和平板。仅在线使用——参见 [PWA 文档](docs/developer/pwa.md)
- 📱 **响应式界面** - 手机端底部标签栏，单手即可导航；分类与订阅源收于抽屉中

## 安装

### 前置要求

- [Bun](https://bun.sh) 1.4 - 包管理器与运行时（在 `mise.toml` 中固定）
- 一个正在运行的 [Miniflux](https://miniflux.app) 实例
- 仅**桌面**构建需要：
  - [Rust](https://www.rust-lang.org/) - 最新稳定版
  - [Tauri 依赖](https://tauri.app/start/prerequisites/) - 平台特定依赖

**Web** 构建不需要 Rust 或 Tauri 工具链。

### 快速开始

```bash
# 克隆仓库
git clone https://github.com/sinhong2011/minikyu.git
cd minikyu

# 安装依赖
bun install

# 安装 git hooks
bun run lefthook

# 启动开发服务器
bun run dev
```

### 生产构建

```bash
bun run tauri build
```

## 部署 Web 应用

`web` 目标构建为静态 `dist/`，即浏览器中的完整阅读器——可安装、适配手机，无需安装桌面应用。

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/sinhong2011/minikyu)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/sinhong2011/minikyu&env=MINIFLUX_URL)

### 只需设置一个变量：`MINIFLUX_URL`

```
MINIFLUX_URL = https://reader.example.com
```

**这是必需的，未设置则部署无法工作。** Miniflux 不发送 CORS 响应头，因此浏览器无法直接调用它。PWA 改为请求同源路径 `/miniflux-api/...`，由部署环境代理到你的实例：

```
浏览器 ──▶ /miniflux-api/v1/entries ──▶ https://reader.example.com/v1/entries
           （你的部署）                    （你的 Miniflux）
```

由于代理已固定目标地址，Web 版中**「服务器地址」字段仅用于显示**——真正生效的是 API 令牌。请使用 Miniflux → 设置 → API 密钥 中生成的令牌登录，它可以在不修改密码的情况下吊销。

| 平台 | 代理方式 | 配置 |
| ---- | -------- | ---- |
| Netlify | 构建时由 `MINIFLUX_URL` 生成 `_redirects` | [`netlify.toml`](netlify.toml) |
| Vercel | 边缘函数（`vercel.json` 无法插入环境变量） | [`vercel.json`](vercel.json) |
| Cloudflare Pages | Pages Function（构建命令 `bun run build:cf`） | [`functions/miniflux-api/`](functions/miniflux-api)、[`cloudflare/`](cloudflare) |
| Docker | 镜像内置 nginx，启动时读取 `MINIFLUX_URL` | [`sinhong2011/minikyu-web`](https://hub.docker.com/r/sinhong2011/minikyu-web), [`Dockerfile`](Dockerfile)、[`docker-compose.yml`](docker-compose.yml) |
| nginx / Caddy | 你自己的反向代理 | [PWA 文档](docs/developer/pwa.md#production) |

```bash
docker run -p 8085:80 -e MINIFLUX_URL=https://reader.example.com \
  sinhong2011/minikyu-web
```

镜像发布在 [Docker Hub](https://hub.docker.com/r/sinhong2011/minikyu-web)。

`MINIFLUX_URL` 在容器启动时读取，因此改指向另一个 Miniflux 只需重启，无需重新构建。若你还没有 Miniflux，[`docker-compose.yml`](docker-compose.yml) 会连同 Miniflux 与 Postgres 一起启动。已发布 `linux/amd64` 与 `linux/arm64` 映像；也可以用 `docker build -t minikyu-web .` 从本仓库自行构建。


> **公开部署前请注意：** 浏览器版将凭据保存在 `localStorage` 而非系统钥匙串，安全性确实低于桌面版。请部署在你自己掌控、且没有第三方脚本的域名下，并优先使用 API 令牌而非密码。

## 技术栈

| 层级   | 技术                                          |
| ------ | --------------------------------------------- |
| 前端   | React 19, TypeScript, Vite+ (Rolldown), Bun 1.4 |
| UI     | shadcn/ui v4, Tailwind CSS v4                 |
| 路由   | TanStack Router v1 (基于文件)                 |
| 状态   | Zustand v5, TanStack Query v5                 |
| 后端   | Tauri v2, Rust                                |
| 测试   | Vitest v4, Testing Library                    |
| 质量   | oxlint + oxfmt, ast-grep, clippy, Lefthook    |

## 文档

- **[开发者文档](docs/developer/)** - 架构、模式和详细指南
- **[用户指南](docs/userguide/)** - 最终用户文档

## 许可证

[MIT](LICENSE.md)

第三方依赖声明：[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)

---

基于 [Tauri](https://tauri.app) | [shadcn/ui](https://ui.shadcn.com) | [React](https://react.dev) 构建
