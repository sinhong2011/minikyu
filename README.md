# Minikyu

[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE.md)
[![CI](https://github.com/sinhong2011/minikyu/actions/workflows/ci.yml/badge.svg)](https://github.com/sinhong2011/minikyu/actions/workflows/ci.yml)
[![GitHub Stars](https://img.shields.io/github/stars/sinhong2011/minikyu.svg)](https://github.com/sinhong2011/minikyu/stargazers)

A modern RSS reader desktop application built with **Tauri v2**, **React 19**, and **TypeScript**. Fast, native, and cross-platform.

## Features

- 📰 **RSS Feed Management** - Subscribe to your favorite feeds and stay updated
- ⌨️ **Keyboard Shortcuts** - Command Palette (`Cmd+K`), Preferences (`Cmd+,`), and more
- 🪟 **Quick Pane** - Global shortcut floating window for quick access from anywhere
- 🎨 **Theme Support** - Light, Dark, or System theme with automatic detection
- 🌐 **Multi-language** - English, Chinese (Simplified/Traditional), Japanese, Korean
- 🔄 **Auto-updates** - Automatic update checking from GitHub releases
- 🖥️ **Cross-platform** - macOS, Windows, and Linux support

## Screenshots

> 📸 Screenshots coming soon

## Installation

### Prerequisites

- [Bun](https://bun.sh) - Package manager
- [Rust](https://www.rust-lang.org/) - Latest stable version
- [Tauri dependencies](https://tauri.app/start/prerequisites/) - Platform-specific requirements

### Quick Start

```bash
# Clone the repository
git clone https://github.com/sinhong2011/minikyu.git
cd minikyu

# Install dependencies
bun install

# Install git hooks
bun run lefthook

# Start development server
bun run dev
```

### Build for Production

```bash
bun run tauri build
```

## Tech Stack

| Layer    | Technologies                                      |
| -------- | ------------------------------------------------- |
| Frontend | React 19, TypeScript, Vite 7, Bun                 |
| UI       | shadcn/ui v4, Tailwind CSS v4                     |
| Routing  | TanStack Router v1 (file-based)                   |
| State    | Zustand v5, TanStack Query v5                     |
| Backend  | Tauri v2, Rust                                    |
| Testing  | Vitest v4, Testing Library                        |
| Quality  | Biome, ast-grep, clippy, Lefthook, Commitlint     |

## Documentation

- **[Developer Docs](docs/developer/)** - Architecture, patterns, and detailed guides
- **[User Guide](docs/userguide/)** - End-user documentation

## License

[MIT](LICENSE.md)

---

Built with [Tauri](https://tauri.app) | [shadcn/ui](https://ui.shadcn.com) | [React](https://react.dev)
