# Splash Screen Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an animated splash screen with the Minikyu mascot that shows during app initialization and exits once the app is ready.

**Architecture:** A React overlay component inside `AppProviders` that renders on top of app content. A `useAppReady` hook tracks three readiness signals (database-ready event, language/menu init, 2s minimum timer). The splash uses CSS keyframe animations matching the app's existing animation language. When all signals fire, the overlay plays an exit animation and unmounts.

**Tech Stack:** React, CSS keyframes, Tauri event API (`@tauri-apps/api/event`), Vitest + Testing Library

**Design doc:** `docs/plans/2026-02-19-splash-screen-design.md`

---

### Task 1: Create useAppReady hook

**Files:**
- Create: `src/hooks/use-app-ready.ts`
- Test: `src/hooks/use-app-ready.test.ts`

**Step 1: Write the failing test**

```ts
// src/hooks/use-app-ready.test.ts
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock Tauri event API
const mockUnlisten = vi.fn();
let listenCallback: (() => void) | null = null;

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn((event: string, callback: () => void) => {
    if (event === 'database-ready') {
      listenCallback = callback;
    }
    return Promise.resolve(mockUnlisten);
  }),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { useAppReady } = await import('./use-app-ready');

describe('useAppReady', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    listenCallback = null;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts as not ready', () => {
    const { result } = renderHook(() => useAppReady());
    expect(result.current).toBe(false);
  });

  it('is not ready when only timer has elapsed', () => {
    const { result } = renderHook(() => useAppReady());
    act(() => { vi.advanceTimersByTime(2000); });
    expect(result.current).toBe(false);
  });

  it('is not ready when only database-ready fires', () => {
    const { result } = renderHook(() => useAppReady());
    act(() => { listenCallback?.(); });
    expect(result.current).toBe(false);
  });

  it('is not ready when only init-complete fires', () => {
    const { result } = renderHook(() => useAppReady());
    act(() => { window.dispatchEvent(new Event('app-init-complete')); });
    expect(result.current).toBe(false);
  });

  it('becomes ready when all three signals fire', () => {
    const { result } = renderHook(() => useAppReady());

    act(() => { listenCallback?.(); });
    act(() => { window.dispatchEvent(new Event('app-init-complete')); });
    act(() => { vi.advanceTimersByTime(2000); });

    expect(result.current).toBe(true);
  });

  it('becomes ready regardless of signal order', () => {
    const { result } = renderHook(() => useAppReady());

    act(() => { vi.advanceTimersByTime(2000); });
    act(() => { window.dispatchEvent(new Event('app-init-complete')); });
    act(() => { listenCallback?.(); });

    expect(result.current).toBe(true);
  });

  it('cleans up listeners on unmount', () => {
    const { unmount } = renderHook(() => useAppReady());
    unmount();
    expect(mockUnlisten).toHaveBeenCalled();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun run test -- src/hooks/use-app-ready.test.ts`
Expected: FAIL — module `./use-app-ready` not found

**Step 3: Write minimal implementation**

```ts
// src/hooks/use-app-ready.ts
import { listen } from '@tauri-apps/api/event';
import { useEffect, useState } from 'react';
import { logger } from '@/lib/logger';

/**
 * Tracks app initialization readiness. Returns true when all conditions are met:
 * 1. `database-ready` Tauri event received
 * 2. `app-init-complete` window event received (language + menu built)
 * 3. Minimum 2 seconds elapsed (animation floor)
 */
export function useAppReady(): boolean {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let dbReady = false;
    let initReady = false;
    let timerReady = false;

    const check = () => {
      if (dbReady && initReady && timerReady) {
        logger.info('App ready — all initialization signals received');
        setIsReady(true);
      }
    };

    const unlistenPromise = listen('database-ready', () => {
      logger.debug('Splash: database-ready received');
      dbReady = true;
      check();
    });

    const handleInit = () => {
      logger.debug('Splash: app-init-complete received');
      initReady = true;
      check();
    };
    window.addEventListener('app-init-complete', handleInit);

    const timer = setTimeout(() => {
      timerReady = true;
      check();
    }, 2000);

    return () => {
      unlistenPromise.then((fn) => fn());
      window.removeEventListener('app-init-complete', handleInit);
      clearTimeout(timer);
    };
  }, []);

  return isReady;
}
```

**Step 4: Run test to verify it passes**

Run: `bun run test -- src/hooks/use-app-ready.test.ts`
Expected: All 7 tests PASS

**Step 5: Commit**

```bash
git add src/hooks/use-app-ready.ts src/hooks/use-app-ready.test.ts
git commit -m "feat: Add useAppReady hook for splash screen readiness tracking"
```

---

### Task 2: Signal init-complete from AppProviders

