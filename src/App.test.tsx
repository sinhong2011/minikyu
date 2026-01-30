import { describe, expect, it } from 'vitest';
import { render } from '@/test/test-utils';
import App from './App';

// Tauri bindings are mocked globally in src/test/setup.ts

describe('App', () => {
  it('renders without crashing', () => {
    render(<App />);
    // App should render without throwing errors
    expect(document.body).toBeTruthy();
  });
});
