import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TranslationProgressRing } from './TranslationProgressRing';

describe('TranslationProgressRing', () => {
  it('shows completed count in the center', () => {
    render(<TranslationProgressRing completed={3} total={10} />);
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('shows checkmark when complete', () => {
    render(<TranslationProgressRing completed={10} total={10} />);
    expect(screen.getByTestId('progress-ring-complete')).toBeInTheDocument();
  });

  it('does not render when total is 0', () => {
    const { container } = render(<TranslationProgressRing completed={0} total={0} />);
    expect(container.firstChild).toBeNull();
  });
});
