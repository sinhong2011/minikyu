# Minikyu

[English](README.md) | [简体中文](README.zh-CN.md) | **繁體中文** | [日本語](README.ja.md) | [한국어](README.ko.md)

[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE.md)
[![CI](https://github.com/sinhong2011/minikyu/actions/workflows/ci.yml/badge.svg)](https://github.com/sinhong2011/minikyu/actions/workflows/ci.yml)
[![GitHub Stars](https://img.shields.io/github/stars/sinhong2011/minikyu.svg)](https://github.com/sinhong2011/minikyu/stargazers)

一款精美的 [Miniflux](https://miniflux.app) 桌面用戶端——Miniflux 是一個極簡且有態度的 RSS 閱讀器。基於 **Tauri v2**、**React 19** 和 **TypeScript** 建構。快速、原生、跨平台。

> **注意：** Minikyu 需要一個正在執行的 [Miniflux](https://miniflux.app) 實例（自架或雲端）作為後端。Miniflux 負責訂閱源的擷取、解析和儲存——Minikyu 在此基礎上提供豐富的桌面體驗。

## 截圖

![Minikyu 主介面](docs/screenshots/main.png)
![Minikyu 閱讀視圖](docs/screenshots/capture-2.png)

## 功能

- 📰 **RSS 訂閱管理** - 訂閱、分類管理、OPML 匯入匯出
- 🎧 **Podcast 播放器** - 內建音訊播放器，可從工具列和命令面板存取
- 🔍 **命令面板** - 透過 `Cmd+K` 快速存取所有操作，包括主題和語言切換
- ⌨️ **鍵盤快捷鍵** - 豐富的導航、閱讀和操作快捷鍵
- 🧘 **禪模式** - 無干擾閱讀體驗（按 `Z` 切換）
- 📖 **專注模式** - 沉浸式文章閱讀
- 🎨 **主題與外觀** - 淺色/深色/跟隨系統主題，自訂背景圖片（本機檔案或 URL）、透明度/模糊/平鋪控制和毛玻璃效果
- 🌐 **多語言** - 英語、簡體中文、繁體中文、日語、韓語
- 🌏 **AI 翻譯** - LLM 驅動的文章翻譯，支援設定翻譯服務
- 👆 **手勢控制** - 可設定的滑動手勢，支援下拉重新整理
- 🪟 **快捷視窗** - 全域快捷鍵浮動視窗，隨時隨地快速存取
- ☁️ **雲端同步** - 透過 S3 相容儲存或 WebDAV 備份和同步偏好設定，支援防抖自動推送和啟動時拉取
- 🔄 **同步與自動更新** - 即時 Miniflux 同步與進度追蹤，自動應用程式更新
- 🖥️ **跨平台** - 支援 macOS、Windows 和 Linux

## 安裝

### 前置需求

- [Bun](https://bun.sh) - 套件管理器
- [Rust](https://www.rust-lang.org/) - 最新穩定版
- [Tauri 依賴](https://tauri.app/start/prerequisites/) - 平台特定依賴

### 快速開始

```bash
# 複製儲存庫
git clone https://github.com/sinhong2011/minikyu.git
cd minikyu

# 安裝依賴
bun install

# 安裝 git hooks
bun run lefthook

# 啟動開發伺服器
bun run dev
```

### 正式建構

```bash
bun run tauri build
```

## 技術棧

| 層級   | 技術                                          |
| ------ | --------------------------------------------- |
| 前端   | React 19, TypeScript, Vite 7, Bun             |
| UI     | shadcn/ui v4, Tailwind CSS v4                 |
| 路由   | TanStack Router v1 (基於檔案)                 |
| 狀態   | Zustand v5, TanStack Query v5                 |
| 後端   | Tauri v2, Rust                                |
| 測試   | Vitest v4, Testing Library                    |
| 品質   | Biome, ast-grep, clippy, Lefthook, Commitlint |

## 文件

- **[開發者文件](docs/developer/)** - 架構、模式和詳細指南
- **[使用者指南](docs/userguide/)** - 最終使用者文件

## 授權條款

[MIT](LICENSE.md)

第三方依賴聲明：[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)

---

基於 [Tauri](https://tauri.app) | [shadcn/ui](https://ui.shadcn.com) | [React](https://react.dev) 建構
