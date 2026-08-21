# Minikyu

[English](README.md) | [简体中文](README.zh-CN.md) | **繁體中文** | [日本語](README.ja.md) | [한국어](README.ko.md)

[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE.md)
[![CI](https://github.com/sinhong2011/minikyu/actions/workflows/ci.yml/badge.svg)](https://github.com/sinhong2011/minikyu/actions/workflows/ci.yml)
[![GitHub Stars](https://img.shields.io/github/stars/sinhong2011/minikyu.svg)](https://github.com/sinhong2011/minikyu/stargazers)
[![Docker Image](https://img.shields.io/docker/v/sinhong2011/minikyu-web?label=docker&sort=semver)](https://hub.docker.com/r/sinhong2011/minikyu-web)

一款精美的 [Miniflux](https://miniflux.app) 用戶端——Miniflux 是一個極簡且有態度的 RSS 閱讀器。基於 **Tauri v2**、**React 19** 和 **TypeScript** 建構。

同一套程式碼建構兩個應用：支援 macOS、Windows、Linux 的**原生桌面應用**，以及可自架、在任意瀏覽器（包括手機）中開啟的**可安裝 PWA**。

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
- 🌍 **可安裝 PWA** - 瀏覽器中的同款閱讀器：可加入主畫面，支援手機和平板。僅限線上使用——參見 [PWA 文件](docs/developer/pwa.md)
- 📱 **響應式介面** - 手機端底部標籤列，單手即可導覽；分類與訂閱源收於抽屜中

## 安裝

### 前置需求

- [Bun](https://bun.sh) 1.4 - 套件管理器與執行環境（在 `mise.toml` 中固定）
- 一個正在執行的 [Miniflux](https://miniflux.app) 實例
- 僅**桌面**建構需要：
  - [Rust](https://www.rust-lang.org/) - 最新穩定版
  - [Tauri 依賴](https://tauri.app/start/prerequisites/) - 平台特定依賴

**Web** 建構不需要 Rust 或 Tauri 工具鏈。

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

## 部署 Web 應用

`web` 目標建構為靜態 `dist/`，即瀏覽器中的完整閱讀器——可安裝、適配手機，無需安裝桌面應用。

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/sinhong2011/minikyu)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/sinhong2011/minikyu&env=MINIFLUX_URL)

### 只需設定一個變數：`MINIFLUX_URL`

```
MINIFLUX_URL = https://reader.example.com
```

**這是必需的，未設定則部署無法運作。** Miniflux 不傳送 CORS 標頭，因此瀏覽器無法直接呼叫它。PWA 改為請求同源路徑 `/miniflux-api/...`，由部署環境代理到你的實例：

```
瀏覽器 ──▶ /miniflux-api/v1/entries ──▶ https://reader.example.com/v1/entries
           （你的部署）                    （你的 Miniflux）
```

由於代理已固定目標位址，Web 版中**「伺服器位址」欄位僅供顯示**——真正生效的是 API 權杖。請使用 Miniflux → 設定 → API 金鑰 中產生的權杖登入，它可以在不修改密碼的情況下撤銷。

| 平台 | 代理方式 | 設定 |
| ---- | -------- | ---- |
| Netlify | 建構時由 `MINIFLUX_URL` 產生 `_redirects` | [`netlify.toml`](netlify.toml) |
| Vercel | 邊緣函式（`vercel.json` 無法插入環境變數） | [`vercel.json`](vercel.json) |
| Cloudflare Workers | 位於靜態資源前的 Worker | [`cloudflare/worker.ts`](cloudflare/worker.ts)、[`wrangler.jsonc`](wrangler.jsonc) |
| Docker | 映像檔內建 nginx，啟動時讀取 `MINIFLUX_URL` | [`sinhong2011/minikyu-web`](https://hub.docker.com/r/sinhong2011/minikyu-web), [`Dockerfile`](Dockerfile)、[`docker-compose.yml`](docker-compose.yml) |
| nginx / Caddy | 你自己的反向代理 | [PWA 文件](docs/developer/pwa.md#production) |

```bash
docker run -p 8085:80 -e MINIFLUX_URL=https://reader.example.com \
  sinhong2011/minikyu-web
```

映像檔發布於 [Docker Hub](https://hub.docker.com/r/sinhong2011/minikyu-web)。

`MINIFLUX_URL` 在容器啟動時讀取，因此改指向另一個 Miniflux 只需重啟，不必重新建置。若你還沒有 Miniflux，[`docker-compose.yml`](docker-compose.yml) 會連同 Miniflux 與 Postgres 一起啟動。已發布 `linux/amd64` 與 `linux/arm64` 映像檔；也可以用 `docker build -t minikyu-web .` 從本倉庫自行建置。


> **公開部署前請注意：** 瀏覽器版將憑證儲存在 `localStorage` 而非系統鑰匙圈，安全性確實低於桌面版。請部署在你自己掌控、且沒有第三方指令碼的網域下，並優先使用 API 權杖而非密碼。

## 技術棧

| 層級   | 技術                                          |
| ------ | --------------------------------------------- |
| 前端   | React 19, TypeScript, Vite+ (Rolldown), Bun 1.4 |
| UI     | shadcn/ui v4, Tailwind CSS v4                 |
| 路由   | TanStack Router v1 (基於檔案)                 |
| 狀態   | Zustand v5, TanStack Query v5                 |
| 後端   | Tauri v2, Rust                                |
| 測試   | Vitest v4, Testing Library                    |
| 品質   | oxlint + oxfmt, ast-grep, clippy, Lefthook    |

## 文件

- **[開發者文件](docs/developer/)** - 架構、模式和詳細指南
- **[使用者指南](docs/userguide/)** - 最終使用者文件

## 授權條款

[MIT](LICENSE.md)

第三方依賴聲明：[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)

---

基於 [Tauri](https://tauri.app) | [shadcn/ui](https://ui.shadcn.com) | [React](https://react.dev) 建構
