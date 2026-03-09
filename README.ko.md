# Minikyu

[English](README.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | [日本語](README.ja.md) | **한국어**

[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE.md)
[![CI](https://github.com/sinhong2011/minikyu/actions/workflows/ci.yml/badge.svg)](https://github.com/sinhong2011/minikyu/actions/workflows/ci.yml)
[![GitHub Stars](https://img.shields.io/github/stars/sinhong2011/minikyu.svg)](https://github.com/sinhong2011/minikyu/stargazers)

[Miniflux](https://miniflux.app)를 위한 아름다운 데스크톱 클라이언트 — Miniflux는 미니멀하고 소신 있는 RSS 리더입니다. **Tauri v2**, **React 19**, **TypeScript**로 구축. 빠르고, 네이티브하며, 크로스 플랫폼을 지원합니다.

> **참고:** Minikyu는 백엔드로 실행 중인 [Miniflux](https://miniflux.app) 인스턴스(셀프 호스팅 또는 클라우드)가 필요합니다. Miniflux가 피드 수집, 파싱, 저장을 담당하고 — Minikyu는 그 위에 풍부한 데스크톱 경험을 제공합니다.

## 스크린샷

![Minikyu 메인 화면](docs/screenshots/main.png)

## 기능

- 📰 **RSS 피드 관리** - 구독, 카테고리 관리, OPML 가져오기/내보내기
- 🎧 **팟캐스트 플레이어** - 툴바와 명령 팔레트에서 접근 가능한 내장 오디오 플레이어
- 🔍 **명령 팔레트** - `Cmd+K`로 모든 작업에 빠르게 접근, 테마 및 언어 전환 포함
- ⌨️ **키보드 단축키** - 탐색, 읽기, 작업을 위한 풍부한 단축키
- 🧘 **젠 모드** - 방해 없는 읽기 경험 (`Z`로 전환)
- 📖 **포커스 모드** - 몰입형 글 읽기
- 🎨 **테마 및 외관** - 라이트/다크/시스템 테마, 사용자 지정 배경 이미지, 투명도, 프로스트 글라스 효과
- 🌐 **다국어 지원** - 영어, 중국어(간체/번체), 일본어, 한국어
- 🌏 **AI 번역** - LLM 기반 글 번역, 번역 제공자 설정 가능
- 👆 **제스처 컨트롤** - 설정 가능한 스와이프 제스처, 당겨서 새로고침 지원
- 🪟 **빠른 창** - 전역 단축키 플로팅 윈도우로 어디서든 빠르게 접근
- 🔄 **동기화 및 자동 업데이트** - 실시간 Miniflux 동기화 및 진행 상황 추적, 자동 앱 업데이트
- 🖥️ **크로스 플랫폼** - macOS, Windows, Linux 지원

## 설치

### 사전 요구 사항

- [Bun](https://bun.sh) - 패키지 매니저
- [Rust](https://www.rust-lang.org/) - 최신 안정 버전
- [Tauri 의존성](https://tauri.app/start/prerequisites/) - 플랫폼별 요구 사항

### 빠른 시작

```bash
# 저장소 클론
git clone https://github.com/sinhong2011/minikyu.git
cd minikyu

# 의존성 설치
bun install

# git hooks 설치
bun run lefthook

# 개발 서버 시작
bun run dev
```

### 프로덕션 빌드

```bash
bun run tauri build
```

## 기술 스택

| 계층     | 기술                                          |
| -------- | --------------------------------------------- |
| 프론트엔드 | React 19, TypeScript, Vite 7, Bun           |
| UI       | shadcn/ui v4, Tailwind CSS v4                 |
| 라우팅   | TanStack Router v1 (파일 기반)                |
| 상태 관리 | Zustand v5, TanStack Query v5                |
| 백엔드   | Tauri v2, Rust                                |
| 테스트   | Vitest v4, Testing Library                    |
| 품질     | Biome, ast-grep, clippy, Lefthook, Commitlint |

## 문서

- **[개발자 문서](docs/developer/)** - 아키텍처, 패턴, 상세 가이드
- **[사용자 가이드](docs/userguide/)** - 최종 사용자 문서

## 라이선스

[MIT](LICENSE.md)

서드파티 의존성 고지: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)

---

[Tauri](https://tauri.app) | [shadcn/ui](https://ui.shadcn.com) | [React](https://react.dev)로 구축
