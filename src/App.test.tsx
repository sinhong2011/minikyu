import { describe, expect, it } from 'vite-plus/test';
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
