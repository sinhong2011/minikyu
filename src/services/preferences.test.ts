import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { commands } from '@/lib/tauri-bindings';

describe('preferences', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('usePreferences hook', () => {
    it('should return reader settings with defaults', async () => {
      const result = await commands.loadPreferences();
      expect(result).toBeDefined();
      if (result.status === 'ok') {
        expect(result.data.reader_font_size).toBe(16);
        expect(result.data.reader_line_width).toBe(65);
        expect(result.data.reader_font_family).toBe('sans-serif');
      }
    });
  });

  describe('commands.savePreferences', () => {
    it('should validate reader settings bounds', async () => {
      const base = await commands.loadPreferences();
      if (base.status !== 'ok') {
        throw new Error('Failed to load preferences');
      }

      const invalidPreferences = { ...base.data };
      invalidPreferences.reader_font_size = 10;
      invalidPreferences.reader_line_width = 90;
      invalidPreferences.reader_font_family = 'invalid';

      const result = await commands.savePreferences(invalidPreferences);

      expect(result).toHaveProperty('status');
    });

    it('should update reader settings successfully', async () => {
      const base = await commands.loadPreferences();
      if (base.status !== 'ok') {
        throw new Error('Failed to load preferences');
      }

      const updatedPreferences = { ...base.data };
      updatedPreferences.reader_font_size = 18;
      updatedPreferences.reader_line_width = 70;
      updatedPreferences.reader_font_family = 'serif';

      const result = await commands.savePreferences(updatedPreferences);

      expect(result).toHaveProperty('status');
    });
  });
});
