# Entry List Insert Animation Optimization

## Problem

The current entry list insert animation in `EntryList.tsx` has several issues:

1. **Performance**: The `layout` prop on every `motion.div` entry triggers Motion to measure and animate position changes for all entries on every render, causing jank with many entries.
2. **Visual quality**: `AnimatePresence mode="popLayout"` wraps the entire list, forcing exit animations that conflict with layout recalculations.
3. **Feel**: The `y: -16` initial offset doesn't relate to actual entry height, making the slide feel disconnected. Duration-based easing (0.35s cubic-bezier) lacks the responsiveness of spring physics.
4. **No stagger**: When multiple entries arrive simultaneously, they all animate at once — missing the polished cascade effect.

## Design

### Animation Model: Spring-based slide with measured height expansion and stagger

New entries animate in by expanding from `height: 0` to their measured pixel height with a fade-in. This naturally pushes existing entries downward without needing `layout` on siblings. Multiple entries stagger with 50ms delays, capped at 8 entries.

**Important constraint**: Motion's `height: "auto"` silently ignores spring transitions, falling back to a default tween. To achieve true spring physics, we use a measured pixel height approach — either via the project's existing `useAutoHeight` hook pattern (in `src/components/animate-ui/primitives/effects/auto-height.tsx`) or by wrapping each new entry's content in a ref-measured container. This gives us a concrete pixel target that springs can animate to.

### Changes to `EntryList.tsx`

#### 1. Replace `Set<string>` with `Map<string, number>` for new entry tracking

Current: `newEntryIds` is a `Set<string>` — tracks which entries are new but not their order.

New: `newEntryMap` is a `Map<string, number>` where the value is the stagger index (0-based). Entries beyond index 8 receive index 8 to cap animation sequence length.

The detection effect (lines 205-246) changes to:
- Build `added` array as before from `nextIds.filter(id => !prevSet.has(id))`
- Assign stagger indices: `added.forEach((id, i) => next.set(id, Math.min(i, 8)))`
- Timeout cleanup deletes from the Map instead of the Set

#### 2. Remove `layout` prop from entry `motion.div`

Remove the `layout` prop from the entry wrapper (line 768). This is the biggest performance improvement — Motion no longer measures and animates position for every entry on every render.

#### 3. Remove `AnimatePresence` from entry loop

Remove the `AnimatePresence mode="popLayout"` wrapper around the entry rendering loop (around line 727). Section headers inside the loop are plain `<div>` elements (not `motion.div`) with no exit animations, so removing this `AnimatePresence` has no functional impact on them. Keep `AnimatePresence` only on the sticky section header above the list.

#### 4. Remove exit animations from entries

Remove `exit={{ opacity: 0, y: -8, scale: 0.98 }}` from the entry `motion.div` (line 771). Entries are rarely removed during normal list viewing, and exit animations on a non-virtualized list add overhead.

#### 5. Create `NewEntryAnimationWrapper` component

Extract the animation logic into a small wrapper component that handles height measurement and spring animation:

```typescript
function NewEntryAnimationWrapper({
  isNew,
  staggerIndex,
  children,
}: {
  isNew: boolean;
  staggerIndex: number;
  children: React.ReactNode;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [measuredHeight, setMeasuredHeight] = useState<number | "auto">("auto");
  const [animating, setAnimating] = useState(isNew);

  useEffect(() => {
    if (isNew && contentRef.current) {
      setMeasuredHeight(contentRef.current.scrollHeight);
    }
  }, [isNew]);

  if (!isNew && !animating) {
    // Stable entry — no motion wrapper overhead
    return <div className="px-3">{children}</div>;
  }

  return (
    <motion.div
      className="px-3"
      initial={isNew ? { height: 0, opacity: 0 } : false}
      animate={{ height: measuredHeight, opacity: 1 }}
      transition={{
        height: {
          type: "spring",
          stiffness: 400,
          damping: 30,
          delay: staggerIndex * 0.05,
        },
        opacity: {
          duration: 0.2,
          delay: staggerIndex * 0.05 + 0.05,
        },
      }}
      style={animating ? { overflow: "hidden" } : undefined}
      onAnimationComplete={() => {
        setAnimating(false);
        setMeasuredHeight("auto");
      }}
    >
      <div ref={contentRef}>{children}</div>
    </motion.div>
  );
}
```

Key details:
- **Measured height**: Uses `scrollHeight` to get the actual pixel height, enabling true spring physics.
- **`overflow: hidden` only during animation**: The `onAnimationComplete` callback sets `animating` to false, removing `overflow: hidden` after the spring settles (~300ms) rather than persisting for the full 1600ms highlight period.
- **No motion overhead for stable entries**: When `isNew` is false and animation is complete, renders a plain `<div>` instead of `motion.div`.
- **Height resets to `"auto"`** after animation completes, so the entry can resize naturally if content changes.

#### 6. Updated entry rendering

```typescript
<NewEntryAnimationWrapper
  key={entry.id}
  isNew={isNew}
  staggerIndex={newEntryMap.get(entry.id) ?? 0}
>
  <button ...>
    <Item ...>
      {/* entry content unchanged */}
    </Item>
  </button>
</NewEntryAnimationWrapper>
```

#### 7. Keep unchanged

- New entry highlight styling: `border-primary/50 bg-primary/5 ring-1 ring-primary/20`
- 1600ms timeout for removing "new" status and highlight
- Section header `AnimatePresence` and motion animations
- Pull-to-refresh animation system
- Filter key reset logic (lines 191-203)

## Files Modified

| File | Change |
|------|--------|
| `src/components/miniflux/EntryList.tsx` | All animation changes described above |

## Testing

- Pull-to-refresh with single new entry: smooth spring slide-in expansion
- Pull-to-refresh with multiple new entries (5-10): staggered cascade with 50ms delays
- Auto-poll delivering entries: same animation behavior
- Large list (100+ entries): no jank from removed `layout` prop
- Filter/sort change: no animation flash (filter key reset clears newEntryMap)
- Entry click/selection: no animation interference
- Verify `overflow: hidden` is removed after animation completes, not after 1600ms
- Verify no content clipping on absolutely-positioned elements (unread dots, hover overlays) after animation
