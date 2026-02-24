import { useEffect, useRef } from 'react';

const CANVAS_SIZE = 28;
const CORNER_RADIUS = 12; // matches rounded-xl (0.75rem = 12px)
const LINE_OFFSET = 1.5; // center of stroke, positioned just inside corner arc
const FLOW_PERIOD = 3200; // ms per back-and-forth cycle
const TAIL = 22; // trailing sample points behind the head

const INNER_R = CORNER_RADIUS - LINE_OFFSET; // arc inner radius ≈ 10.5

/** Pre-sample the L path into evenly-spaced (x, y) points. */
function buildLPoints(n: number): Array<{ x: number; y: number }> {
  const seg1 = CANVAS_SIZE - CORNER_RADIUS; // top horizontal: 16px
  const seg2 = INNER_R * (Math.PI / 2); // quarter arc: ≈16.5px
  const seg3 = CANVAS_SIZE - CORNER_RADIUS; // left vertical:  16px
  const total = seg1 + seg2 + seg3;

  const points: Array<{ x: number; y: number }> = [];

  for (let i = 0; i < n; i++) {
    const s = (i / n) * total;

    if (s < seg1) {
      // Segment 1 — top, flowing right→left
      points.push({ x: CANVAS_SIZE - (s / seg1) * seg1, y: LINE_OFFSET });
    } else if (s < seg1 + seg2) {
      // Segment 2 — corner arc, counterclockwise
      const angle = -Math.PI / 2 - (s - seg1) / INNER_R;
      points.push({
        x: CORNER_RADIUS + INNER_R * Math.cos(angle),
        y: CORNER_RADIUS + INNER_R * Math.sin(angle),
      });
    } else {
      // Segment 3 — left side, flowing top→bottom
      const t = (s - seg1 - seg2) / seg3;
      points.push({ x: LINE_OFFSET, y: CORNER_RADIUS + t * seg3 });
    }
  }

  return points;
}

const PATH = buildLPoints(60);

function drawLShape(ctx: CanvasRenderingContext2D): void {
  ctx.beginPath();
  ctx.moveTo(CANVAS_SIZE, LINE_OFFSET);
  ctx.lineTo(CORNER_RADIUS, LINE_OFFSET);
  ctx.arc(CORNER_RADIUS, CORNER_RADIUS, INNER_R, -Math.PI / 2, Math.PI, true);
  ctx.lineTo(LINE_OFFSET, CANVAS_SIZE);
}

/** Read --primary oklch values from CSS, with a sensible fallback. */
function readPrimaryOklch(): { l: number; c: number; h: number } {
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim();
  const match = raw.match(/oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)/);
  if (match?.[1] && match[2] && match[3]) {
    return {
      l: parseFloat(match[1]),
      c: parseFloat(match[2]),
      h: parseFloat(match[3]),
    };
  }
  return { l: 0.62, c: 0.22, h: 1 };
}

export function ParticleColumn() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = CANVAS_SIZE;
    canvas.height = CANVAS_SIZE;

    const { l: baseL, c: baseC, h: baseH } = readPrimaryOklch();
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.strokeStyle = `oklch(${baseL} ${baseC} ${baseH} / 0.4)`;
        ctx.lineWidth = 1.5;
        ctx.lineCap = 'round';
        drawLShape(ctx);
        ctx.stroke();
      }
      return;
    }

    let frameId: number;
    const startTime = Date.now();
    const n = PATH.length;

    const draw = () => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

      // Dim guide rail — barely visible track
      ctx.save();
      ctx.strokeStyle = `oklch(${baseL} ${baseC} ${baseH} / 0.12)`;
      ctx.lineWidth = 1.5;
      ctx.lineCap = 'round';
      drawLShape(ctx);
      ctx.stroke();
      ctx.restore();

      // Flowing comet: ping-pong back-and-forth along path
      const t = ((Date.now() - startTime) % FLOW_PERIOD) / FLOW_PERIOD;
      const pingPong = 0.5 - 0.5 * Math.cos(t * 2 * Math.PI); // 0→1→0 smooth
      const headPos = pingPong * (n - 1);
      const direction = t < 0.5 ? 1 : -1; // forward or backward

      ctx.save();
      for (let i = TAIL; i >= 0; i--) {
        const rawPos = headPos - direction * i;
        const idx = Math.round(Math.max(0, Math.min(n - 1, rawPos)));
        const pt = PATH[idx];
        if (!pt) continue;

        const progress = 1 - i / TAIL; // 0 = tail end, 1 = head
        const alpha = progress * progress * 0.88;
        const radius = 0.7 + progress * 0.8;
        // Tail: base primary; head: brighter (+0.2 L) and more vivid (+chroma)
        const l = (baseL + progress * 0.2).toFixed(2);
        const c = (baseC * (0.6 + progress * 0.5)).toFixed(2);

        ctx.shadowBlur = i === 0 ? 7 : 0;
        ctx.shadowColor = `oklch(${(baseL + 0.2).toFixed(2)} ${baseC} ${baseH})`;

        ctx.beginPath();
        ctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = `oklch(${l} ${c} ${baseH} / ${alpha.toFixed(3)})`;
        ctx.fill();
      }
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
