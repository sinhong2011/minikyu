import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { locale } from '@tauri-apps/plugin-os';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import type { ChineseConversionRule } from '@/lib/tauri-bindings';
import { usePreferences, useSavePreferences } from '@/services/preferences';
import { SettingsField, SettingsSection } from '../shared/SettingsComponents';

const languageNames: Record<string, string> = {
  en: 'English',
  'zh-CN': '简体中文',
  'zh-TW': '繁體中文',
  ja: '日本語',
  ko: '한국어',
};

interface CustomRuleDraft extends ChineseConversionRule {
  id: string;
}

let customRuleDraftId = 0;

function nextCustomRuleDraftId(): string {
  customRuleDraftId += 1;
  return `rule-${customRuleDraftId}`;
}

function normalizeRules(rules: ChineseConversionRule[] | undefined): ChineseConversionRule[] {
  return (rules ?? []).map((rule) => ({
    from: rule.from.trim(),
    to: rule.to.trim(),
  }));
}

function toDraftRules(rules: ChineseConversionRule[] | undefined): CustomRuleDraft[] {
  return (rules ?? []).map((rule) => ({
    id: nextCustomRuleDraftId(),
    from: rule.from,
    to: rule.to,
  }));
}

export function AppearancePane() {
  const { _ } = useLingui();
  const { theme, setTheme } = useTheme();
  const { data: preferences } = usePreferences();
  const savePreferences = useSavePreferences();
  const [customRulesDraft, setCustomRulesDraft] = useState<CustomRuleDraft[]>([]);

  const persistedRules = useMemo(
    () => normalizeRules(preferences?.reader_custom_conversions),
    [preferences?.reader_custom_conversions]
  );

  const normalizedDraftRules = useMemo(() => normalizeRules(customRulesDraft), [customRulesDraft]);

  const hasInvalidCustomRules = useMemo(
    () => normalizedDraftRules.some((rule) => rule.from.length === 0),
    [normalizedDraftRules]
  );

  const hasRuleChanges = useMemo(
    () => JSON.stringify(normalizedDraftRules) !== JSON.stringify(persistedRules),
    [normalizedDraftRules, persistedRules]
  );

  useEffect(() => {
    setCustomRulesDraft(toDraftRules(preferences?.reader_custom_conversions));
  }, [preferences?.reader_custom_conversions]);

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

  const updateCustomRule = (ruleId: string, patch: Partial<ChineseConversionRule>) => {
    setCustomRulesDraft((current) =>
      current.map((rule) => (rule.id === ruleId ? { ...rule, ...patch } : rule))
    );
  };

  const addCustomRule = () => {
    setCustomRulesDraft((current) => [
      ...current,
      { id: nextCustomRuleDraftId(), from: '', to: '' },
    ]);
  };

  const removeCustomRule = (ruleId: string) => {
    setCustomRulesDraft((current) => current.filter((rule) => rule.id !== ruleId));
  };

  const resetCustomRules = () => {
    setCustomRulesDraft(toDraftRules(preferences?.reader_custom_conversions));
  };

  const saveCustomRules = async () => {
    if (!preferences || hasInvalidCustomRules) return;
    await savePreferences.mutateAsync({
      ...preferences,
      // biome-ignore lint/style/useNamingConvention: preferences field name
      reader_custom_conversions: normalizedDraftRules,
    });
  };

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

      <SettingsSection title={_(msg`Chinese Conversion`)}>
        <SettingsField
          label={_(msg`Custom Term Conversion`)}
          description={_(
            msg`These replacements are applied after built-in Chinese conversion in the reading panel.`
          )}
        >
          <div className="space-y-2">
            {customRulesDraft.length === 0 && (
              <p className="text-sm text-muted-foreground">{_(msg`No custom rules yet`)}</p>
            )}

            {customRulesDraft.map((rule) => (
              <div key={rule.id} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                <Input
                  value={rule.from}
                  placeholder={_(msg`From`)}
                  onChange={(event) => updateCustomRule(rule.id, { from: event.target.value })}
                  disabled={savePreferences.isPending}
                />
                <Input
                  value={rule.to}
                  placeholder={_(msg`To`)}
                  onChange={(event) => updateCustomRule(rule.id, { to: event.target.value })}
                  disabled={savePreferences.isPending}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => removeCustomRule(rule.id)}
                  disabled={savePreferences.isPending}
                >
                  {_(msg`Remove`)}
                </Button>
              </div>
            ))}

            {hasInvalidCustomRules && (
              <p className="text-sm text-destructive">
                {_(msg`Each rule must include a non-empty "From" value`)}
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={addCustomRule}
                disabled={savePreferences.isPending}
              >
                {_(msg`Add Rule`)}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={resetCustomRules}
                disabled={savePreferences.isPending || !hasRuleChanges}
              >
                {_(msg`Reset`)}
              </Button>
              <Button
                type="button"
                onClick={() => void saveCustomRules()}
                disabled={
                  savePreferences.isPending ||
                  hasInvalidCustomRules ||
                  !hasRuleChanges ||
                  !preferences
                }
              >
                {savePreferences.isPending ? _(msg`Saving...`) : _(msg`Save Rules`)}
              </Button>
            </div>
          </div>
        </SettingsField>
      </SettingsSection>
    </div>
  );
}
