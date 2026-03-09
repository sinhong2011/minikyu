import { Cancel01Icon, Image01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { locale } from '@tauri-apps/plugin-os';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
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

      <SettingsSection title={_(msg`Date & Time`)}>
        <SettingsField
          label={_(msg`Time Format`)}
          description={_(msg`Choose how times are displayed throughout the app`)}
        >
          <Select
            value={preferences?.time_format ?? '24h'}
            onValueChange={(value: string) => {
              if (preferences) {
                // biome-ignore lint/style/useNamingConvention: Rust backend field
                savePreferences.mutate({ ...preferences, time_format: value });
              }
            }}
            disabled={savePreferences.isPending}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="12h">{_(msg`12-hour`)}</SelectItem>
              <SelectItem value="24h">{_(msg`24-hour`)}</SelectItem>
            </SelectContent>
          </Select>
        </SettingsField>
      </SettingsSection>

      <SettingsSection title={_(msg`Background Image`)}>
        <SettingsField
          label={_(msg`Image`)}
          description={_(msg`Set a custom background image for the app window.`)}
        >
          <BackgroundImagePicker />
        </SettingsField>

        {preferences?.background_image_path && (
          <>
            <SettingsField
              label={_(msg`Size`)}
              description={_(msg`How the image fills the window.`)}
            >
              <Select
                value={preferences.background_image_size ?? 'cover'}
                onValueChange={(value: string) => {
                  if (preferences) {
                    savePreferences.mutate({
                      ...preferences,
                      // biome-ignore lint/style/useNamingConvention: preferences field name
                      background_image_size: value,
                    });
                  }
                }}
                disabled={savePreferences.isPending}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cover">{_(msg`Cover`)}</SelectItem>
                  <SelectItem value="contain">{_(msg`Contain`)}</SelectItem>
                  <SelectItem value="fill">{_(msg`Fill`)}</SelectItem>
                  <SelectItem value="tile">{_(msg`Tile`)}</SelectItem>
                </SelectContent>
              </Select>
            </SettingsField>

            <SettingsField
              label={_(msg`Opacity`)}
              description={_(msg`Adjust the background image transparency.`)}
            >
              <div className="flex items-center gap-3">
                <Slider
                  value={[(preferences.background_image_opacity ?? 0.15) * 100]}
                  onValueChange={(values) => {
                    const value = Array.isArray(values) ? values[0] : values;
                    if (preferences) {
                      savePreferences.mutate({
                        ...preferences,
                        // biome-ignore lint/style/useNamingConvention: preferences field name
                        background_image_opacity: value / 100,
                      });
                    }
                  }}
                  min={0}
                  max={100}
                  step={1}
                  className="flex-1"
                />
                <span className="w-10 text-right text-sm text-muted-foreground">
                  {Math.round((preferences.background_image_opacity ?? 0.15) * 100)}%
                </span>
              </div>
            </SettingsField>

            <SettingsField
              label={_(msg`Blur`)}
              description={_(msg`Apply blur to the background image.`)}
            >
              <div className="flex items-center gap-3">
                <Slider
                  value={[preferences.background_image_blur ?? 0]}
                  onValueChange={(values) => {
                    const value = Array.isArray(values) ? values[0] : values;
                    if (preferences) {
                      savePreferences.mutate({
                        ...preferences,
                        // biome-ignore lint/style/useNamingConvention: preferences field name
                        background_image_blur: value,
                      });
                    }
                  }}
                  min={0}
                  max={40}
                  step={1}
                  className="flex-1"
                />
                <span className="w-10 text-right text-sm text-muted-foreground">
                  {preferences.background_image_blur}px
                </span>
              </div>
            </SettingsField>

            <SettingsField
              label={_(msg`UI Transparency`)}
              description={_(msg`Make UI panels transparent to reveal the background image.`)}
            >
              <div className="flex items-center gap-3">
                <Slider
                  value={[(preferences.background_transparency ?? 0) * 100]}
                  onValueChange={(values) => {
                    const value = Array.isArray(values) ? values[0] : values;
                    if (preferences) {
                      savePreferences.mutate({
                        ...preferences,
                        // biome-ignore lint/style/useNamingConvention: preferences field name
                        background_transparency: value / 100,
                      });
                    }
                  }}
                  min={0}
                  max={100}
                  step={1}
                  className="flex-1"
                />
                <span className="w-10 text-right text-sm text-muted-foreground">
                  {Math.round((preferences.background_transparency ?? 0) * 100)}%
                </span>
              </div>
            </SettingsField>
          </>
        )}
      </SettingsSection>
    </div>
  );
}

function BackgroundImagePicker() {
  const { _ } = useLingui();
  const { data: preferences } = usePreferences();
  const savePreferences = useSavePreferences();
  const imagePath = preferences?.background_image_path;

  const handleSelectImage = async () => {
    const filePath = await openDialog({
      title: _(msg`Select Background Image`),
      multiple: false,
      filters: [
        { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'avif'] },
      ],
    });
    if (!filePath || !preferences) return;
    savePreferences.mutate({
      ...preferences,
      // biome-ignore lint/style/useNamingConvention: preferences field name
      background_image_path: filePath,
    });
  };

  const handleRemoveImage = () => {
    if (!preferences) return;
    savePreferences.mutate({
      ...preferences,
      // biome-ignore lint/style/useNamingConvention: preferences field name
      background_image_path: null,
    });
  };

  return (
    <div className="space-y-2">
      {imagePath ? (
        <div className="flex items-center gap-2">
          <div className="relative h-20 w-32 shrink-0 overflow-hidden rounded-md border border-border/50">
            <img src={convertFileSrc(imagePath)} alt="" className="size-full object-cover" />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <p className="truncate text-sm text-muted-foreground">{imagePath.split('/').pop()}</p>
            <div className="flex gap-1.5">
              <Button variant="outline" size="sm" onClick={handleSelectImage}>
                {_(msg`Change`)}
              </Button>
              <Button variant="ghost" size="sm" onClick={handleRemoveImage}>
                <HugeiconsIcon icon={Cancel01Icon} className="size-3.5" />
                {_(msg`Remove`)}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <Button variant="outline" onClick={handleSelectImage} className="gap-2">
          <HugeiconsIcon icon={Image01Icon} className="size-4" />
          {_(msg`Choose Image`)}
        </Button>
      )}
    </div>
  );
}
