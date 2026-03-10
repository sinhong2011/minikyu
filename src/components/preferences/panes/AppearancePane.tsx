import {
  Cancel01Icon,
  FolderOpenIcon,
  Image01Icon,
  Link01Icon,
  Loading03Icon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { locale } from '@tauri-apps/plugin-os';
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Menu, MenuItem, MenuPanel, MenuTrigger } from '@/components/ui/menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { showToast } from '@/components/ui/sonner';
import { useLocalImageUrl } from '@/hooks/use-local-image-url';
import { useTheme } from '@/hooks/use-theme';
import { availableLanguages } from '@/i18n';
import { logger } from '@/lib/logger';
import { commands } from '@/lib/tauri-bindings';
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
            <SelectTrigger className="w-48">
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
            <SelectTrigger className="w-48">
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
            <SelectTrigger className="w-48">
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
        <AnimatePresence mode="wait">
          <motion.div
            key={preferences?.background_image_path ? 'has-image' : 'no-image'}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            <BackgroundImagePicker />
          </motion.div>
        </AnimatePresence>

        <AnimatePresence>
          {preferences?.background_image_path && (
            <motion.div
              className="space-y-4"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            >
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
                  <SelectTrigger className="w-32">
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
                <div className="flex w-48 items-center gap-3">
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
                  <span className="w-10 text-right text-sm tabular-nums text-muted-foreground">
                    {Math.round((preferences.background_image_opacity ?? 0.15) * 100)}%
                  </span>
                </div>
              </SettingsField>

              <SettingsField
                label={_(msg`Blur`)}
                description={_(msg`Apply blur to the background image.`)}
              >
                <div className="flex w-48 items-center gap-3">
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
                  <span className="w-10 text-right text-sm tabular-nums text-muted-foreground">
                    {preferences.background_image_blur}px
                  </span>
                </div>
              </SettingsField>

              <SettingsField
                label={_(msg`UI Transparency`)}
                description={_(msg`Make UI panels transparent to reveal the background image.`)}
              >
                <div className="flex w-48 items-center gap-3">
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
                  <span className="w-10 text-right text-sm tabular-nums text-muted-foreground">
                    {Math.round((preferences.background_transparency ?? 0) * 100)}%
                  </span>
                </div>
              </SettingsField>
            </motion.div>
          )}
        </AnimatePresence>
      </SettingsSection>
    </div>
  );
}

