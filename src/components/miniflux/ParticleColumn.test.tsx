import { render } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { ParticleColumn } from './ParticleColumn';

beforeAll(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class ResizeObserver {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    }
  );
});

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
