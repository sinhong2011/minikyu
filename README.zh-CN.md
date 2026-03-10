# Minikyu

[English](README.md) | **简体中文** | [繁體中文](README.zh-TW.md) | [日本語](README.ja.md) | [한국어](README.ko.md)

[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE.md)
[![CI](https://github.com/sinhong2011/minikyu/actions/workflows/ci.yml/badge.svg)](https://github.com/sinhong2011/minikyu/actions/workflows/ci.yml)
[![GitHub Stars](https://img.shields.io/github/stars/sinhong2011/minikyu.svg)](https://github.com/sinhong2011/minikyu/stargazers)

一款精美的 [Miniflux](https://miniflux.app) 桌面客户端——Miniflux 是一个极简且有态度的 RSS 阅读器。基于 **Tauri v2**、**React 19** 和 **TypeScript** 构建。快速、原生、跨平台。

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

## 安装

### 前置要求

- [Bun](https://bun.sh) - 包管理器
- [Rust](https://www.rust-lang.org/) - 最新稳定版
- [Tauri 依赖](https://tauri.app/start/prerequisites/) - 平台特定依赖

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

## 技术栈

| 层级   | 技术                                          |
| ------ | --------------------------------------------- |
| 前端   | React 19, TypeScript, Vite 7, Bun             |
| UI     | shadcn/ui v4, Tailwind CSS v4                 |
| 路由   | TanStack Router v1 (基于文件)                 |
| 状态   | Zustand v5, TanStack Query v5                 |
| 后端   | Tauri v2, Rust                                |
| 测试   | Vitest v4, Testing Library                    |
| 质量   | Biome, ast-grep, clippy, Lefthook, Commitlint |

## 文档

- **[开发者文档](docs/developer/)** - 架构、模式和详细指南
- **[用户指南](docs/userguide/)** - 最终用户文档

## 许可证

[MIT](LICENSE.md)

第三方依赖声明：[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)

---

基于 [Tauri](https://tauri.app) | [shadcn/ui](https://ui.shadcn.com) | [React](https://react.dev) 构建
