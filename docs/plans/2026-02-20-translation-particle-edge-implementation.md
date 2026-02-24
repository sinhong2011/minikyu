# Translation Particle Edge Animation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the shimmer border CSS loading animation with tiny glowing Canvas 2D particles drifting along the left edge of each reader node card during translation.

**Architecture:** A `ParticleColumn` canvas component is conditionally rendered inside `wrapReaderNodeBlock` (in `SafeHtml`) when the parsed `<p>` node has `data-translation-loading="true"`. The existing `buildTranslatedHtml` in `ImmersiveTranslationLayer` already sets this attribute. The shimmer CSS blocks are removed entirely.

**Tech Stack:** React 19, Canvas 2D API (no new deps), motion/react (already installed), Vitest + @testing-library/react

---

### Task 1: Remove shimmer CSS

**Files:**
- Modify: `src/styles/animation.css`

**Step 1: Delete the three shimmer blocks**

Remove these sections from `src/styles/animation.css`:

```css
/* DELETE entire keyframe: */
@keyframes translation-loading-shimmer { ... }

/* DELETE both rules: */
.reader-node-block::before { ... }
.reader-node-block:has([data-translation-loading])::before { ... }

/* DELETE inside @media (prefers-reduced-motion: reduce): */
.reader-node-block::before { ... }
.reader-node-block:has([data-translation-loading])::before { ... }
```

The `translation-appear` and `.reader-translation-block` keyframe/rule must stay (translated text reveal animation is kept).

After deletion, `animation.css` should have no mention of `translation-loading-shimmer` or `reader-node-block::before`.

**Step 2: Verify no CSS test failures**

```bash
bun run typecheck
```

