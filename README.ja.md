# Minikyu

[English](README.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | **日本語** | [한국어](README.ko.md)

[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE.md)
[![CI](https://github.com/sinhong2011/minikyu/actions/workflows/ci.yml/badge.svg)](https://github.com/sinhong2011/minikyu/actions/workflows/ci.yml)
[![GitHub Stars](https://img.shields.io/github/stars/sinhong2011/minikyu.svg)](https://github.com/sinhong2011/minikyu/stargazers)

[Miniflux](https://miniflux.app) のための美しいデスクトップクライアント——Miniflux はミニマリストでこだわりのある RSS リーダーです。**Tauri v2**、**React 19**、**TypeScript** で構築。高速、ネイティブ、クロスプラットフォーム。

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

## インストール

### 前提条件

- [Bun](https://bun.sh) - パッケージマネージャー
- [Rust](https://www.rust-lang.org/) - 最新安定版
- [Tauri の依存関係](https://tauri.app/start/prerequisites/) - プラットフォーム固有の要件

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

## 技術スタック

| レイヤー | 技術                                          |
| -------- | --------------------------------------------- |
| フロント | React 19, TypeScript, Vite 7, Bun             |
| UI       | shadcn/ui v4, Tailwind CSS v4                 |
| ルーティング | TanStack Router v1 (ファイルベース)       |
| 状態管理 | Zustand v5, TanStack Query v5                 |
| バックエンド | Tauri v2, Rust                            |
| テスト   | Vitest v4, Testing Library                    |
| 品質     | Biome, ast-grep, clippy, Lefthook, Commitlint |

## ドキュメント

- **[開発者ドキュメント](docs/developer/)** - アーキテクチャ、パターン、詳細ガイド
- **[ユーザーガイド](docs/userguide/)** - エンドユーザー向けドキュメント

## ライセンス

[MIT](LICENSE.md)

サードパーティ依存関係の通知：[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)

---

[Tauri](https://tauri.app) | [shadcn/ui](https://ui.shadcn.com) | [React](https://react.dev) で構築
