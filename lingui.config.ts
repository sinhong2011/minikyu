import { defineConfig } from '@lingui/cli';
import { formatter } from '@lingui/format-po';

export default defineConfig({
  sourceLocale: 'en',
  locales: ['en', 'zh-CN', 'zh-TW', 'ja', 'ko'],
  catalogs: [
    {
      path: '<rootDir>/src/locales/{locale}/messages',
      include: ['<rootDir>/src'],
      exclude: ['**/node_modules/**', '**/dist/**'],
    },
  ],
  format: formatter(),
  orderBy: 'message',
});
