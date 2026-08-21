# Minikyu

[English](README.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | [日本語](README.ja.md) | **한국어**

[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE.md)
[![CI](https://github.com/sinhong2011/minikyu/actions/workflows/ci.yml/badge.svg)](https://github.com/sinhong2011/minikyu/actions/workflows/ci.yml)
[![GitHub Stars](https://img.shields.io/github/stars/sinhong2011/minikyu.svg)](https://github.com/sinhong2011/minikyu/stargazers)
[![Docker Image](https://img.shields.io/docker/v/sinhong2011/minikyu-web?label=docker&sort=semver)](https://hub.docker.com/r/sinhong2011/minikyu-web)

[Miniflux](https://miniflux.app)를 위한 아름다운 클라이언트 — Miniflux는 미니멀하고 소신 있는 RSS 리더입니다. **Tauri v2**, **React 19**, **TypeScript**로 구축.

하나의 코드베이스로 두 가지 앱을 제공합니다. macOS·Windows·Linux용 **네이티브 데스크톱 앱**과, 직접 호스팅해 휴대폰을 포함한 모든 브라우저에서 열 수 있는 **설치 가능한 PWA**입니다.

> **참고:** Minikyu는 백엔드로 실행 중인 [Miniflux](https://miniflux.app) 인스턴스(셀프 호스팅 또는 클라우드)가 필요합니다. Miniflux가 피드 수집, 파싱, 저장을 담당하고 — Minikyu는 그 위에 풍부한 데스크톱 경험을 제공합니다.

## 스크린샷

![Minikyu 메인 화면](docs/screenshots/main.png)
![Minikyu 읽기 화면](docs/screenshots/capture-2.png)

## 기능

- 📰 **RSS 피드 관리** - 구독, 카테고리 관리, OPML 가져오기/내보내기
- 🎧 **팟캐스트 플레이어** - 툴바와 명령 팔레트에서 접근 가능한 내장 오디오 플레이어
- 🔍 **명령 팔레트** - `Cmd+K`로 모든 작업에 빠르게 접근, 테마 및 언어 전환 포함
- ⌨️ **키보드 단축키** - 탐색, 읽기, 작업을 위한 풍부한 단축키
- 🧘 **젠 모드** - 방해 없는 읽기 경험 (`Z`로 전환)
- 📖 **포커스 모드** - 몰입형 글 읽기
- 🎨 **테마 및 외관** - 라이트/다크/시스템 테마, 사용자 지정 배경 이미지(로컬 파일 또는 URL), 투명도/블러/타일 설정, 프로스트 글라스 효과
- 🌐 **다국어 지원** - 영어, 중국어(간체/번체), 일본어, 한국어
- 🌏 **AI 번역** - LLM 기반 글 번역, 번역 제공자 설정 가능
- 👆 **제스처 컨트롤** - 설정 가능한 스와이프 제스처, 당겨서 새로고침 지원
- 🪟 **빠른 창** - 전역 단축키 플로팅 윈도우로 어디서든 빠르게 접근
- ☁️ **클라우드 동기화** - S3 호환 스토리지 또는 WebDAV로 설정 백업 및 동기화, 디바운스 자동 푸시 및 시작 시 풀 지원
- 🔄 **동기화 및 자동 업데이트** - 실시간 Miniflux 동기화 및 진행 상황 추적, 자동 앱 업데이트
- 🖥️ **크로스 플랫폼** - macOS, Windows, Linux 지원
- 🌍 **설치 가능한 PWA** - 브라우저에서 동작하는 동일한 리더. 홈 화면에 추가할 수 있고 휴대폰과 태블릿을 지원합니다. 온라인 전용 — [PWA 문서](docs/developer/pwa.md) 참고
- 📱 **반응형 UI** - 휴대폰에서는 하단 탭 바로 한 손 탐색이 가능하며, 카테고리와 피드는 드로어에 정리됩니다

## 설치

### 사전 요구 사항

- [Bun](https://bun.sh) 1.4 - 패키지 매니저 겸 런타임 (`mise.toml`에 고정)
- 실행 중인 [Miniflux](https://miniflux.app) 인스턴스
- **데스크톱** 빌드에만 필요:
  - [Rust](https://www.rust-lang.org/) - 최신 안정 버전
  - [Tauri 의존성](https://tauri.app/start/prerequisites/) - 플랫폼별 요구 사항

**Web** 빌드에는 Rust도 Tauri 툴체인도 필요하지 않습니다.

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

## 웹 앱 배포

`web` 타깃은 정적 `dist/`로 빌드되며, 브라우저에서 동작하는 완전한 리더입니다. 설치할 수 있고 휴대폰에 맞게 동작하며, 데스크톱 앱 설치가 필요 없습니다.

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/sinhong2011/minikyu)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/sinhong2011/minikyu&env=MINIFLUX_URL)

### 설정할 변수는 하나뿐: `MINIFLUX_URL`

```
MINIFLUX_URL = https://reader.example.com
```

**필수이며, 설정하지 않으면 배포가 동작하지 않습니다.** Miniflux는 CORS 헤더를 보내지 않으므로 브라우저가 직접 호출할 수 없습니다. 대신 PWA는 동일 출처 경로인 `/miniflux-api/...`를 호출하고, 배포 환경이 이를 여러분의 인스턴스로 프록시합니다:

```
브라우저 ──▶ /miniflux-api/v1/entries ──▶ https://reader.example.com/v1/entries
             (내 배포)                      (내 Miniflux)
```

프록시가 대상 주소를 고정하므로 웹 버전에서 **"서버 URL" 입력란은 표시 전용**입니다. 실제로 사용되는 것은 API 토큰입니다. Miniflux → 설정 → API 키에서 발급한 토큰으로 로그인하세요. 비밀번호를 바꾸지 않고도 폐기할 수 있습니다.

| 호스트 | 프록시 방식 | 설정 |
| ------ | ----------- | ---- |
| Netlify | 빌드 시 `MINIFLUX_URL`로 `_redirects` 생성 | [`netlify.toml`](netlify.toml) |
| Vercel | 엣지 함수 (`vercel.json`은 환경 변수를 치환할 수 없음) | [`vercel.json`](vercel.json) |
| Cloudflare Pages | Pages Function (빌드 명령 `bun run build:cf`) | [`functions/miniflux-api/`](functions/miniflux-api), [`cloudflare/`](cloudflare) |
| Docker | 이미지에 포함된 nginx가 시작할 때 `MINIFLUX_URL`을 읽음 | [`sinhong2011/minikyu-web`](https://hub.docker.com/r/sinhong2011/minikyu-web), [`Dockerfile`](Dockerfile), [`docker-compose.yml`](docker-compose.yml) |
| nginx / Caddy | 직접 운영하는 리버스 프록시 | [PWA 문서](docs/developer/pwa.md#production) |

```bash
docker run -p 8085:80 -e MINIFLUX_URL=https://reader.example.com \
  sinhong2011/minikyu-web
```

이미지는 [Docker Hub](https://hub.docker.com/r/sinhong2011/minikyu-web)에 게시되어 있습니다.

`MINIFLUX_URL`은 컨테이너가 시작할 때 읽으므로, 다른 Miniflux로 바꾸려면 재빌드가 아니라 재시작만 하면 됩니다. Miniflux가 아직 없다면 [`docker-compose.yml`](docker-compose.yml)이 Miniflux와 Postgres까지 함께 띄웁니다. 이미지는 `linux/amd64`와 `linux/arm64`용으로 배포되며, `docker build -t minikyu-web .`로 이 저장소에서 직접 빌드할 수도 있습니다.


> **공개 배포 전 확인:** 브라우저 버전은 자격 증명을 OS 키체인이 아닌 `localStorage`에 저장합니다. 데스크톱 대비 명백한 보안 downgrade입니다. 서드파티 스크립트가 없는, 본인이 관리하는 출처에서 제공하고 비밀번호보다 API 토큰을 사용하세요.

## 기술 스택

| 계층     | 기술                                          |
| -------- | --------------------------------------------- |
| 프론트엔드 | React 19, TypeScript, Vite+ (Rolldown), Bun 1.4 |
| UI       | shadcn/ui v4, Tailwind CSS v4                 |
| 라우팅   | TanStack Router v1 (파일 기반)                |
| 상태 관리 | Zustand v5, TanStack Query v5                |
| 백엔드   | Tauri v2, Rust                                |
| 테스트   | Vitest v4, Testing Library                    |
| 품질     | oxlint + oxfmt, ast-grep, clippy, Lefthook    |

## 문서

- **[개발자 문서](docs/developer/)** - 아키텍처, 패턴, 상세 가이드
- **[사용자 가이드](docs/userguide/)** - 최종 사용자 문서

## 라이선스

[MIT](LICENSE.md)

서드파티 의존성 고지: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)

---

[Tauri](https://tauri.app) | [shadcn/ui](https://ui.shadcn.com) | [React](https://react.dev)로 구축
