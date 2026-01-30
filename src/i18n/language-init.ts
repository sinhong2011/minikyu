/**
 * Language initialization utilities for detecting and applying the user's
 * preferred language at app startup.
 */
import { locale } from '@tauri-apps/plugin-os';
import { logger } from '@/lib/logger';
import { availableLanguages, loadAndActivate } from './config';

/**
 * Initialize the application language.
 *
 * Priority:
 * 1. User's saved language preference (if set)
 * 2. System locale (if we have translations for it)
 * 3. English (fallback)
 *
 * @param savedLanguage - The user's saved language preference from preferences
 */
export async function initializeLanguage(savedLanguage: string | null): Promise<void> {
  try {
    if (savedLanguage) {
      if (availableLanguages.includes(savedLanguage)) {
        await loadAndActivate(savedLanguage);
        logger.info('Language set from user preference', {
          language: savedLanguage,
        });
      } else {
        logger.warn('Saved language not available, using English', {
          savedLanguage,
          availableLanguages,
        });
        await loadAndActivate('en');
      }
      return;
    }

    const systemLocale = await locale();
    logger.debug('Detected system locale', { systemLocale });

    if (systemLocale) {
      const systemLocaleLower = systemLocale.toLowerCase();

      // Try full locale code first (e.g., "zh-cn", "zh-tw")
      if (availableLanguages.includes(systemLocaleLower)) {
        await loadAndActivate(systemLocaleLower);
        logger.info('Language set from system locale', {
          systemLocale,
          language: systemLocaleLower,
        });
        return;
      }

      // Try base language code (e.g., "zh" from "zh-cn")
      const parts = systemLocale.split('-');
      const langCode = (parts[0] ?? 'en').toLowerCase();

      // For Chinese, Japanese, Korean - map base codes to specific locales
      const localeMapping: Record<string, string> = {
        zh: 'zh-CN', // Default Chinese to Simplified
        ja: 'ja',
        ko: 'ko',
      };

      const targetLang = localeMapping[langCode] ?? langCode;

      if (availableLanguages.includes(targetLang)) {
        await loadAndActivate(targetLang);
        logger.info('Language set from system locale', {
          systemLocale,
          language: targetLang,
        });
        return;
      }

      logger.debug('System locale not available in translations', {
        systemLocale,
        langCode,
        targetLang,
        availableLanguages,
      });
    }

    await loadAndActivate('en');
    logger.info('Language set to English (fallback)');
  } catch (error) {
    logger.error('Failed to initialize language', { error });
    await loadAndActivate('en');
  }
}
