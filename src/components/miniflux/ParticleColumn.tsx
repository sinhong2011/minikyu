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
      y: Math.random() * (canvas.height || 48),
      vy: (Math.random() * 0.5 + 0.2) * (i % 2 === 0 ? 1 : -1),
      alpha: Math.random() * 0.5 + 0.2,
      r: Math.random() * 1.0 + 0.8,
      hue: HUES[i % HUES.length] ?? 264,
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
    // biome-ignore lint/a11y/noAriaHiddenOnFocusable: decorative animation canvas, not keyboard-focusable
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-y-0 left-0 rounded-l-xl"
      style={{ width: CANVAS_WIDTH }}
    />
  );
}
