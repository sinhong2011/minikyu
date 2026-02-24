import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { locale } from '@tauri-apps/plugin-os';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { showToast } from '@/components/ui/sonner';
import { useTheme } from '@/hooks/use-theme';
import { availableLanguages } from '@/i18n';
import { logger } from '@/lib/logger';
import { usePreferences, useSavePreferences } from '@/services/preferences';
import { SettingsField, SettingsSection } from '../shared/SettingsComponents';

const languageNames: Record<string, string> = {
  en: 'English',
  'zh-CN': '简体中文',
  'zh-TW': '繁體中文',
  ja: '日本語',
  ko: '한국어',
};

export function AppearancePane() {
  const { _ } = useLingui();
  const { theme, setTheme } = useTheme();
  const { data: preferences } = usePreferences();
  const savePreferences = useSavePreferences();

  const handleThemeChange = (value: 'light' | 'dark' | 'system') => {
    setTheme(value);

    if (preferences) {
      savePreferences.mutate({ ...preferences, theme: value });
    }
  };

  const handleLanguageChange = async (value: string) => {
    const language = value === 'system' ? null : value;

    try {
      if (language) {
        // Use loadAndActivate to properly load messages and trigger re-renders
        const { loadAndActivate } = await import('@/i18n/config');
        await loadAndActivate(language);
      } else {
        const systemLocale = await locale();
        const systemLocaleLower = systemLocale?.toLowerCase() ?? 'en';

        // Try full locale code first (e.g., "zh-cn", "zh-tw")
        if (availableLanguages.includes(systemLocaleLower)) {
          const { loadAndActivate } = await import('@/i18n/config');
          await loadAndActivate(systemLocaleLower);
        } else {
          // Try base language code with mapping for CJK languages
          const langCode = systemLocale?.split('-')[0]?.toLowerCase() ?? 'en';
          const localeMapping: Record<string, string> = {
            zh: 'zh-CN', // Default Chinese to Simplified
            ja: 'ja',
            ko: 'ko',
          };
          const targetLang = localeMapping[langCode] ?? langCode;
          const finalLang = availableLanguages.includes(targetLang) ? targetLang : 'en';
          const { loadAndActivate } = await import('@/i18n/config');
          await loadAndActivate(finalLang);
        }
      }
    } catch (error) {
      logger.error('Failed to change language', { error });
      showToast.error(_(msg`Something went wrong`));
      return;
    }

    if (preferences) {
      savePreferences.mutate({ ...preferences, language });
    }
  };

  const currentLanguageValue = preferences?.language ?? 'system';

  return (
    <div className="space-y-6">
      <SettingsSection title={_(msg`Language`)}>
        <SettingsField
          label={_(msg`Language`)}
          description={_(msg`Choose your preferred display language`)}
        >
          <Select
            value={currentLanguageValue}
            onValueChange={handleLanguageChange}
            disabled={savePreferences.isPending}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="system">{_(msg`System Default`)}</SelectItem>
              {availableLanguages.map((lang) => (
                <SelectItem key={lang} value={lang}>
                  {languageNames[lang] ?? lang}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingsField>
      </SettingsSection>

      <SettingsSection title={_(msg`Theme`)}>
        <SettingsField
          label={_(msg`Color Theme`)}
          description={_(msg`Choose your preferred color theme`)}
        >
          <Select
            value={theme}
            onValueChange={handleThemeChange}
            disabled={savePreferences.isPending}
          >
            <SelectTrigger>
              <SelectValue placeholder={_(msg`Select theme`)} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="light">{_(msg`Light`)}</SelectItem>
              <SelectItem value="dark">{_(msg`Dark`)}</SelectItem>
              <SelectItem value="system">{_(msg`System`)}</SelectItem>
            </SelectContent>
          </Select>
        </SettingsField>
      </SettingsSection>
    </div>
  );
}
