import { fireEvent, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppReady } from '@/hooks/use-app-ready';
import { SplashScreen } from './SplashScreen';

vi.mock('@/hooks/use-app-ready', () => ({
  useAppReady: vi.fn(),
}));

const mockUseAppReady = vi.mocked(useAppReady);

describe('SplashScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAppReady.mockReturnValue(false);
  });

  it('can be closed by clicking the backdrop', () => {
    const { container } = render(
      <SplashScreen>
        <div>content</div>
      </SplashScreen>
    );

    const backdrop = container.querySelector('.splash-backdrop');
    const dismissButton = container.querySelector('button[aria-label="Dismiss splash screen"]');
    expect(backdrop).not.toBeNull();
    expect(dismissButton).not.toBeNull();

    fireEvent.click(dismissButton!);
    expect(backdrop).toHaveAttribute('data-exiting', 'true');

    fireEvent.animationEnd(backdrop!);
    expect(container.querySelector('.splash-backdrop')).toBeNull();
  });

  it('can be closed with Escape key', () => {
    const { container } = render(
      <SplashScreen>
        <div>content</div>
      </SplashScreen>
    );

    const backdrop = container.querySelector('.splash-backdrop');
    expect(backdrop).not.toBeNull();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(backdrop).toHaveAttribute('data-exiting', 'true');

    fireEvent.animationEnd(backdrop!);
    expect(container.querySelector('.splash-backdrop')).toBeNull();
  });
});