**Files:**
- Modify: `src/AppProviders.tsx:26-38` (inside `initLanguageAndMenu`)

**Step 1: Add init-complete dispatch**

At the end of the `initLanguageAndMenu` function in `AppProviders.tsx`, after the `try` block completes (and also in the `catch` — we signal even on failure so the splash doesn't hang):

```tsx
// In the try block, after setupMenuLanguageListener():
window.dispatchEvent(new Event('app-init-complete'));
logger.debug('Dispatched app-init-complete event');

// In the catch block, after logger.warn:
window.dispatchEvent(new Event('app-init-complete'));
```

The full modified function:

```tsx
const initLanguageAndMenu = async () => {
  try {
    const result = await commands.loadPreferences();
    const savedLanguage = result.status === 'ok' ? result.data.language : null;

    await initializeLanguage(savedLanguage);

    await buildAppMenu();
    logger.debug('Application menu built');
    setupMenuLanguageListener();

    window.dispatchEvent(new Event('app-init-complete'));
    logger.debug('Dispatched app-init-complete event');
  } catch (error) {
    logger.warn('Failed to initialize language or menu', { error });
    window.dispatchEvent(new Event('app-init-complete'));
  }
};
```

**Step 2: Run typecheck**

Run: `bunx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/AppProviders.tsx
git commit -m "feat: Dispatch app-init-complete event from AppProviders"
```

---

### Task 3: Create splash screen CSS

**Files:**
- Create: `src/styles/splash.css`
- Modify: `src/styles/global.css:4` (add import)

**Step 1: Create splash.css with all keyframes and classes**

```css
/* src/styles/splash.css */

/* === Entrance === */

@keyframes splash-fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes splash-mascot-enter {
  from {
    opacity: 0;
    transform: scale(0.8);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes splash-wordmark-enter {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* === Idle loops === */

@keyframes splash-character-float {
  0%,
  100% {
    transform: translateY(0) rotate(0deg);
  }
  50% {
    transform: translateY(-6px) rotate(-0.4deg);
  }
}

@keyframes splash-book-bob {
  0%,
  100% {
    transform: translateY(0) rotate(0deg);
  }
  50% {
    transform: translateY(-3px) rotate(-0.9deg);
  }
}

@keyframes splash-eye-blink {
  0%,
  46%,
  50%,
  100% {
    transform: scaleY(1);
  }
  47%,
  49% {
    transform: scaleY(0.18);
  }
}

@keyframes splash-aura-pulse {
  0%,
  100% {
    transform: scale(0.96);
    opacity: 0.5;
  }
  50% {
    transform: scale(1.04);
    opacity: 0.8;
  }
}

@keyframes splash-orbit {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

@keyframes splash-particle-glow {
  0%,
  100% {
    opacity: 0.3;
    transform: scale(0.8);
  }
  50% {
    opacity: 1;
    transform: scale(1.1);
  }
}

/* === Exit === */

@keyframes splash-exit {
  from {
    opacity: 1;
    transform: scale(1);
  }
  to {
    opacity: 0;
    transform: scale(1.06);
  }
}

/* === Classes === */

.splash-overlay {
  animation: splash-fade-in 600ms ease-out both;
}

.splash-overlay[data-exiting="true"] {
  animation: splash-exit 400ms ease-in both;
}

.splash-mascot {
  animation: splash-mascot-enter 600ms cubic-bezier(0.16, 1, 0.3, 1) both;
}

.splash-wordmark {
  animation: splash-wordmark-enter 400ms ease-out 400ms both;
}

.splash-character {
  transform-box: fill-box;
  transform-origin: center;
  animation: splash-character-float 3.3s ease-in-out infinite;
  animation-delay: 600ms;
}

.splash-book {
  transform-box: fill-box;
  transform-origin: center;
  animation: splash-book-bob 2.3s ease-in-out infinite;
  animation-delay: 600ms;
}

.splash-eye {
  transform-box: fill-box;
  transform-origin: center;
  animation: splash-eye-blink 4.4s ease-in-out infinite;
  animation-delay: 600ms;
}

.splash-aura {
  animation: splash-aura-pulse 2.7s ease-in-out infinite;
  animation-delay: 600ms;
}

.splash-orbit-ring {
  animation: splash-orbit var(--orbit-duration, 12s) linear infinite;
}

.splash-particle {
  animation: splash-particle-glow var(--particle-duration, 2.5s) ease-in-out infinite;
  animation-delay: var(--particle-delay, 0s);
}

/* Respect reduced motion preference */
@media (prefers-reduced-motion: reduce) {
  .splash-overlay,
  .splash-mascot,
  .splash-wordmark {
    animation-duration: 0.01ms !important;
  }

  .splash-character,
  .splash-book,
  .splash-eye,
  .splash-aura,
  .splash-orbit-ring,
  .splash-particle {
    animation: none;
  }

  .splash-overlay[data-exiting="true"] {
    animation-duration: 0.01ms !important;
  }
}
```

**Step 2: Add import to global.css**

In `src/styles/global.css`, add after the animation import (line 4):

```css
@import "./splash";
```

**Step 3: Run typecheck**

Run: `bunx tsc --noEmit`
Expected: No errors (CSS files don't affect TS)

**Step 4: Commit**

```bash
git add src/styles/splash.css src/styles/global.css
git commit -m "feat: Add splash screen CSS animations"
```

---

### Task 4: Create SplashScreen component

**Files:**
- Create: `src/components/SplashScreen.tsx`

**Step 1: Create the component**

```tsx
// src/components/SplashScreen.tsx
import { useCallback, useEffect, useState } from 'react';
import { useAppReady } from '@/hooks/use-app-ready';

interface SplashScreenProps {
  children: React.ReactNode;
}

/**
 * Animated splash screen overlay that shows the Minikyu mascot
 * while the app initializes. Renders children immediately (so they
 * mount and initialize), and covers them with the overlay.
 * Once the app is ready, plays an exit animation and unmounts the overlay.
 */
export function SplashScreen({ children }: SplashScreenProps) {
  const isReady = useAppReady();
  const [isExiting, setIsExiting] = useState(false);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (isReady && !isExiting) {
      setIsExiting(true);
    }
  }, [isReady, isExiting]);

  const handleAnimationEnd = useCallback(() => {
    if (isExiting) {
      setIsVisible(false);
    }
  }, [isExiting]);

  return (
    <>
      {children}
      {isVisible && (
        <div
          className="splash-overlay fixed inset-0 z-50 flex flex-col items-center justify-center"
          data-exiting={isExiting}
          onAnimationEnd={handleAnimationEnd}
          style={{
            background: 'linear-gradient(135deg, #1A1124 0%, #0B0A12 100%)',
          }}
        >
          {/* Aura glow behind mascot */}
          <div
            className="splash-aura absolute rounded-full"
            style={{
              width: 240,
              height: 240,
              background:
                'radial-gradient(circle, rgba(255,122,89,0.15) 0%, rgba(255,59,110,0.08) 50%, transparent 70%)',
            }}
          />

          {/* Orbiting particles */}
          <div className="absolute" style={{ width: 280, height: 280 }}>
            {[
              { duration: '14s', delay: '0s', radius: 130, size: 6, color: '#FF7A59' },
              { duration: '18s', delay: '-4s', radius: 120, size: 4, color: '#FF3B6E' },
              { duration: '11s', delay: '-7s', radius: 140, size: 5, color: '#53A8FF' },
              { duration: '16s', delay: '-2s', radius: 125, size: 3, color: '#2B6BFF' },
              { duration: '20s', delay: '-9s', radius: 135, size: 4, color: '#FF7A59' },
            ].map((p, i) => (
              <div
                key={i}
                className="splash-orbit-ring absolute inset-0"
                style={
                  {
                    '--orbit-duration': p.duration,
                  } as React.CSSProperties
                }
              >
                <div
                  className="splash-particle absolute rounded-full"
                  style={
                    {
                      width: p.size,
                      height: p.size,
                      backgroundColor: p.color,
                      boxShadow: `0 0 ${p.size * 2}px ${p.color}`,
                      top: '50%',
                      left: '50%',
                      marginTop: -p.radius,
                      marginLeft: -p.size / 2,
                      '--particle-duration': `${2 + i * 0.4}s`,
                      '--particle-delay': p.delay,
                    } as React.CSSProperties
                  }
                />
              </div>
            ))}
          </div>

          {/* Mascot mark - inlined SVG for individual group animation */}
          <div className="splash-mascot relative" style={{ width: 160, height: 160 }}>
            <svg
              width="160"
              height="160"
              viewBox="0 0 48 48"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <linearGradient
                  id="splash-bg"
                  x1="8"
                  y1="6"
                  x2="42"
                  y2="42"
                  gradientUnits="userSpaceOnUse"
                >
                  <stop stopColor="#FF7A59" />
                  <stop offset="1" stopColor="#FF3B6E" />
                </linearGradient>
                <linearGradient
                  id="splash-panel"
                  x1="14"
                  y1="12"
                  x2="34"
                  y2="36"
                  gradientUnits="userSpaceOnUse"
                >
                  <stop stopColor="#1A1124" />
                  <stop offset="1" stopColor="#0B0A12" />
                </linearGradient>
                <linearGradient
                  id="splash-book"
                  x1="19"
                  y1="28"
                  x2="29"
                  y2="37"
                  gradientUnits="userSpaceOnUse"
                >
                  <stop stopColor="#53A8FF" />
                  <stop offset="1" stopColor="#2B6BFF" />
                </linearGradient>
              </defs>

              {/* Background */}
              <rect x="2.5" y="2.5" width="43" height="43" rx="13" fill="url(#splash-bg)" />
              <rect
                x="2.5"
                y="2.5"
                width="43"
                height="43"
                rx="13"
                fill="none"
                stroke="#FFFFFF"
                strokeOpacity="0.24"
              />

              {/* Panel */}
              <rect x="11" y="9.5" width="26" height="29" rx="8" fill="url(#splash-panel)" />
              <rect
                x="11"
                y="9.5"
                width="26"
                height="29"
                rx="8"
                fill="none"
                stroke="#FFFFFF"
                strokeOpacity="0.2"
              />

              {/* Character group - floats */}
              <g className="splash-character">
                {/* Face */}
                <circle cx="24" cy="23" r="7.3" fill="#FFF7F2" />
                {/* Eyes - blink independently */}
                <g className="splash-eye">
                  <circle cx="21" cy="22.1" r="1" fill="#1A1124" />
                  <circle cx="27" cy="22.1" r="1" fill="#1A1124" />
                </g>
                {/* Smile */}
                <path
                  d="M21.7 25.2c.9 1 3.8 1 4.7 0"
                  stroke="#2A1A30"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                />
              </g>

              {/* Book group - bobs independently */}
              <g className="splash-book">
                <rect x="18" y="27.3" width="12" height="7.8" rx="2.4" fill="url(#splash-book)" />
                <path d="M24 27.3v7.8" stroke="#DBEDFF" strokeOpacity="0.75" strokeWidth="0.7" />
                <path
                  d="M20 29.8h2.8M20 31.6h3.6M25.5 29.8h2.8M25.5 31.6h2.1"
                  stroke="#ECF6FF"
                  strokeWidth="0.9"
                  strokeLinecap="round"
                />
              </g>
            </svg>
          </div>

          {/* Wordmark */}
          <p
            className="splash-wordmark mt-6 text-2xl font-extrabold tracking-tight"
            style={{
              background: 'linear-gradient(90deg, #FF7A59, #FF3B6E, #6A78FF)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            Minikyu
          </p>
        </div>
      )}
    </>
  );
}
```

**Step 2: Run typecheck**

Run: `bunx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/SplashScreen.tsx
git commit -m "feat: Add SplashScreen component with animated mascot"
```

---

### Task 5: Integrate SplashScreen into AppProviders

**Files:**
- Modify: `src/AppProviders.tsx`

**Step 1: Add SplashScreen wrapper**

Add the import at the top of `AppProviders.tsx`:

```tsx
import { SplashScreen } from './components/SplashScreen';
```

Wrap children with SplashScreen in the return:

```tsx
return (
  <ErrorBoundary>
    <ThemeProvider>
      <SplashScreen>{children}</SplashScreen>
    </ThemeProvider>
  </ErrorBoundary>
);
```

**Step 2: Run typecheck**

Run: `bunx tsc --noEmit`
Expected: No errors

**Step 3: Run existing tests**

Run: `bun run test:run`
Expected: All tests pass (splash screen is inert in test environment since Tauri events won't fire)

**Step 4: Commit**

```bash
git add src/AppProviders.tsx
git commit -m "feat: Integrate SplashScreen into AppProviders"
```

---

### Task 6: Manual verification

**Step 1: Run dev server**

Run: `bun run dev`

**Step 2: Verify splash screen behavior**

Check:
- [ ] Dark gradient background appears immediately on app launch
- [ ] Mascot mark scales in with fade animation
- [ ] Character body floats gently (3.3s cycle)
- [ ] Book bobs independently (2.3s cycle)
- [ ] Eyes blink periodically (4.4s cycle)
- [ ] Aura glow pulses behind mascot
- [ ] 5 particles orbit at different speeds and colors
- [ ] "Minikyu" wordmark fades in with gradient text
- [ ] After ~2+ seconds, splash scales up slightly and fades out
- [ ] App content is visible and functional after splash exits

**Step 3: Verify reduced motion**

In macOS System Settings > Accessibility > Display, enable "Reduce motion"
Check:
- [ ] All animations are disabled
- [ ] Static mascot and wordmark appear immediately
- [ ] Splash exits without animation

**Step 4: Run full quality gates**

Run: `bun run check:all`
Expected: All checks pass

**Step 5: Commit any adjustments from manual testing**

If any timing, sizing, or visual tweaks were needed, commit them:

```bash
git add -A
git commit -m "fix: Adjust splash screen timing and visuals after manual testing"
```
