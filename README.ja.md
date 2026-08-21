# Minikyu

[English](README.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | **日本語** | [한국어](README.ko.md)

[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE.md)
[![CI](https://github.com/sinhong2011/minikyu/actions/workflows/ci.yml/badge.svg)](https://github.com/sinhong2011/minikyu/actions/workflows/ci.yml)
[![GitHub Stars](https://img.shields.io/github/stars/sinhong2011/minikyu.svg)](https://github.com/sinhong2011/minikyu/stargazers)
[![Docker Image](https://img.shields.io/docker/v/sinhong2011/minikyu-web?label=docker&sort=semver)](https://hub.docker.com/r/sinhong2011/minikyu-web)

[Miniflux](https://miniflux.app) のための美しいクライアント——Miniflux はミニマリストでこだわりのある RSS リーダーです。**Tauri v2**、**React 19**、**TypeScript** で構築。

単一のコードベースから 2 つのアプリを提供します。macOS・Windows・Linux 向けの**ネイティブデスクトップアプリ**と、セルフホストしてスマートフォンを含む任意のブラウザで開ける**インストール可能な PWA** です。

> **注意：** Minikyu はバックエンドとして稼働中の [Miniflux](https://miniflux.app) インスタンス（セルフホストまたはクラウド）が必要です。Miniflux がフィードの取得、解析、保存を担当し、Minikyu はその上にリッチなデスクトップ体験を提供します。

## スクリーンショット

![Minikyu メインビュー](docs/screenshots/main.png)
![Minikyu リーディングビュー](docs/screenshots/capture-2.png)

## 機能

- 📰 **RSS フィード管理** - 購読、カテゴリ管理、OPML インポート/エクスポート
- 🎧 **ポッドキャストプレーヤー** - ツールバーとコマンドパレットからアクセス可能な内蔵オーディオプレーヤー
- 🔍 **コマンドパレット** - `Cmd+K` ですべての操作に素早くアクセス、テーマや言語の切り替えも対応
- ⌨️ **キーボードショートカット** - ナビゲーション、閲覧、操作のための豊富なショートカット
- 🧘 **禅モード** - 集中できる読書体験（`Z` で切り替え）
- 📖 **フォーカスモード** - 没入型の記事閲覧
- 🎨 **テーマと外観** - ライト/ダーク/システム追従テーマ、カスタム背景画像（ローカルファイルまたは URL）、透過度/ぼかし/タイル設定、すりガラス効果
- 🌐 **多言語対応** - 英語、簡体字中国語、繁体字中国語、日本語、韓国語
- 🌏 **AI 翻訳** - LLM による記事翻訳、翻訳プロバイダーの設定が可能
- 👆 **ジェスチャー操作** - スワイプジェスチャーの設定、プルトゥリフレッシュ対応
- 🪟 **クイックペイン** - グローバルショートカットのフローティングウィンドウでどこからでも素早くアクセス
- ☁️ **クラウド同期** - S3 互換ストレージまたは WebDAV で設定をバックアップ・同期、デバウンス付き自動プッシュと起動時プル対応
- 🔄 **同期と自動更新** - リアルタイム Miniflux 同期と進捗トラッキング、アプリの自動更新
- 🖥️ **クロスプラットフォーム** - macOS、Windows、Linux 対応
- 🌍 **インストール可能な PWA** - ブラウザで動く同じリーダー。ホーム画面に追加でき、スマートフォンやタブレットにも対応。オンライン専用——[PWA ドキュメント](docs/developer/pwa.md)を参照
- 📱 **レスポンシブ UI** - スマートフォンでは下部タブバーで片手ナビゲーション。カテゴリとフィードはドロワーに収納

## インストール

### 前提条件

- [Bun](https://bun.sh) 1.4 - パッケージマネージャー兼ランタイム（`mise.toml` で固定）
- 稼働中の [Miniflux](https://miniflux.app) インスタンス
- **デスクトップ**ビルドのみ必要：
  - [Rust](https://www.rust-lang.org/) - 最新安定版
  - [Tauri の依存関係](https://tauri.app/start/prerequisites/) - プラットフォーム固有の要件

**Web** ビルドには Rust も Tauri ツールチェーンも不要です。

### クイックスタート

```bash
# リポジトリをクローン
git clone https://github.com/sinhong2011/minikyu.git
cd minikyu

# 依存関係をインストール
bun install

# git hooks をインストール
bun run lefthook

# 開発サーバーを起動
bun run dev
```

### プロダクションビルド

```bash
bun run tauri build
```

## Web アプリのデプロイ

`web` ターゲットは静的な `dist/` にビルドされ、ブラウザ上で動く完全なリーダーになります。インストール可能でスマートフォンにも対応し、デスクトップアプリのインストールは不要です。

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/sinhong2011/minikyu)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/sinhong2011/minikyu&env=MINIFLUX_URL)

### 設定する変数は 1 つだけ：`MINIFLUX_URL`

```
MINIFLUX_URL = https://reader.example.com
```

**これは必須で、未設定ではデプロイは動作しません。** Miniflux は CORS ヘッダーを返さないため、ブラウザから直接呼び出すことはできません。PWA は代わりに同一オリジンのパス `/miniflux-api/...` を呼び、デプロイ側がそれをあなたのインスタンスへプロキシします：

```
ブラウザ ──▶ /miniflux-api/v1/entries ──▶ https://reader.example.com/v1/entries
             （あなたのデプロイ）            （あなたの Miniflux）
```

プロキシが宛先を固定するため、Web 版の**「サーバー URL」欄は表示専用**です。実際に効くのは API トークンです。Miniflux → 設定 → API キー で発行したトークンでログインしてください。パスワードを変更せずに失効させられます。

| ホスト | プロキシの仕組み | 設定 |
| ------ | ---------------- | ---- |
| Netlify | ビルド時に `MINIFLUX_URL` から `_redirects` を生成 | [`netlify.toml`](netlify.toml) |
| Vercel | エッジ関数（`vercel.json` は環境変数を展開できないため） | [`vercel.json`](vercel.json) |
| Cloudflare Pages | Pages Function（ビルドコマンドは `bun run build:cf`） | [`functions/miniflux-api/`](functions/miniflux-api)、[`cloudflare/`](cloudflare) |
| Docker | イメージ内の nginx。起動時に `MINIFLUX_URL` を読み込む | [`sinhong2011/minikyu-web`](https://hub.docker.com/r/sinhong2011/minikyu-web), [`Dockerfile`](Dockerfile)、[`docker-compose.yml`](docker-compose.yml) |
| nginx / Caddy | 自前のリバースプロキシ | [PWA ドキュメント](docs/developer/pwa.md#production) |

```bash
docker run -p 8085:80 -e MINIFLUX_URL=https://reader.example.com \
  sinhong2011/minikyu-web
```

イメージは [Docker Hub](https://hub.docker.com/r/sinhong2011/minikyu-web) で公開しています。

`MINIFLUX_URL` はコンテナ起動時に読み込まれるため、別の Miniflux に向け直すのは再ビルドではなく再起動だけで済みます。Miniflux がまだ無い場合は [`docker-compose.yml`](docker-compose.yml) が Miniflux と Postgres ごと起動します。イメージは `linux/amd64` と `linux/arm64` 向けに公開しており、`docker build -t minikyu-web .` でこのリポジトリから自分でビルドすることもできます。


> **公開デプロイの前に：** ブラウザ版は認証情報を OS キーチェーンではなく `localStorage` に保存します。デスクトップ版と比べて明確に弱くなります。third-party スクリプトのない、自分が管理するオリジンで配信し、パスワードより API トークンを優先してください。

## 技術スタック

| レイヤー | 技術                                          |
| -------- | --------------------------------------------- |
| フロント | React 19, TypeScript, Vite+ (Rolldown), Bun 1.4 |
| UI       | shadcn/ui v4, Tailwind CSS v4                 |
| ルーティング | TanStack Router v1 (ファイルベース)       |
| 状態管理 | Zustand v5, TanStack Query v5                 |
| バックエンド | Tauri v2, Rust                            |
| テスト   | Vitest v4, Testing Library                    |
| 品質     | oxlint + oxfmt, ast-grep, clippy, Lefthook    |

## ドキュメント

- **[開発者ドキュメント](docs/developer/)** - アーキテクチャ、パターン、詳細ガイド
- **[ユーザーガイド](docs/userguide/)** - エンドユーザー向けドキュメント

## ライセンス

[MIT](LICENSE.md)

サードパーティ依存関係の通知：[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)

---

[Tauri](https://tauri.app) | [shadcn/ui](https://ui.shadcn.com) | [React](https://react.dev) で構築
