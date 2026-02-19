# Splash Screen Design

## Overview

A premium, animated splash screen that showcases the Minikyu mascot while the app initializes. The splash creates a brand impression and covers the 2-5 second startup delay.

## Approach: Living Mascot Scene

The mascot mark appears on a dark gradient background and "comes alive" with floating, blinking, and orbiting particle animations that match the app's existing animation language.

## Architecture

React overlay component rendered inside `AppProviders`, on top of app content:

```
AppProviders
  └─ ThemeProvider
       ├─ SplashScreen (fixed overlay, z-50)
       └─ {children} (renders underneath, initializes normally)
```

The app continues to mount and initialize behind the splash. Once ready, the overlay animates out and unmounts.

## Visual Composition

- **Background:** Full-screen dark gradient (`#1A1124` → `#0B0A12`)
- **Mascot mark:** ~160px, SVG inlined with groups separated for independent animation
  - Character body: gentle float (3.3s cycle)
  - Book: independent bob (2.3s cycle)
  - Eyes: periodic blink (4.4s cycle)
  - Aura glow: soft radial gradient pulse behind character (2.7s cycle)
- **Particles:** 4-6 small gradient dots orbiting the mascot at different radii/speeds (brand palette colors)
- **Wordmark:** "Minikyu" text below mascot in Figtree font, primary gradient color
- **Reduced motion:** All animations disabled, static mascot + wordmark shown immediately

## Animation Timeline

| Phase | Time | Description |
|-------|------|-------------|
| Entrance | 0-600ms | Mascot scales 0.8→1.0 with fade-in, background fades in |
| Wordmark | 400-800ms | "Minikyu" fades in below (overlaps entrance tail) |
| Idle loop | 600ms+ | Float, bob, blink, aura, particle orbit on infinite loops |
| Exit trigger | When ready + min 2s | App signals readiness |
| Exit | 400ms | Mascot scales to 1.1, overlay fades out, then unmounts |

## Readiness Signals

The splash waits for all of these before allowing exit:

1. Minimum 2 seconds elapsed (animation floor)
2. `database-ready` Tauri event received
3. Language initialization complete
4. Menu built

Auto-reconnect and update check are NOT gated (they continue after splash).

## File Structure

| File | Purpose |
|------|---------|
| `src/components/SplashScreen.tsx` | Component with animation logic and readiness tracking |
| `src/styles/splash.css` | Splash-specific keyframes and classes |
| `src/hooks/useAppReady.ts` | Hook tracking initialization signals, returns `isReady` |

## Integration

In `AppProviders.tsx`:

```tsx
<ThemeProvider>
  <SplashScreen>
    {children}
  </SplashScreen>
</ThemeProvider>
```

## Design Decisions

- **React overlay vs. native window:** Overlay is simpler, theme-aware, and leverages existing animation system
- **Inlined SVG:** Necessary to target individual SVG groups for independent animations
- **Self-contained CSS:** Splash animations in separate `splash.css`, not modifying existing `animation.css`
- **Minimum 2s floor:** Ensures the entrance animation always has time to land, even on fast machines