function BackgroundImagePicker() {
  const { _ } = useLingui();
  const { data: preferences } = usePreferences();
  const savePreferences = useSavePreferences();
  const imagePath = preferences?.background_image_path;
  const imageUrl = useLocalImageUrl(imagePath);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlValue, setUrlValue] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);

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
      // biome-ignore lint/style/useNamingConvention: preferences field name
      background_image_url: null,
    });
  };

  const handleUrlSubmit = async () => {
    const trimmed = urlValue.trim();
    if (!trimmed || !preferences) return;

    setIsDownloading(true);
    try {
      const result = await commands.downloadBackgroundImage(trimmed);
      if (result.status === 'ok') {
        savePreferences.mutate({
          ...preferences,
          // biome-ignore lint/style/useNamingConvention: preferences field name
          background_image_path: result.data,
          // biome-ignore lint/style/useNamingConvention: preferences field name
          background_image_url: trimmed,
        });
        setUrlValue('');
        setShowUrlInput(false);
      } else {
        showToast.error(result.error);
      }
    } catch {
      showToast.error(_(msg`Failed to download image`));
    } finally {
      setIsDownloading(false);
    }
  };

  const handleRemoveImage = () => {
    if (!preferences) return;
    savePreferences.mutate({
      ...preferences,
      // biome-ignore lint/style/useNamingConvention: preferences field name
      background_image_path: null,
      // biome-ignore lint/style/useNamingConvention: preferences field name
      background_image_url: null,
    });
  };

  return imagePath ? (
    <div className="space-y-3">
      <div className="group/preview relative aspect-[21/9] w-full overflow-hidden rounded-lg border border-border/50">
        {imageUrl && <img src={imageUrl} alt="" className="size-full object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        <Button
          variant="secondary"
          size="icon-xs"
          onClick={handleRemoveImage}
          className="absolute top-2 right-2"
        >
          <HugeiconsIcon icon={Cancel01Icon} className="size-3.5" />
        </Button>
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-3">
          <p className="truncate text-xs text-white/40 opacity-0 transition-opacity group-hover/preview:opacity-100">
            {imagePath.split(/[/\\]/).pop()}
          </p>
          <Menu>
            <MenuTrigger
              render={
                <Button variant="secondary" size="sm" className="gap-1.5 text-xs">
                  <HugeiconsIcon icon={Image01Icon} className="size-3.5" />
                  {_(msg`Change`)}
                </Button>
              }
            />
            <MenuPanel>
              <MenuItem onClick={handleSelectImage}>
                <HugeiconsIcon icon={FolderOpenIcon} className="size-4" />
                {_(msg`Choose File`)}
              </MenuItem>
              <MenuItem onClick={() => setShowUrlInput(true)}>
                <HugeiconsIcon icon={Link01Icon} className="size-4" />
                {_(msg`From URL`)}
              </MenuItem>
            </MenuPanel>
          </Menu>
        </div>
      </div>
      <AnimatePresence>
        {showUrlInput && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="flex gap-2">
              <Input
                type="url"
                value={urlValue}
                onChange={(e) => setUrlValue(e.target.value)}
                placeholder="https://example.com/image.jpg"
                disabled={isDownloading}
                className="flex-1"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleUrlSubmit();
                  }
                }}
              />
              <Button
                size="lg"
                onClick={handleUrlSubmit}
                disabled={isDownloading || !urlValue.trim()}
                className="shrink-0 gap-1.5"
              >
                {isDownloading ? (
                  <HugeiconsIcon icon={Loading03Icon} className="size-3.5 animate-spin" />
                ) : (
                  <HugeiconsIcon icon={Image01Icon} className="size-3.5" />
                )}
                {isDownloading ? _(msg`Downloading...`) : _(msg`Download`)}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  ) : (
    <div className="space-y-3">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSelectImage}
          className="flex flex-1 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border/50 py-8 text-muted-foreground transition-colors hover:border-border hover:text-foreground"
        >
          <HugeiconsIcon icon={Image01Icon} className="size-8 opacity-50" />
          <span className="text-sm font-medium">{_(msg`Choose File`)}</span>
          <span className="text-xs text-muted-foreground/70">
            {_(msg`PNG, JPG, WebP, GIF, or AVIF`)}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setShowUrlInput(!showUrlInput)}
          className={`flex flex-1 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed py-8 transition-colors ${
            showUrlInput
              ? 'border-primary/50 text-foreground'
              : 'border-border/50 text-muted-foreground hover:border-border hover:text-foreground'
          }`}
        >
          <HugeiconsIcon icon={Link01Icon} className="size-8 opacity-50" />
          <span className="text-sm font-medium">{_(msg`From URL`)}</span>
          <span className="text-xs text-muted-foreground/70">{_(msg`Paste an image link`)}</span>
        </button>
      </div>
      <AnimatePresence>
        {showUrlInput && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="flex gap-2">
              <Input
                type="url"
                value={urlValue}
                onChange={(e) => setUrlValue(e.target.value)}
                placeholder="https://example.com/image.jpg"
                disabled={isDownloading}
                className="flex-1"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleUrlSubmit();
                  }
                }}
              />
              <Button
                size="lg"
                onClick={handleUrlSubmit}
                disabled={isDownloading || !urlValue.trim()}
                className="shrink-0 gap-1.5"
              >
                {isDownloading ? (
                  <HugeiconsIcon icon={Loading03Icon} className="size-3.5 animate-spin" />
                ) : (
                  <HugeiconsIcon icon={Image01Icon} className="size-3.5" />
                )}
                {isDownloading ? _(msg`Downloading...`) : _(msg`Download`)}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