Expected: no errors (CSS changes don't affect TS).

**Step 3: Commit**

```bash
git add src/styles/animation.css
git commit -m "fix(reader): Remove shimmer border loading animation"
```

---

### Task 2: Create ParticleColumn component (TDD)

**Files:**
- Create: `src/components/miniflux/ParticleColumn.tsx`
- Create: `src/components/miniflux/ParticleColumn.test.tsx`

**Step 1: Write the failing tests**

Create `src/components/miniflux/ParticleColumn.test.tsx`:

```tsx
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ParticleColumn } from './ParticleColumn';

describe('ParticleColumn', () => {
  it('renders a canvas element', () => {
    render(<ParticleColumn />);
    const canvas = document.querySelector('canvas');
    expect(canvas).toBeInTheDocument();
  });

  it('canvas is hidden from accessibility tree', () => {
    render(<ParticleColumn />);
    const canvas = document.querySelector('canvas');
    expect(canvas?.getAttribute('aria-hidden')).toBe('true');
  });

  it('canvas has pointer-events-none', () => {
    render(<ParticleColumn />);
    const canvas = document.querySelector('canvas');
    expect(canvas?.className).toContain('pointer-events-none');
  });
});
```

**Step 2: Run to verify failure**

```bash
bun run vitest run src/components/miniflux/ParticleColumn.test.tsx
```

Expected: FAIL — `ParticleColumn` module not found.

**Step 3: Implement ParticleColumn**

Create `src/components/miniflux/ParticleColumn.tsx`:

```tsx
import { useEffect, useRef } from 'react';

const HUES = [264, 320, 180, 30];
const PARTICLE_COUNT = 10;
const CANVAS_WIDTH = 4;

interface Particle {
  y: number;
  vy: number;
  alpha: number;
  r: number;
  hue: number;
}

export function ParticleColumn() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const syncSize = () => {
      canvas.width = CANVAS_WIDTH;
      canvas.height = canvas.offsetHeight || 48;
    };

    syncSize();

    const ro = new ResizeObserver(syncSize);
    ro.observe(canvas);

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = 'hsla(264, 60%, 65%, 0.45)';
        ctx.beginPath();
        ctx.arc(CANVAS_WIDTH / 2, canvas.height / 2, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
      return () => ro.disconnect();
    }

    const particles: Particle[] = Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
      y: (Math.random() * (canvas.height || 48)),
      vy: (Math.random() * 0.5 + 0.2) * (i % 2 === 0 ? 1 : -1),
      alpha: Math.random() * 0.5 + 0.2,
      r: Math.random() * 1.0 + 0.8,
      hue: HUES[i % HUES.length],
    }));

    let frameId: number;

    const draw = () => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const h = canvas.height;
      ctx.clearRect(0, 0, CANVAS_WIDTH, h);

      for (const p of particles) {
        p.y += p.vy;
        if (p.y < -5) p.y = h + 5;
        if (p.y > h + 5) p.y = -5;
        p.alpha = Math.max(0.1, Math.min(0.85, p.alpha + (Math.random() - 0.5) * 0.05));

        const cx = CANVAS_WIDTH / 2;
        const glow = p.r * 2.5;
        const g = ctx.createRadialGradient(cx, p.y, 0, cx, p.y, glow);
        g.addColorStop(0, `hsla(${p.hue}, 65%, 70%, ${p.alpha})`);
        g.addColorStop(1, `hsla(${p.hue}, 65%, 70%, 0)`);

        ctx.beginPath();
        ctx.arc(cx, p.y, glow, 0, Math.PI * 2);
        ctx.fillStyle = g;
        ctx.fill();
      }

      frameId = requestAnimationFrame(draw);
    };

    frameId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(frameId);
      ro.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-y-0 left-0 rounded-l-xl"
      style={{ width: CANVAS_WIDTH }}
    />
  );
}
```

**Step 4: Run tests to verify they pass**

```bash
bun run vitest run src/components/miniflux/ParticleColumn.test.tsx
```

Expected: 3 tests PASS.

**Step 5: Commit**

```bash
git add src/components/miniflux/ParticleColumn.tsx src/components/miniflux/ParticleColumn.test.tsx
git commit -m "feat(reader): Add ParticleColumn canvas component for left-edge glow effect"
```

---

### Task 3: Integrate ParticleColumn into SafeHtml (TDD)

**Files:**
- Modify: `src/components/miniflux/SafeHtml.tsx`
- Modify: `src/components/miniflux/SafeHtml.test.tsx` (add tests)

**Step 1: Write the failing integration tests**

Open `src/components/miniflux/SafeHtml.test.tsx` and add these two tests inside the existing `describe` block (or create one if absent):

```tsx
it('renders ParticleColumn canvas when paragraph has data-translation-loading', () => {
  render(
    <SafeHtml html='<p data-translation-loading="true">Translating paragraph</p>' />
  );
  expect(document.querySelector('canvas')).toBeInTheDocument();
});

it('does not render ParticleColumn canvas for normal paragraphs', () => {
  render(<SafeHtml html="<p>Normal paragraph</p>" />);
  expect(document.querySelector('canvas')).not.toBeInTheDocument();
});
```

**Step 2: Run to verify failure**

```bash
bun run vitest run src/components/miniflux/SafeHtml.test.tsx --reporter=verbose 2>&1 | tail -30
```

Expected: the two new tests FAIL (no canvas rendered).

**Step 3: Add `showParticles` to `wrapReaderNodeBlock` in SafeHtml**

In `src/components/miniflux/SafeHtml.tsx`, make these two changes:

**Change 1** — Add import at top (after existing imports):

```tsx
import { ParticleColumn } from './ParticleColumn';
```

**Change 2** — In the `wrapReaderNodeBlock` function signature, add `showParticles` param:

```tsx
const wrapReaderNodeBlock = ({
  nodeTag,
  textLength,
  nodeText,
  children,
  interactive = true,
  showParticles = false,
}: {
  nodeTag: string;
  textLength: number;
  nodeText: string;
  children: React.ReactNode;
  interactive?: boolean;
  showParticles?: boolean;
}) => {
```

**Change 3** — Inside the returned JSX of `wrapReaderNodeBlock`, add `<ParticleColumn />` after the opening `<div>` and before the `{interactive && ...}` menu block:

```tsx
return (
  <div
    data-reader-node="true"
    // ... existing props unchanged ...
  >
    {showParticles && <ParticleColumn />}
    {interactive && (
      <div className="absolute top-1 right-1 z-20">
        {/* ... menu unchanged ... */}
      </div>
    )}
    {/* ... rest unchanged ... */}
  </div>
);
```

**Change 4** — In the `WRAPPABLE_READER_BLOCK_TAGS` branch of the `replace` function, detect the loading attribute and pass it:

```tsx
if (WRAPPABLE_READER_BLOCK_TAGS.has(domNode.name)) {
  const props = attributesToProps(domNode.attribs);
  // ... existing code unchanged ...
  const isTranslationLoading =
    domNode.name === 'p' && domNode.attribs['data-translation-loading'] === 'true';

  return wrapReaderNodeBlock({
    nodeTag: domNode.name,
    textLength: blockText.length,
    nodeText: blockText,
    interactive: !isImageOnlyBlock,
    showParticles: isTranslationLoading,  // ADD THIS LINE
    children: createElement(
      domNode.name,
      normalizedProps,
      domToReact(domNode.children as any, parserOptions)
    ),
  });
}
```

**Step 4: Run tests to verify they pass**

```bash
bun run vitest run src/components/miniflux/SafeHtml.test.tsx --reporter=verbose 2>&1 | tail -30
```

Expected: all SafeHtml tests PASS including the two new ones.

**Step 5: Run full test suite**

```bash
bun run vitest run 2>&1 | tail -20
```

Expected: all tests PASS.

**Step 6: TypeScript check**

```bash
bun run typecheck
```

Expected: no errors.

**Step 7: Commit**

```bash
git add src/components/miniflux/SafeHtml.tsx src/components/miniflux/SafeHtml.test.tsx
git commit -m "feat(reader): Show left-edge particle glow during translation loading"
```

---

### Task 4: Final quality gate

**Step 1: Run check:all**

```bash
bun run check:all
```

Expected: all checks pass.

**Step 2: Verify visual behaviour manually**

Ask the user to open the reader with translation enabled and confirm:
1. During loading — tiny coloured light points drift along the left edge of the paragraph card
2. No shimmer border anywhere
3. When translation completes — particles disappear, translated text appears below with the existing fade-in animation

**Step 3: Final commit (if any fixups needed)**

```bash
git add -p
git commit -m "fix(reader): <describe any fixup>"
```
