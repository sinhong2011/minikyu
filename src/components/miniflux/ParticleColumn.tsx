import { useEffect, useRef } from 'react';

// Canvas size covers the top-left corner arc region of the reader card
const CANVAS_SIZE = 28;
// Must match rounded-xl corner radius (0.75rem = 12px)
const CORNER_RADIUS = 12;
// Half of stroke width — positions the line just inside the corner arc
const LINE_OFFSET = 1.5;
const BREATH_PERIOD = 3400; // ms per inhale/exhale cycle

/**
 * Traces an L-shaped path that hugs the inside of the card's top-left corner arc.
 * Top horizontal segment → quarter-circle arc → left vertical segment.
 */
function drawLPath(ctx: CanvasRenderingContext2D): void {
  const innerR = CORNER_RADIUS - LINE_OFFSET;
  ctx.beginPath();
  ctx.moveTo(CANVAS_SIZE, LINE_OFFSET);
  ctx.lineTo(CORNER_RADIUS, LINE_OFFSET);
  // Quarter arc counterclockwise: from top (-π/2) to left (π)
  ctx.arc(CORNER_RADIUS, CORNER_RADIUS, innerR, -Math.PI / 2, Math.PI, true);
  ctx.lineTo(LINE_OFFSET, CANVAS_SIZE);
}

export function ParticleColumn() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = CANVAS_SIZE;
    canvas.height = CANVAS_SIZE;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.strokeStyle = 'hsla(240, 80%, 70%, 0.45)';
        ctx.lineWidth = 1.5;
        ctx.lineCap = 'round';
        drawLPath(ctx);
        ctx.stroke();
      }
      return;
    }

    let frameId: number;
    const startTime = Date.now();

    const draw = () => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

      const t = ((Date.now() - startTime) % BREATH_PERIOD) / BREATH_PERIOD;
      // Smooth sine-wave breath: 0 → 1 → 0 (inhale → peak → exhale)
      const breath = 0.5 - 0.5 * Math.cos(t * 2 * Math.PI);

      // Hue drifts: indigo (260°) at rest → cyan-blue (200°) at peak breath
      const hue = 260 - 60 * breath;
      const alpha = 0.18 + breath * 0.72;
      const glow = 2 + breath * 9;

      ctx.save();
      ctx.lineCap = 'round';

      // Pass 1: outer glow — wider, softer
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = `hsla(${hue}, 85%, 70%, ${alpha})`;
      ctx.shadowColor = `hsl(${hue}, 90%, 65%)`;
      ctx.shadowBlur = glow;
      drawLPath(ctx);
      ctx.stroke();

      // Pass 2: bright core — thinner, sharper highlight
      ctx.lineWidth = 0.75;
      ctx.strokeStyle = `hsla(${hue + 20}, 100%, 88%, ${Math.min(1, alpha * 1.1)})`;
      ctx.shadowBlur = glow * 0.5;
      drawLPath(ctx);
      ctx.stroke();

      ctx.restore();

      frameId = requestAnimationFrame(draw);
    };

    frameId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frameId);
  }, []);

  return (
    // biome-ignore lint/a11y/noAriaHiddenOnFocusable: decorative animation canvas, not keyboard-focusable
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute top-0 left-0"
      style={{ width: CANVAS_SIZE, height: CANVAS_SIZE }}
    />
  );
}
