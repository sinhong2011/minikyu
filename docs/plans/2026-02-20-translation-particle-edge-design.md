# Translation Particle Edge Animation — Design

**Date:** 2026-02-20
**Status:** Approved

## Problem

The current translation loading state shows a shimmer border (animated `box-shadow`) around the entire reader node card. The user wants this replaced with a more subtle, sci-fi effect: tiny glowing particles/light points drifting along the **left edge** of the card while a paragraph is being translated.

## Solution

Replace the shimmer border CSS with a Canvas 2D `ParticleColumn` component rendered on the left edge of each loading reader node block.

## Design

### Visual Behaviour

1. **During loading**: A narrow canvas (~4px wide × card height) appears at the left edge of the `.reader-node-block`, rendered as absolutely-positioned. 8–12 small glowing dots drift slowly up and down the left edge, with randomised positions, sizes (1–2.5px radius), speeds, and alpha values.
2. **On success**: The canvas fades out (CSS transition). The translated text appears below via the existing `translation-appear` animation (unchanged).

### Architecture

**Removed:**
- `translation-loading-shimmer` CSS keyframes
- `.reader-node-block::before` shimmer block (the `opacity`-based fade system)

**Added:**
- `src/components/miniflux/ParticleColumn.tsx` — standalone canvas component
- CSS: `.reader-node-block` gains `overflow: visible` (was already default) to allow the canvas to extend slightly left

**Integration point:**
In `SafeHtml.tsx`, the HTML parser's `replace` function for `WRAPPABLE_READER_BLOCK_TAGS` already receives DOM nodes. When processing a `<p>` node, check if it carries `data-translation-loading="true"`. If yes, pass a `showParticles={true}` flag to `wrapReaderNodeBlock`, which renders `<ParticleColumn>` inside the wrapper div (absolutely positioned on the left edge).

### `ParticleColumn` Component

```tsx
// Renders a <canvas> absolutely on left edge of the card
// Props: visible (boolean), height comes from CSS (100%)
```

- `useEffect` starts/stops the animation loop based on `visible`
- Each particle: `{ y, vy, alpha, r, color }`
- On each frame: update `y += vy`, wrap if out of bounds, draw `radial-gradient`-style circle via `ctx.arc` + `ctx.createRadialGradient`
- Colors: cycle through 3 oklch shades (blue-purple, teal, warm) matching the previous shimmer palette
- On `visible → false`: canvas opacity transitions to 0 via CSS `transition: opacity 0.4s`
- Respects `prefers-reduced-motion`: skip animation, show a simple static dot

### Data flow

```
ImmersiveTranslationLayer
  → buildTranslatedHtml adds data-translation-loading="true" to <p>
  → SafeHtml receives HTML string
  → Parser detects data-translation-loading on <p> inside WRAPPABLE block
  → wrapReaderNodeBlock renders <ParticleColumn visible={true} />
  → ParticleColumn: canvas on left edge, animated dots
```

### No new dependencies

Canvas 2D API — built into every browser/WebView. No Three.js, no additional packages.

## Files Changed

| File | Change |
|------|--------|
| `src/styles/animation.css` | Remove shimmer keyframes + `.reader-node-block::before` shimmer block |
| `src/components/miniflux/ParticleColumn.tsx` | New component |
| `src/components/miniflux/SafeHtml.tsx` | Detect `data-translation-loading` in parser, pass to `wrapReaderNodeBlock` |
| `src/components/miniflux/SafeHtml.test.tsx` | Tests for particle visibility |
| `src/components/miniflux/ParticleColumn.test.tsx` | Unit tests |
