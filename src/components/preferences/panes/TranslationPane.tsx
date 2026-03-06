import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ArrowDown01Icon,
  ArrowUp01Icon,
  Cancel01Icon,
  Globe02Icon,
  InformationCircleIcon,
  Key01Icon,
  Link02Icon,
  Refresh04Icon,
  RssIcon,
  Settings01Icon,
  Sorting01Icon,
  Tick01Icon,
  ZapIcon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { AnimatePresence, motion } from 'motion/react';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { Switch } from '@/components/animate-ui/components/base/switch';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox';
import { Input } from '@/components/ui/input';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { showToast } from '@/components/ui/sonner';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipPanel, TooltipTrigger } from '@/components/ui/tooltip';
import {
  type ChineseConversionRule,
  commands,
  type ReaderTranslationProviderSettings,
  type ReaderTranslationRouteMode,
  type TranslationSegmentRequest,
} from '@/lib/tauri-bindings';
import { cn } from '@/lib/utils';
import { useCategories } from '@/services/miniflux/categories';
import { useFeeds } from '@/services/miniflux/feeds';
import { usePreferences, useSavePreferences } from '@/services/preferences';
import { SettingsField, SettingsSection } from '../shared/SettingsComponents';

interface TranslationProviderDefinition {
  id: string;
  kind: 'engine' | 'llm';
}

type TranslationProviderKind = TranslationProviderDefinition['kind'];

const TRANSLATION_PROFILE = 'default';

const TRANSLATION_PROVIDERS: readonly TranslationProviderDefinition[] = [
  { id: 'deepl', kind: 'engine' },
  { id: 'google_translate', kind: 'engine' },
  { id: 'microsoft_translator', kind: 'engine' },
  { id: 'qwen_mt', kind: 'engine' },
  { id: 'hunyuan_mt', kind: 'engine' },
  { id: 'baidu_translate', kind: 'engine' },
  { id: 'openai', kind: 'llm' },
  { id: 'ollama', kind: 'llm' },
  { id: 'anthropic', kind: 'llm' },
  { id: 'gemini', kind: 'llm' },
  { id: 'openrouter', kind: 'llm' },
  { id: 'glm', kind: 'llm' },
  { id: 'kimi', kind: 'llm' },
  { id: 'minimax', kind: 'llm' },
  { id: 'qwen', kind: 'llm' },
  { id: 'deepseek', kind: 'llm' },
];

const DEFAULT_ENGINE_PROVIDER_IDS = TRANSLATION_PROVIDERS.filter(
  (provider) => provider.kind === 'engine'
).map((provider) => provider.id);

const DEFAULT_LLM_PROVIDER_IDS = TRANSLATION_PROVIDERS.filter(
  (provider) => provider.kind === 'llm'
).map((provider) => provider.id);

const PROVIDER_ENDPOINT_PLACEHOLDERS: Readonly<Record<string, string>> = {
  deepl: 'https://api-free.deepl.com/v2',
  // biome-ignore lint/style/useNamingConvention: provider ID from backend
  google_translate: 'https://translation.googleapis.com',
  ollama: 'http://localhost:11434',
  openai: 'https://api.openai.com',
  anthropic: 'https://api.anthropic.com',
  gemini: 'https://generativelanguage.googleapis.com',
  openrouter: 'https://openrouter.ai',
  glm: 'https://open.bigmodel.cn/api/paas/v4',
  kimi: 'https://api.moonshot.cn',
  minimax: 'https://api.minimax.io',
  qwen: 'https://dashscope.aliyuncs.com/compatible-mode',
  deepseek: 'https://api.deepseek.com',
};

type ProviderIconSpec = {
  icon: IconSvgElement;
  className: string;
};

const DEFAULT_PROVIDER_ICON: ProviderIconSpec = {
  icon: Settings01Icon,
  className: 'bg-muted text-muted-foreground',
};

const PROVIDER_ICON_SPECS: Readonly<Record<string, ProviderIconSpec>> = {
  deepl: {
    icon: Link02Icon,
    className: 'bg-blue-500/20 text-blue-600 dark:text-blue-300',
  },
  // biome-ignore lint/style/useNamingConvention: provider ID from backend
  google_translate: {
    icon: Globe02Icon,
    className: 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-300',
  },
  // biome-ignore lint/style/useNamingConvention: provider ID from backend
  microsoft_translator: {
    icon: Globe02Icon,
    className: 'bg-cyan-500/20 text-cyan-600 dark:text-cyan-300',
  },
  // biome-ignore lint/style/useNamingConvention: provider ID from backend
  qwen_mt: {
    icon: RssIcon,
    className: 'bg-violet-500/20 text-violet-600 dark:text-violet-300',
  },
  // biome-ignore lint/style/useNamingConvention: provider ID from backend
  hunyuan_mt: {
    icon: RssIcon,
    className: 'bg-fuchsia-500/20 text-fuchsia-600 dark:text-fuchsia-300',
  },
  // biome-ignore lint/style/useNamingConvention: provider ID from backend
  baidu_translate: {
    icon: RssIcon,
    className: 'bg-orange-500/20 text-orange-600 dark:text-orange-300',
  },
  openai: {
    icon: ZapIcon,
    className: 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-300',
  },
  ollama: {
    icon: ZapIcon,
    className: 'bg-slate-500/20 text-slate-600 dark:text-slate-300',
  },
  anthropic: {
    icon: ZapIcon,
    className: 'bg-amber-500/20 text-amber-600 dark:text-amber-300',
  },
  gemini: {
    icon: ZapIcon,
    className: 'bg-indigo-500/20 text-indigo-600 dark:text-indigo-300',
  },
  openrouter: {
    icon: Globe02Icon,
    className: 'bg-sky-500/20 text-sky-600 dark:text-sky-300',
  },
  glm: {
    icon: Key01Icon,
    className: 'bg-pink-500/20 text-pink-600 dark:text-pink-300',
  },
  kimi: {
    icon: Key01Icon,
    className: 'bg-rose-500/20 text-rose-600 dark:text-rose-300',
  },
  minimax: {
    icon: Key01Icon,
    className: 'bg-lime-500/20 text-lime-600 dark:text-lime-300',
  },
  qwen: {
    icon: Key01Icon,
    className: 'bg-purple-500/20 text-purple-600 dark:text-purple-300',
  },
  deepseek: {
    icon: Key01Icon,
    className: 'bg-teal-500/20 text-teal-600 dark:text-teal-300',
  },
};

function mergeProviderOrder(defaultOrder: string[], configuredOrder: string[]): string[] {
  const knownIds = new Set(defaultOrder);
  const merged: string[] = [];
  const seen = new Set<string>();

  for (const providerId of configuredOrder) {
    const normalized = providerId.trim();
    if (!normalized || !knownIds.has(normalized) || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    merged.push(normalized);
  }

  for (const providerId of defaultOrder) {
    if (seen.has(providerId)) {
      continue;
    }
    seen.add(providerId);
    merged.push(providerId);
  }

  return merged;
}

function reorderProviderIds(order: string[], sourceId: string, targetId: string): string[] {
  const sourceIndex = order.indexOf(sourceId);
  const targetIndex = order.indexOf(targetId);
  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) {
    return order;
  }

  const nextOrder = [...order];
  const [movedId] = nextOrder.splice(sourceIndex, 1);
  if (!movedId) {
    return order;
  }
  nextOrder.splice(targetIndex, 0, movedId);
  return nextOrder;
}

function getProviderEndpointPlaceholder(providerId: string): string | null {
  return PROVIDER_ENDPOINT_PLACEHOLDERS[providerId] ?? null;
}

function getProviderIconSpec(providerId: string): ProviderIconSpec {
  return PROVIDER_ICON_SPECS[providerId] ?? DEFAULT_PROVIDER_ICON;
}

function providerRequiresApiKey(providerId: string): boolean {
  return providerId !== 'ollama';
}

function providerAcceptsOptionalApiKey(providerId: string): boolean {
  return providerId === 'ollama';
}

function ProviderIconBadge({ providerId, className }: { providerId: string; className?: string }) {
  const [imageFailed, setImageFailed] = useState(false);
  const providerIconSpec = getProviderIconSpec(providerId);

  return (
    <span
      className={`inline-flex items-center justify-center rounded-md ${providerIconSpec.className} ${className ?? ''}`}
    >
      {imageFailed ? (
        <HugeiconsIcon icon={providerIconSpec.icon} className="size-4" />
      ) : (
        <img
          src={`/provider-icons/${providerId}.ico`}
          alt=""
          className="size-4 rounded-[3px] object-contain"
          onError={() => setImageFailed(true)}
        />
      )}
    </span>
  );
}

type ProviderRuntimeInputState = {
  baseUrl: string;
  model: string;
  timeoutMs: string;
  systemPrompt: string;
};

function toRuntimeInputState(
  settings: ReaderTranslationProviderSettings | undefined
): ProviderRuntimeInputState {
  return {
    baseUrl: settings?.base_url ?? '',
    model: settings?.model ?? '',
    timeoutMs: settings?.timeout_ms ? String(settings.timeout_ms) : '',
    systemPrompt: settings?.system_prompt ?? '',
  };
}

function ModelSuggestionList({
  models,
  query,
  onSelect,
  visible,
  onHide,
  selectingRef,
}: {
  models: string[];
  query: string;
  onSelect: (model: string) => void;
  visible: boolean;
  onHide: () => void;
  selectingRef: React.RefObject<boolean>;
}) {
  const q = query.toLowerCase();
  const filtered =
    models.length === 0 ? [] : q ? models.filter((m) => m.toLowerCase().includes(q)) : models;

  const showList =
    visible && filtered.length > 0 && !(filtered.length === 1 && filtered[0] === query);

  return (
    <AnimatePresence>
      {showList && (
        <motion.div
          initial={{ opacity: 0, y: -4, scaleY: 0.95 }}
          animate={{ opacity: 1, y: 0, scaleY: 1 }}
          exit={{ opacity: 0, y: -4, scaleY: 0.95 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          style={{ originY: 0 }}
          className="absolute left-0 right-0 z-50 mt-1 max-h-48 overflow-y-auto rounded-md border bg-popover/65 p-1 shadow-md backdrop-blur-2xl backdrop-saturate-150"
          onMouseDown={() => {
            selectingRef.current = true;
          }}
        >
          {filtered.map((modelName) => (
            <button
              key={modelName}
              type="button"
              className={cn(
                'relative flex w-full items-center rounded-sm py-1.5 pr-8 pl-2 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground',
                modelName === query && 'font-medium text-foreground bg-accent/50'
              )}
              onClick={() => {
                selectingRef.current = false;
                onSelect(modelName);
                onHide();
              }}
            >
              {modelName}
              {modelName === query && (
                <span className="absolute right-2 flex size-4 items-center justify-center">
                  <HugeiconsIcon icon={Tick01Icon} className="size-4 text-primary" />
                </span>
              )}
            </button>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface SettingsRowProps {
  children: ReactNode;
  description?: string;
  htmlFor?: string;
  label: string;
}

function SettingsRow({ children, description, htmlFor, label }: SettingsRowProps) {
  return (
    <div className="grid gap-3 md:grid-cols-[220px_minmax(0,1fr)] md:items-start">
      <div className="flex items-center gap-1.5 pt-0.5">
        <Label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
          {label}
        </Label>
        {description ? (
          <Tooltip delay={300}>
            <TooltipTrigger
              aria-label="More information"
              className="inline-flex shrink-0 cursor-default text-muted-foreground/50 transition-colors hover:text-muted-foreground"
            >
              <HugeiconsIcon icon={InformationCircleIcon} className="size-3.5" />
            </TooltipTrigger>
            <TooltipPanel className="max-w-xs text-balance">{description}</TooltipPanel>
          </Tooltip>
        ) : null}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

interface SortableProviderRowProps {
  enableLabel: string;
  kind: TranslationProviderKind;
  issueLabel: string;
  missingRequiredFields: string[];
  onSelect: () => void;
  onToggleEnabled: (enabled: boolean) => void;
  providerId: string;
  providerName: string;
  rowDragLabel: string;
  runtimeEnabled: boolean;
  selected: boolean;
}

function SortableProviderRow({
  enableLabel,
  kind,
  issueLabel,
  missingRequiredFields,
  onSelect,
  onToggleEnabled,
  providerId,
  providerName,
  rowDragLabel,
  runtimeEnabled,
  selected,
}: SortableProviderRowProps) {
  const { _ } = useLingui();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: providerId,
    data: {
      kind,
    },
    transition: {
      duration: 280,
      easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
    },
  });

  const cardClassName = selected
    ? 'border-border bg-muted/60'
    : 'border-border/40 bg-muted/20 hover:bg-muted/40';
  const hasMissingRequiredFields = runtimeEnabled && missingRequiredFields.length > 0;

  return (
    <motion.div
      layout="position"
      transition={{
        type: 'spring',
        stiffness: 420,
        damping: 36,
        mass: 0.72,
      }}
    >
      <div
        ref={setNodeRef}
        style={{
          transform: CSS.Transform.toString(transform),
          transition,
        }}
        className={`group relative overflow-hidden rounded-xl border p-2.5 transition-colors duration-200 ${cardClassName} ${
          isDragging ? 'z-10 ring-1 ring-primary/35 shadow-lg' : ''
        }`}
        data-testid={`translation-provider-row-${providerId}`}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-background/20 to-transparent" />

        <div className="relative flex items-center justify-between gap-2 pr-3">
          <div className="flex min-w-0 flex-1 items-start gap-2.5">
            <button
              type="button"
              className="flex min-w-0 flex-1 items-start gap-2 text-left"
              onClick={onSelect}
            >
              <ProviderIconBadge
                providerId={providerId}
                className="mt-0.5 size-8 shrink-0 rounded-lg"
              />
              <div className="min-w-0">
                <p className="truncate text-sm leading-tight font-semibold">{providerName}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  {hasMissingRequiredFields ? (
                    <span
                      className="inline-flex items-center rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300"
                      data-testid={`translation-provider-missing-${providerId}`}
                      title={`${issueLabel}: ${missingRequiredFields.join(', ')}`}
                    >
                      {issueLabel}
                    </span>
                  ) : (
                    <span className="text-[11px] text-muted-foreground/70">
                      {kind === 'llm' ? _(msg`LLM`) : _(msg`Engine`)}
                    </span>
                  )}
                </div>
              </div>
            </button>
          </div>
          <div className="flex items-center gap-1.5">
            <Switch
              checked={runtimeEnabled}
              onCheckedChange={(checked) => onToggleEnabled(Boolean(checked))}
              aria-label={enableLabel}
            />
          </div>
        </div>

        <button
          type="button"
          className="absolute inset-y-0 right-0 inline-flex w-4 touch-none cursor-grab items-center justify-center border-l border-border/40 px-1 text-muted-foreground/50 transition-colors hover:bg-muted/40 hover:text-foreground active:cursor-grabbing"
          aria-label={rowDragLabel}
          {...attributes}
          {...listeners}
        >
          <span className="grid grid-cols-2 gap-[2px]">
            <span className="size-[2.5px] rounded-full bg-current opacity-70" />
            <span className="size-[2.5px] rounded-full bg-current opacity-70" />
            <span className="size-[2.5px] rounded-full bg-current opacity-70" />
            <span className="size-[2.5px] rounded-full bg-current opacity-70" />
            <span className="size-[2.5px] rounded-full bg-current opacity-70" />
            <span className="size-[2.5px] rounded-full bg-current opacity-70" />
          </span>
        </button>
      </div>
    </motion.div>
  );
}

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

export function TranslationPane() {
  const { _ } = useLingui();
  const { data: preferences } = usePreferences();
  const savePreferences = useSavePreferences();
  const [providerKeyInputs, setProviderKeyInputs] = useState<Record<string, string>>({});
  const [providerRuntimeInputs, setProviderRuntimeInputs] = useState<
    Record<string, ProviderRuntimeInputState>
  >({});
  const [providerKeyStatus, setProviderKeyStatus] = useState<Record<string, boolean>>({});
  const [providerOrder, setProviderOrder] = useState<Record<TranslationProviderKind, string[]>>({
    engine: DEFAULT_ENGINE_PROVIDER_IDS,
    llm: DEFAULT_LLM_PROVIDER_IDS,
  });
  const [verifyingProviderId, setVerifyingProviderId] = useState<string | null>(null);
  const [selectedProviderId, setSelectedProviderId] = useState<string>(
    TRANSLATION_PROVIDERS[0]?.id ?? ''
  );
  const [providerAvailableModels, setProviderAvailableModelsRaw] = useState<
    Record<string, string[]>
  >(() => {
    try {
      const stored = localStorage.getItem('translation-provider-models');
      return stored ? (JSON.parse(stored) as Record<string, string[]>) : {};
    } catch {
      return {};
    }
  });
  const setProviderAvailableModels: typeof setProviderAvailableModelsRaw = (action) => {
    setProviderAvailableModelsRaw((previous) => {
      const next = typeof action === 'function' ? action(previous) : action;
      try {
        localStorage.setItem('translation-provider-models', JSON.stringify(next));
      } catch {
        // Ignore storage errors
      }
      return next;
    });
  };
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [summaryModelInput, setSummaryModelInput] = useState(preferences?.ai_summary_model ?? '');
  const [summaryAvailableModels, setSummaryAvailableModels] = useState<string[] | null>(null);
  const [isFetchingSummaryModels, setIsFetchingSummaryModels] = useState(false);
  const [providerModelFocused, setProviderModelFocused] = useState(false);
  const [summaryModelFocused, setSummaryModelFocused] = useState(false);
  const providerModelSelectingRef = useRef(false);
  const summaryModelSelectingRef = useRef(false);
  const didHydrateProviderOrder = useRef(false);

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

  const translationEngines = useMemo(
    () => TRANSLATION_PROVIDERS.filter((provider) => provider.kind === 'engine'),
    []
  );
  const llmProviders = useMemo(
    () => TRANSLATION_PROVIDERS.filter((provider) => provider.kind === 'llm'),
    []
  );
  const allProviders = useMemo(
    () => [...translationEngines, ...llmProviders],
    [translationEngines, llmProviders]
  );
  const providerMap = useMemo(
    () =>
      new Map(
        allProviders.map((provider): [string, TranslationProviderDefinition] => [
          provider.id,
          provider,
        ])
      ),
    [allProviders]
  );
  const chineseConversionEnabled =
    preferences?.reader_chinese_conversion != null &&
    preferences.reader_chinese_conversion !== 'off';

  const dndSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 2 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    setSummaryModelInput(preferences?.ai_summary_model ?? '');
  }, [preferences?.ai_summary_model]);

  useEffect(() => {
    setCustomRulesDraft(toDraftRules(preferences?.reader_custom_conversions));
  }, [preferences?.reader_custom_conversions]);

  useEffect(() => {
    const nextRuntimeInputs: Record<string, ProviderRuntimeInputState> = {};
    const providerSettings = preferences?.reader_translation_provider_settings ?? {};
    for (const provider of TRANSLATION_PROVIDERS) {
      nextRuntimeInputs[provider.id] = toRuntimeInputState(providerSettings[provider.id]);
    }
    setProviderRuntimeInputs(nextRuntimeInputs);
  }, [preferences]);

  useEffect(() => {
    const engineConfiguredOrder = [
      preferences?.reader_translation_primary_engine ?? '',
      ...(preferences?.reader_translation_engine_fallbacks ?? []),
    ];
    const llmConfiguredOrder = preferences?.reader_translation_llm_fallbacks ?? [];

    if (!didHydrateProviderOrder.current) {
      setProviderOrder({
        engine: mergeProviderOrder(DEFAULT_ENGINE_PROVIDER_IDS, engineConfiguredOrder),
        llm: mergeProviderOrder(DEFAULT_LLM_PROVIDER_IDS, llmConfiguredOrder),
      });
      didHydrateProviderOrder.current = true;
      return;
    }

    // Keep local order stable after initial hydration; only append newly added provider IDs.
    setProviderOrder((previous) => ({
      engine: mergeProviderOrder(DEFAULT_ENGINE_PROVIDER_IDS, previous.engine),
      llm: mergeProviderOrder(DEFAULT_LLM_PROVIDER_IDS, previous.llm),
    }));
  }, [
    preferences?.reader_translation_engine_fallbacks,
    preferences?.reader_translation_llm_fallbacks,
    preferences?.reader_translation_primary_engine,
  ]);

  useEffect(() => {
    const orderedProviderIds = [...providerOrder.engine, ...providerOrder.llm];
    const selectedProviderExists = orderedProviderIds.includes(selectedProviderId);
    if (!selectedProviderExists) {
      setSelectedProviderId(orderedProviderIds[0] ?? '');
    }
  }, [providerOrder, selectedProviderId]);

  const getProviderLabel = (providerId: string) => {
    switch (providerId) {
      case 'deepl':
        return _(msg`DeepL`);
      case 'google_translate':
        return _(msg`Google Translate`);
      case 'microsoft_translator':
        return _(msg`Microsoft Translator`);
      case 'qwen_mt':
        return _(msg`Qwen-MT`);
      case 'hunyuan_mt':
        return _(msg`Hunyuan-MT`);
      case 'baidu_translate':
        return _(msg`Baidu Translate`);
      case 'openai':
        return _(msg`OpenAI`);
      case 'ollama':
        return _(msg`Ollama`);
      case 'anthropic':
        return _(msg`Anthropic`);
      case 'gemini':
        return _(msg`Gemini`);
      case 'openrouter':
        return _(msg`OpenRouter`);
      case 'glm':
        return _(msg`GLM`);
      case 'kimi':
        return _(msg`Kimi`);
      case 'minimax':
        return _(msg`MiniMax`);
      case 'qwen':
        return _(msg`Qwen`);
      case 'deepseek':
        return _(msg`DeepSeek`);
      default:
        return providerId;
    }
  };

  const savePreferencePatch = async (patch: Record<string, unknown>) => {
    if (!preferences) return;

    await savePreferences.mutateAsync({
      ...preferences,
      ...patch,
    });
  };

  const isProviderEnabled = (
    provider: TranslationProviderDefinition,
    settingsMap?: Partial<Record<string, ReaderTranslationProviderSettings>>
  ) => {
    if (!preferences) return false;

    const providerSettings = settingsMap ?? preferences.reader_translation_provider_settings ?? {};
    const explicitEnabled = providerSettings[provider.id]?.enabled;
    if (typeof explicitEnabled === 'boolean') {
      return explicitEnabled;
    }

    if (provider.kind === 'engine') {
      return (
        preferences.reader_translation_primary_engine === provider.id ||
        (preferences.reader_translation_engine_fallbacks ?? []).includes(provider.id)
      );
    }

    return (preferences.reader_translation_llm_fallbacks ?? []).includes(provider.id);
  };

  const getProviderRuntimeSettings = (
    provider: TranslationProviderDefinition
  ): ReaderTranslationProviderSettings => {
    const existingSettings = preferences?.reader_translation_provider_settings?.[provider.id];
    const fallbackEnabled = isProviderEnabled(provider);

    return {
      enabled: existingSettings?.enabled ?? fallbackEnabled,
      // biome-ignore lint/style/useNamingConvention: backend preference field name
      base_url: existingSettings?.base_url ?? null,
      model: existingSettings?.model ?? null,
      // biome-ignore lint/style/useNamingConvention: backend preference field name
      timeout_ms: existingSettings?.timeout_ms ?? null,
      // biome-ignore lint/style/useNamingConvention: backend preference field name
      system_prompt: existingSettings?.system_prompt ?? null,
    };
  };

  const buildRoutingPatch = (
    settingsMap: Partial<Record<string, ReaderTranslationProviderSettings>>,
    order = providerOrder
  ) => {
    const enabledEngineIds = order.engine.filter((providerId) => {
      const provider = providerMap.get(providerId);
      return provider ? isProviderEnabled(provider, settingsMap) : false;
    });
    const enabledLlmIds = order.llm.filter((providerId) => {
      const provider = providerMap.get(providerId);
      return provider ? isProviderEnabled(provider, settingsMap) : false;
    });

    return {
      // biome-ignore lint/style/useNamingConvention: preferences field name
      reader_translation_primary_engine: enabledEngineIds[0] ?? null,
      // biome-ignore lint/style/useNamingConvention: preferences field name
      reader_translation_engine_fallbacks: enabledEngineIds.slice(1),
      // biome-ignore lint/style/useNamingConvention: preferences field name
      reader_translation_llm_fallbacks: enabledLlmIds,
    };
  };

  const saveProviderRuntimeSettings = async (
    provider: TranslationProviderDefinition,
    patch: Partial<ReaderTranslationProviderSettings>
  ) => {
    if (!preferences) {
      return;
    }

    const currentSettings = getProviderRuntimeSettings(provider);
    const nextSettings: ReaderTranslationProviderSettings = {
      ...currentSettings,
      ...patch,
    };
    const currentMap = preferences.reader_translation_provider_settings ?? {};
    const nextMap = {
      ...currentMap,
      [provider.id]: nextSettings,
    };

    await savePreferencePatch({
      // biome-ignore lint/style/useNamingConvention: preferences field name
      reader_translation_provider_settings: nextMap,
      ...buildRoutingPatch(nextMap),
    });
  };

  const refreshProviderStatus = async (providerId: string) => {
    if (!providerRequiresApiKey(providerId) && !providerAcceptsOptionalApiKey(providerId)) {
      setProviderKeyStatus((previous) => ({ ...previous, [providerId]: true }));
      return;
    }

    const result = await commands.getTranslationProviderKeyStatus(providerId, TRANSLATION_PROFILE);
    setProviderKeyStatus((previous) => ({
      ...previous,
      [providerId]: result.status === 'ok' ? result.data : false,
    }));
  };

  useEffect(() => {
    let cancelled = false;

    const loadProviderStatuses = async () => {
      const entries = await Promise.all(
        TRANSLATION_PROVIDERS.map(async (provider) => {
          if (!providerRequiresApiKey(provider.id) && !providerAcceptsOptionalApiKey(provider.id)) {
            return [provider.id, true] as const;
          }

          const result = await commands.getTranslationProviderKeyStatus(
            provider.id,
            TRANSLATION_PROFILE
          );
          return [provider.id, result.status === 'ok' ? result.data : false] as const;
        })
      );

      if (cancelled) return;
      setProviderKeyStatus(Object.fromEntries(entries));
    };

    void loadProviderStatuses();

    return () => {
      cancelled = true;
    };
  }, []);

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

  const handleRouteModeChange = async (value: string) => {
    if (!preferences) return;

    try {
      await savePreferencePatch({
        // biome-ignore lint/style/useNamingConvention: preferences field name
        reader_translation_route_mode: value as ReaderTranslationRouteMode,
      });
      showToast.success(_(msg`Translation route mode updated`));
    } catch {
      showToast.error(_(msg`Failed to update translation route mode`));
    }
  };

  const handleTargetLanguageChange = async (value: string) => {
    if (!preferences) return;

    try {
      await savePreferencePatch({
        // biome-ignore lint/style/useNamingConvention: preferences field name
        reader_translation_target_language: value,
      });
      showToast.success(_(msg`Translation target language updated`));
    } catch {
      showToast.error(_(msg`Failed to update translation target language`));
    }
  };

  const handleProviderDrop = async (
    kind: TranslationProviderKind,
    sourceId: string,
    targetId: string
  ) => {
    if (!preferences) {
      return;
    }

    const currentOrder = providerOrder[kind];
    const nextOrder = reorderProviderIds(currentOrder, sourceId, targetId);
    if (nextOrder === currentOrder) {
      return;
    }

    const nextProviderOrder = {
      ...providerOrder,
      [kind]: nextOrder,
    };

    setProviderOrder(nextProviderOrder);

    try {
      const settingsMap = preferences.reader_translation_provider_settings ?? {};
      await savePreferencePatch(buildRoutingPatch(settingsMap, nextProviderOrder));
      showToast.success(_(msg`Provider order updated`));
    } catch {
      showToast.error(_(msg`Failed to update provider order`));
    }
  };

  const handleProviderDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) {
      return;
    }

    const sourceId = String(active.id);
    const targetId = String(over.id);
    if (sourceId === targetId) {
      return;
    }

    const sourceProvider = providerMap.get(sourceId);
    const targetProvider = providerMap.get(targetId);
    if (!sourceProvider || !targetProvider || sourceProvider.kind !== targetProvider.kind) {
      return;
    }

    void handleProviderDrop(sourceProvider.kind, sourceId, targetId);
  };

  const handleResortProviders = async () => {
    if (!preferences) {
      return;
    }

    const settingsMap = preferences.reader_translation_provider_settings ?? {};
    const reorderByEnabled = (kind: TranslationProviderKind) => {
      const enabledIds: string[] = [];
      const disabledIds: string[] = [];

      for (const providerId of providerOrder[kind]) {
        const provider = providerMap.get(providerId);
        if (!provider) {
          continue;
        }

        if (isProviderEnabled(provider, settingsMap)) {
          enabledIds.push(providerId);
        } else {
          disabledIds.push(providerId);
        }
      }

      return [...enabledIds, ...disabledIds];
    };

    const nextProviderOrder = {
      engine: reorderByEnabled('engine'),
      llm: reorderByEnabled('llm'),
    };
    const unchanged =
      nextProviderOrder.engine.join(',') === providerOrder.engine.join(',') &&
      nextProviderOrder.llm.join(',') === providerOrder.llm.join(',');
    if (unchanged) {
      return;
    }

    setProviderOrder(nextProviderOrder);

    try {
      await savePreferencePatch(buildRoutingPatch(settingsMap, nextProviderOrder));
      showToast.success(_(msg`Providers resorted`));
    } catch {
      showToast.error(_(msg`Failed to resort providers`));
    }
  };

  const handleProviderKeyBlur = async (providerId: string): Promise<boolean> => {
    const apiKey = providerKeyInputs[providerId]?.trim();
    if (!apiKey) {
      return true;
    }

    const result = await commands.saveTranslationProviderKey(
      providerId,
      TRANSLATION_PROFILE,
      apiKey
    );

    if (result.status === 'error') {
      showToast.error(_(msg`Failed to save provider key`), result.error);
      return false;
    }

    setProviderKeyInputs((previous) => ({ ...previous, [providerId]: '' }));
    await refreshProviderStatus(providerId);
    showToast.success(_(msg`Provider key saved`), getProviderLabel(providerId));
    return true;
  };

  const handleProviderEnabledChange = async (
    provider: TranslationProviderDefinition,
    enabled: boolean
  ) => {
    try {
      await saveProviderRuntimeSettings(provider, { enabled });
      showToast.success(_(msg`Provider runtime setting updated`), getProviderLabel(provider.id));
    } catch {
      showToast.error(
        _(msg`Failed to update provider runtime setting`),
        getProviderLabel(provider.id)
      );
    }
  };

  const handleProviderRuntimeBlur = async (
    provider: TranslationProviderDefinition
  ): Promise<boolean> => {
    const input = providerRuntimeInputs[provider.id] ?? {
      baseUrl: '',
      model: '',
      timeoutMs: '',
      systemPrompt: '',
    };
    const timeoutValue = input.timeoutMs.trim();
    const parsedTimeout = timeoutValue.length > 0 ? Number(timeoutValue) : null;
    const isTimeoutInvalid =
      parsedTimeout !== null && (!Number.isFinite(parsedTimeout) || parsedTimeout <= 0);
    if (isTimeoutInvalid) {
      showToast.error(_(msg`Timeout must be a positive number`));
      return false;
    }

    try {
      await saveProviderRuntimeSettings(provider, {
        // biome-ignore lint/style/useNamingConvention: backend preference field name
        base_url: input.baseUrl.trim().length > 0 ? input.baseUrl.trim() : null,
        model: input.model.trim().length > 0 ? input.model.trim() : null,
        // biome-ignore lint/style/useNamingConvention: backend preference field name
        timeout_ms: parsedTimeout === null ? null : Math.round(parsedTimeout),
        // biome-ignore lint/style/useNamingConvention: backend preference field name
        system_prompt: input.systemPrompt.trim().length > 0 ? input.systemPrompt.trim() : null,
      });
    } catch {
      showToast.error(
        _(msg`Failed to update provider runtime setting`),
        getProviderLabel(provider.id)
      );
      return false;
    }

    return true;
  };

  const getModelsCacheKey = (providerId: string) => {
    const endpoint = providerRuntimeInputs[providerId]?.baseUrl?.trim() ?? '';
    return `${providerId}:${endpoint}`;
  };

  const handleFetchModels = async (providerId: string) => {
    setIsFetchingModels(true);
    try {
      const result = await commands.getProviderAvailableModels(providerId);
      if (result.status === 'error') {
        showToast.error(_(msg`Failed to fetch available models`), result.error);
        return;
      }
      const cacheKey = getModelsCacheKey(providerId);
      setProviderAvailableModels((previous) => ({
        ...previous,
        [cacheKey]: result.data,
      }));
      if (result.data.length === 0) {
        showToast.info(_(msg`No models found for this provider`));
      }
    } finally {
      setIsFetchingModels(false);
    }
  };

  const handleFetchSummaryModels = async () => {
    const providerId = preferences?.ai_summary_provider;
    if (!providerId) return;
    setIsFetchingSummaryModels(true);
    try {
      const result = await commands.getProviderAvailableModels(providerId);
      if (result.status === 'error') {
        showToast.error(_(msg`Failed to fetch available models`), result.error);
        return;
      }
      setSummaryAvailableModels(result.data);
      if (result.data.length === 0) {
        showToast.info(_(msg`No models found for this provider`));
      }
    } finally {
      setIsFetchingSummaryModels(false);
    }
  };

  const handleVerifyProvider = async (provider: TranslationProviderDefinition) => {
    const runtimeSaved = await handleProviderRuntimeBlur(provider);
    if (!runtimeSaved) {
      return;
    }
    const keyInputValue = providerKeyInputs[provider.id]?.trim() ?? '';
    let keySaved = false;
    let hasProviderKey = !providerRequiresApiKey(provider.id);
    if (providerRequiresApiKey(provider.id)) {
      keySaved = await handleProviderKeyBlur(provider.id);
      if (!keySaved) {
        return;
      }

      if (keyInputValue.length > 0) {
        hasProviderKey = true;
      } else {
        const keyStatusResult = await commands.getTranslationProviderKeyStatus(
          provider.id,
          TRANSLATION_PROFILE
        );
        if (keyStatusResult.status === 'error') {
          showToast.error(_(msg`Provider verification failed`), keyStatusResult.error);
          return;
        }
        hasProviderKey = keyStatusResult.data;
        setProviderKeyStatus((previous) => ({ ...previous, [provider.id]: keyStatusResult.data }));
      }
    } else if (providerAcceptsOptionalApiKey(provider.id) && keyInputValue.length > 0) {
      keySaved = await handleProviderKeyBlur(provider.id);
      if (!keySaved) {
        return;
      }
    }

    const missingRequiredFields: string[] = [];
    const runtimeInput =
      providerRuntimeInputs[provider.id] ??
      toRuntimeInputState(getProviderRuntimeSettings(provider));

    if (providerRequiresApiKey(provider.id) && !hasProviderKey) {
      missingRequiredFields.push(_(msg`API key`));
    }
    if (provider.kind === 'llm' && runtimeInput.model.trim().length === 0) {
      missingRequiredFields.push(_(msg`Model`));
    }

    if (missingRequiredFields.length > 0) {
      showToast.error(_(msg`Missing required fields`), missingRequiredFields.join(', '));
      return;
    }

    const targetLanguageRaw = preferences?.reader_translation_target_language?.trim() || 'ja';
    const targetLanguage = targetLanguageRaw.toLowerCase() === 'en' ? 'ja' : targetLanguageRaw;
    const verifyRequest: TranslationSegmentRequest = {
      text: 'Hello world',
      // biome-ignore lint/style/useNamingConvention: Tauri command payload field name
      source_language: 'en',
      // biome-ignore lint/style/useNamingConvention: Tauri command payload field name
      target_language: targetLanguage,
      // biome-ignore lint/style/useNamingConvention: Tauri command payload field name
      route_mode: 'engine_first',
      // biome-ignore lint/style/useNamingConvention: Tauri command payload field name
      primary_engine: provider.kind === 'engine' ? provider.id : null,
      // biome-ignore lint/style/useNamingConvention: Tauri command payload field name
      engine_fallbacks: [],
      // biome-ignore lint/style/useNamingConvention: Tauri command payload field name
      llm_fallbacks: provider.kind === 'llm' ? [provider.id] : [],
      // biome-ignore lint/style/useNamingConvention: Tauri command payload field name
      apple_fallback_enabled: false,
      // biome-ignore lint/style/useNamingConvention: Tauri command payload field name
      forced_provider: null,
    };

    setVerifyingProviderId(provider.id);

    try {
      const result = await commands.translateReaderSegment(verifyRequest);
      if (result.status === 'error') {
        showToast.error(_(msg`Provider verification failed`), result.error);
        return;
      }

      showToast.success(_(msg`Provider verification succeeded`), getProviderLabel(provider.id));
    } finally {
      setVerifyingProviderId((current) => (current === provider.id ? null : current));
    }
  };

  const selectedProvider =
    allProviders.find((provider) => provider.id === selectedProviderId) ?? allProviders[0] ?? null;

  const getProviderDisplayState = (provider: TranslationProviderDefinition) => {
    const requiresApiKey = providerRequiresApiKey(provider.id);
    const acceptsOptionalApiKey = providerAcceptsOptionalApiKey(provider.id);
    const routeEnabled = isProviderEnabled(provider);
    const runtimeSettings = getProviderRuntimeSettings(provider);
    const enabled = runtimeSettings.enabled || routeEnabled;
    const configured = requiresApiKey ? (providerKeyStatus[provider.id] ?? false) : true;
    const providerName = getProviderLabel(provider.id);
    const runtimeInput = providerRuntimeInputs[provider.id] ?? toRuntimeInputState(runtimeSettings);
    const requiredFields =
      provider.kind === 'llm'
        ? requiresApiKey
          ? [_(msg`API key`), _(msg`Model`)]
          : [_(msg`Model`)]
        : [_(msg`API key`)];
    const missingRequiredFields: string[] = [];

    if (enabled && requiresApiKey && !configured) {
      missingRequiredFields.push(_(msg`API key`));
    }
    if (enabled && provider.kind === 'llm' && runtimeInput.model.trim().length === 0) {
      missingRequiredFields.push(_(msg`Model`));
    }

    return {
      acceptsOptionalApiKey,
      configured,
      enabled,
      missingRequiredFields,
      providerName,
      requiredFields,
      requiresApiKey,
      runtimeInput,
      runtimeSettings,
    };
  };
  const selectedProviderDisplay = selectedProvider
    ? getProviderDisplayState(selectedProvider)
    : null;

  return (
    <div className="space-y-6">
      <SettingsSection title={_(msg`Providers`)}>
        <div className="grid gap-3 lg:grid-cols-[260px_minmax(0,1fr)]">
          <div className="overflow-hidden rounded-md border border-border/60">
            <div className="flex items-center justify-between gap-2 border-b border-border/50 px-3 py-2">
              <p className="text-xs font-medium text-muted-foreground">{_(msg`Providers`)}</p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 w-7 rounded-md p-0"
                aria-label={_(msg`Resort providers`)}
                onClick={() => {
                  void handleResortProviders();
                }}
                disabled={!preferences || savePreferences.isPending}
              >
                <HugeiconsIcon icon={Sorting01Icon} className="size-4" />
              </Button>
            </div>
            <DndContext
              sensors={dndSensors}
              collisionDetection={closestCenter}
              onDragEnd={handleProviderDragEnd}
            >
              <div className="max-h-[560px] space-y-3 overflow-y-auto p-2">
                {(['engine', 'llm'] as const).map((kind) => {
                  const orderedIds = providerOrder[kind].filter((providerId) =>
                    providerMap.has(providerId)
                  );

                  return (
                    <div key={kind} className="space-y-1">
                      <p className="px-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                        {kind === 'engine' ? _(msg`Translation engines`) : _(msg`LLM providers`)}
                      </p>
                      <SortableContext items={orderedIds} strategy={verticalListSortingStrategy}>
                        {orderedIds.map((providerId) => {
                          const provider = providerMap.get(providerId);
                          if (!provider) {
                            return null;
                          }

                          const providerDisplay = getProviderDisplayState(provider);
                          const selected = selectedProvider?.id === provider.id;

                          return (
                            <SortableProviderRow
                              key={provider.id}
                              kind={kind}
                              issueLabel={_(msg`Needs setup`)}
                              providerId={provider.id}
                              providerName={providerDisplay.providerName}
                              selected={selected}
                              runtimeEnabled={providerDisplay.runtimeSettings.enabled}
                              missingRequiredFields={providerDisplay.missingRequiredFields}
                              rowDragLabel={_(msg`Reorder ${providerDisplay.providerName}`)}
                              enableLabel={_(msg`Enable ${providerDisplay.providerName}`)}
                              onSelect={() => setSelectedProviderId(provider.id)}
                              onToggleEnabled={(enabled) => {
                                void handleProviderEnabledChange(provider, enabled);
                              }}
                            />
                          );
                        })}
                      </SortableContext>
                    </div>
                  );
                })}
              </div>
            </DndContext>
          </div>

          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3 pb-1">
              {!selectedProvider || !selectedProviderDisplay ? (
                <p className="text-xs font-medium text-muted-foreground">
                  {_(msg`Provider settings`)}
                </p>
              ) : (
                <div className="flex items-center gap-2">
                  <ProviderIconBadge providerId={selectedProvider.id} className="size-6" />
                  <p className="text-base font-semibold">{selectedProviderDisplay.providerName}</p>
                </div>
              )}
              {!selectedProvider || !selectedProviderDisplay ? null : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 shrink-0 rounded-full px-3"
                  onClick={() => {
                    void handleVerifyProvider(selectedProvider);
                  }}
                  disabled={
                    savePreferences.isPending || verifyingProviderId === selectedProvider.id
                  }
                >
                  {verifyingProviderId === selectedProvider.id
                    ? _(msg`Verifying...`)
                    : _(msg`Verify`)}
                </Button>
              )}
            </div>
            {!selectedProvider || !selectedProviderDisplay ? null : (
              <div className="space-y-4">
                <div className="rounded-lg border border-border bg-muted/30 p-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className={
                        selectedProviderDisplay.enabled
                          ? 'rounded px-2 py-0.5 text-xs font-medium bg-primary/15 text-primary'
                          : 'rounded px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground'
                      }
                    >
                      {selectedProviderDisplay.enabled ? _(msg`Enabled`) : _(msg`Disabled`)}
                    </span>
                    <span
                      className={
                        selectedProviderDisplay.configured
                          ? 'rounded px-2 py-0.5 text-xs font-medium bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                          : 'rounded px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground'
                      }
                    >
                      {selectedProviderDisplay.configured
                        ? _(msg`Configured`)
                        : _(msg`Not configured`)}
                    </span>
                    <span
                      className={
                        selectedProviderDisplay.enabled &&
                        selectedProviderDisplay.missingRequiredFields.length === 0
                          ? 'rounded px-2 py-0.5 text-xs font-medium bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                          : 'rounded px-2 py-0.5 text-xs font-medium bg-amber-500/15 text-amber-700 dark:text-amber-400'
                      }
                    >
                      {selectedProviderDisplay.enabled &&
                      selectedProviderDisplay.missingRequiredFields.length === 0
                        ? _(msg`Ready`)
                        : selectedProviderDisplay.missingRequiredFields.length > 0
                          ? _(msg`Missing required fields`)
                          : _(msg`Inactive`)}
                    </span>
                  </div>
                  <p
                    className="mt-2 text-xs text-muted-foreground"
                    data-testid="selected-provider-required-fields"
                  >
                    {_(msg`Required fields`)}: {selectedProviderDisplay.requiredFields.join(', ')}
                  </p>
                </div>

                <SettingsRow
                  label={_(msg`${selectedProviderDisplay.providerName} base URL`)}
                  htmlFor={`provider-base-url-${selectedProvider.id}`}
                  description={
                    selectedProvider.id === 'ollama'
                      ? _(
                          msg`Local Ollama: leave empty (uses http://localhost:11434). Ollama Cloud: use https://ollama.com — requires an API key and model names with the -cloud suffix (e.g. gpt-oss:120b-cloud).`
                        )
                      : undefined
                  }
                >
                  <Input
                    id={`provider-base-url-${selectedProvider.id}`}
                    aria-label={_(msg`${selectedProviderDisplay.providerName} base URL`)}
                    value={selectedProviderDisplay.runtimeInput.baseUrl}
                    onChange={(event) =>
                      setProviderRuntimeInputs((previous) => ({
                        ...previous,
                        [selectedProvider.id]: {
                          ...(previous[selectedProvider.id] ??
                            toRuntimeInputState(selectedProviderDisplay.runtimeSettings)),
                          baseUrl: event.target.value,
                        },
                      }))
                    }
                    onBlur={() => {
                      void handleProviderRuntimeBlur(selectedProvider);
                    }}
                    placeholder={
                      getProviderEndpointPlaceholder(selectedProvider.id) ??
                      _(msg`Optional endpoint override`)
                    }
                  />
                </SettingsRow>

                {selectedProvider.kind === 'llm' && (
                  <SettingsRow label={_(msg`${selectedProviderDisplay.providerName} model`)}>
                    <div className="flex items-center gap-1.5">
                      <div className="relative flex-1">
                        <InputGroup>
                          <InputGroupInput
                            value={selectedProviderDisplay.runtimeInput.model}
                            placeholder={
                              isFetchingModels
                                ? _(msg`Fetching...`)
                                : _(msg`Type or fetch to pick a model`)
                            }
                            onChange={(event) =>
                              setProviderRuntimeInputs((previous) => ({
                                ...previous,
                                [selectedProvider.id]: {
                                  ...(previous[selectedProvider.id] ??
                                    toRuntimeInputState(selectedProviderDisplay.runtimeSettings)),
                                  model: event.target.value,
                                },
                              }))
                            }
                            onFocus={() => setProviderModelFocused(true)}
                            onBlur={() => {
                              if (providerModelSelectingRef.current) return;
                              setProviderModelFocused(false);
                              void handleProviderRuntimeBlur(selectedProvider);
                            }}
                          />
                          <InputGroupAddon align="inline-end">
                            <InputGroupButton
                              variant="ghost"
                              size="icon-xs"
                              aria-label={_(msg`Toggle model list`)}
                              disabled={
                                (
                                  providerAvailableModels[getModelsCacheKey(selectedProvider.id)] ??
                                  []
                                ).length === 0
                              }
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => setProviderModelFocused((prev) => !prev)}
                            >
                              <HugeiconsIcon
                                icon={providerModelFocused ? ArrowUp01Icon : ArrowDown01Icon}
                                className="size-3.5"
                              />
                            </InputGroupButton>
                          </InputGroupAddon>
                        </InputGroup>
                        <ModelSuggestionList
                          models={
                            providerAvailableModels[getModelsCacheKey(selectedProvider.id)] ?? []
                          }
                          query={selectedProviderDisplay.runtimeInput.model}
                          visible={providerModelFocused}
                          onHide={() => setProviderModelFocused(false)}
                          selectingRef={providerModelSelectingRef}
                          onSelect={(modelName) => {
                            setProviderRuntimeInputs((previous) => {
                              const updated = {
                                ...(previous[selectedProvider.id] ??
                                  toRuntimeInputState(selectedProviderDisplay.runtimeSettings)),
                                model: modelName,
                              };
                              // Save directly with the new value to avoid stale state
                              void saveProviderRuntimeSettings(selectedProvider, {
                                // biome-ignore lint/style/useNamingConvention: backend field
                                base_url:
                                  updated.baseUrl.trim().length > 0 ? updated.baseUrl.trim() : null,
                                model: modelName.trim().length > 0 ? modelName.trim() : null,
                                // biome-ignore lint/style/useNamingConvention: backend field
                                timeout_ms:
                                  updated.timeoutMs.trim().length > 0
                                    ? Math.round(Number(updated.timeoutMs))
                                    : null,
                                // biome-ignore lint/style/useNamingConvention: backend field
                                system_prompt:
                                  updated.systemPrompt.trim().length > 0
                                    ? updated.systemPrompt.trim()
                                    : null,
                              });
                              return { ...previous, [selectedProvider.id]: updated };
                            });
                          }}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-9 shrink-0 text-muted-foreground hover:text-foreground"
                        disabled={isFetchingModels}
                        aria-label={_(msg`Fetch available models`)}
                        onClick={() => {
                          void handleFetchModels(selectedProvider.id);
                        }}
                      >
                        <HugeiconsIcon
                          icon={Refresh04Icon}
                          className={isFetchingModels ? 'animate-spin' : ''}
                        />
                      </Button>
                    </div>
                  </SettingsRow>
                )}

                {selectedProvider.kind === 'llm' && (
                  <SettingsRow
                    label={_(msg`${selectedProviderDisplay.providerName} system prompt`)}
                    htmlFor={`provider-system-prompt-${selectedProvider.id}`}
                    description={_(
                      msg`Override the default translation instruction. Supports {source_lang} and {target_lang} placeholders.`
                    )}
                  >
                    <Textarea
                      id={`provider-system-prompt-${selectedProvider.id}`}
                      aria-label={_(msg`${selectedProviderDisplay.providerName} system prompt`)}
                      value={selectedProviderDisplay.runtimeInput.systemPrompt}
                      rows={4}
                      onChange={(event) =>
                        setProviderRuntimeInputs((previous) => ({
                          ...previous,
                          [selectedProvider.id]: {
                            ...(previous[selectedProvider.id] ??
                              toRuntimeInputState(selectedProviderDisplay.runtimeSettings)),
                            systemPrompt: event.target.value,
                          },
                        }))
                      }
                      onBlur={() => {
                        void handleProviderRuntimeBlur(selectedProvider);
                      }}
                      placeholder="You are a professional {source_lang} to {target_lang} translator. Accurately convey the meaning and nuances of the original text while adhering to {target_lang} grammar, vocabulary, and cultural sensitivities. Produce only the {target_lang} translation, without any additional explanations or commentary."
                    />
                  </SettingsRow>
                )}

                <SettingsRow
                  label={_(msg`${selectedProviderDisplay.providerName} timeout (ms)`)}
                  htmlFor={`provider-timeout-${selectedProvider.id}`}
                >
                  <Input
                    id={`provider-timeout-${selectedProvider.id}`}
                    aria-label={_(msg`${selectedProviderDisplay.providerName} timeout (ms)`)}
                    value={selectedProviderDisplay.runtimeInput.timeoutMs}
                    onChange={(event) =>
                      setProviderRuntimeInputs((previous) => ({
                        ...previous,
                        [selectedProvider.id]: {
                          ...(previous[selectedProvider.id] ??
                            toRuntimeInputState(selectedProviderDisplay.runtimeSettings)),
                          timeoutMs: event.target.value,
                        },
                      }))
                    }
                    onBlur={() => {
                      void handleProviderRuntimeBlur(selectedProvider);
                    }}
                    placeholder={_(msg`Optional timeout`)}
                  />
                </SettingsRow>

                {(selectedProviderDisplay.requiresApiKey ||
                  selectedProviderDisplay.acceptsOptionalApiKey) && (
                  <SettingsRow
                    label={_(msg`${selectedProviderDisplay.providerName} API key`)}
                    htmlFor={`provider-key-${selectedProvider.id}`}
                    description={
                      selectedProviderDisplay.acceptsOptionalApiKey
                        ? _(
                            msg`Optional. Leave empty for local Ollama. Required for the Ollama cloud API (ollama.com).`
                          )
                        : undefined
                    }
                  >
                    <Input
                      id={`provider-key-${selectedProvider.id}`}
                      aria-label={_(msg`${selectedProviderDisplay.providerName} API key`)}
                      type="password"
                      value={providerKeyInputs[selectedProvider.id] ?? ''}
                      onChange={(event) =>
                        setProviderKeyInputs((previous) => ({
                          ...previous,
                          [selectedProvider.id]: event.target.value,
                        }))
                      }
                      onBlur={() => {
                        void handleProviderKeyBlur(selectedProvider.id);
                      }}
                      placeholder={
                        (providerKeyStatus[selectedProvider.id] ?? false)
                          ? _(msg`Replace key`)
                          : selectedProviderDisplay.acceptsOptionalApiKey
                            ? _(msg`Optional – for cloud API`)
                            : _(msg`Paste key`)
                      }
                    />
                  </SettingsRow>
                )}
              </div>
            )}
          </div>
        </div>
      </SettingsSection>

      <SettingsSection title={_(msg`Translation`)}>
        <div className="space-y-4">
          <SettingsRow
            label={_(msg`Route strategy`)}
            description={_(
              msg`Choose how translation requests are routed across engines and LLMs.`
            )}
          >
            <Select
              value={preferences?.reader_translation_route_mode ?? 'engine_first'}
              onValueChange={handleRouteModeChange}
              disabled={!preferences || savePreferences.isPending}
            >
              <SelectTrigger aria-label={_(msg`Translation route mode`)} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="engine_first">{_(msg`Engine first`)}</SelectItem>
                <SelectItem value="hybrid_auto">{_(msg`Hybrid auto`)}</SelectItem>
              </SelectContent>
            </Select>
          </SettingsRow>

          <SettingsRow
            label={_(msg`Target language`)}
            description={_(msg`Language used for immersive translation output.`)}
          >
            <Select
              value={preferences?.reader_translation_target_language ?? 'en'}
              onValueChange={handleTargetLanguageChange}
              disabled={!preferences || savePreferences.isPending}
            >
              <SelectTrigger aria-label={_(msg`Translation target language`)} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">{_(msg`English`)}</SelectItem>
                <SelectItem value="zh-CN">{_(msg`Chinese (Simplified)`)}</SelectItem>
                <SelectItem value="zh-TW">{_(msg`Chinese (Traditional)`)}</SelectItem>
                <SelectItem value="ja">{_(msg`Japanese`)}</SelectItem>
                <SelectItem value="ko">{_(msg`Korean`)}</SelectItem>
                <SelectItem value="es">{_(msg`Spanish`)}</SelectItem>
                <SelectItem value="fr">{_(msg`French`)}</SelectItem>
                <SelectItem value="de">{_(msg`German`)}</SelectItem>
              </SelectContent>
            </Select>
          </SettingsRow>
        </div>

        <SettingsField
          label={_(msg`Excluded Feeds`)}
          description={_(
            msg`Feeds in this list will not be automatically translated. Chinese conversion still applies.`
          )}
        >
          <FeedExclusionList />
        </SettingsField>

        <SettingsField
          label={_(msg`Excluded Categories`)}
          description={_(
            msg`All feeds in these categories will skip auto-translation. Chinese conversion still applies.`
          )}
        >
          <CategoryExclusionList />
        </SettingsField>
      </SettingsSection>

      <SettingsSection title={_(msg`AI Summary`)}>
        <SettingsField
          label={_(msg`Provider`)}
          description={_(
            msg`LLM provider for AI summaries. If not set, uses the translation LLM fallback chain.`
          )}
        >
          <Select
            value={preferences?.ai_summary_provider ?? ''}
            onValueChange={(value: string) => {
              if (preferences) {
                savePreferences.mutate({
                  ...preferences,
                  // biome-ignore lint/style/useNamingConvention: preferences field name
                  ai_summary_provider: value || null,
                });
              }
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={_(msg`Use translation LLM providers`)} />
            </SelectTrigger>
            <SelectContent>
              {llmProviders.map((provider) => (
                <SelectItem key={provider.id} value={provider.id}>
                  {getProviderLabel(provider.id)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingsField>
        {preferences?.ai_summary_provider && (
          <SettingsField
            label={_(msg`Model`)}
            description={_(
              msg`Model name for AI summaries. If not set, uses the model configured for this provider in translation settings.`
            )}
          >
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <InputGroup>
                  <InputGroupInput
                    value={summaryModelInput}
                    placeholder={_(msg`Type or fetch to pick a model`)}
                    onChange={(e) => {
                      setSummaryModelInput(e.target.value);
                      if (preferences) {
                        savePreferences.mutate({
                          ...preferences,
                          // biome-ignore lint/style/useNamingConvention: preferences field name
                          ai_summary_model: e.target.value || null,
                        });
                      }
                    }}
                    onFocus={() => setSummaryModelFocused(true)}
                    onBlur={() => {
                      if (summaryModelSelectingRef.current) return;
                      setSummaryModelFocused(false);
                    }}
                  />
                  <InputGroupAddon align="inline-end">
                    <InputGroupButton
                      variant="ghost"
                      size="icon-xs"
                      aria-label={_(msg`Toggle model list`)}
                      disabled={(summaryAvailableModels ?? []).length === 0}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => setSummaryModelFocused((prev) => !prev)}
                    >
                      <HugeiconsIcon
                        icon={summaryModelFocused ? ArrowUp01Icon : ArrowDown01Icon}
                        className="size-3.5"
                      />
                    </InputGroupButton>
                  </InputGroupAddon>
                </InputGroup>
                <ModelSuggestionList
                  models={summaryAvailableModels ?? []}
                  query={summaryModelInput}
                  visible={summaryModelFocused}
                  onHide={() => setSummaryModelFocused(false)}
                  selectingRef={summaryModelSelectingRef}
                  onSelect={(modelName) => {
                    setSummaryModelInput(modelName);
                    if (preferences) {
                      savePreferences.mutate({
                        ...preferences,
                        // biome-ignore lint/style/useNamingConvention: preferences field name
                        ai_summary_model: modelName || null,
                      });
                    }
                  }}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-9 shrink-0 text-muted-foreground hover:text-foreground"
                disabled={isFetchingSummaryModels}
                aria-label={_(msg`Fetch available models`)}
                onClick={() => {
                  void handleFetchSummaryModels();
                }}
              >
                <HugeiconsIcon
                  icon={Refresh04Icon}
                  className={isFetchingSummaryModels ? 'animate-spin' : ''}
                />
              </Button>
            </div>
          </SettingsField>
        )}
        <SettingsField
          label={_(msg`Auto-summarize`)}
          description={_(msg`Automatically generate an AI summary when opening an article`)}
        >
          <Switch
            checked={preferences?.ai_summary_auto_enabled ?? false}
            onCheckedChange={(checked) => {
              if (preferences) {
                savePreferences.mutate({
                  ...preferences,
                  // biome-ignore lint/style/useNamingConvention: preferences field name
                  ai_summary_auto_enabled: Boolean(checked),
                });
              }
            }}
          />
        </SettingsField>
        <SettingsField
          label={_(msg`Custom Prompt`)}
          description={_(
            msg`Override the default system prompt for AI summaries. Leave empty to use the default.`
          )}
        >
          <Textarea
            value={preferences?.ai_summary_custom_prompt ?? ''}
            onChange={(e) => {
              if (preferences) {
                savePreferences.mutate({
                  ...preferences,
                  // biome-ignore lint/style/useNamingConvention: preferences field name
                  ai_summary_custom_prompt: e.target.value || null,
                });
              }
            }}
            placeholder="You are a concise article summarizer. Summarize the following article in 3-5 bullet points (max 250 words total). Each bullet point should be 1-2 sentences. Capture the key ideas and main takeaways. Use clear, direct language. Output only the summary bullet points, nothing else."
            rows={4}
            className="text-xs"
          />
        </SettingsField>
        <SettingsField
          label={_(msg`Max text length`)}
          description={_(
            msg`Maximum number of characters sent to the LLM. Longer articles are truncated.`
          )}
        >
          <Input
            type="number"
            min={1000}
            max={500000}
            step={10000}
            value={preferences?.ai_summary_max_text_length ?? 100000}
            onChange={(e) => {
              const value = Number.parseInt(e.target.value, 10);
              if (preferences && Number.isFinite(value) && value >= 1000) {
                savePreferences.mutate({
                  ...preferences,
                  // biome-ignore lint/style/useNamingConvention: preferences field name
                  ai_summary_max_text_length: value,
                });
              }
            }}
            className="w-32"
          />
        </SettingsField>
      </SettingsSection>

      <SettingsSection
        title={_(msg`Chinese Conversion`)}
        action={
          <Switch
            checked={chineseConversionEnabled}
            onCheckedChange={(checked) => {
              if (preferences) {
                savePreferences.mutate({
                  ...preferences,
                  // biome-ignore lint/style/useNamingConvention: preferences field name
                  reader_chinese_conversion: checked ? 's2tw' : 'off',
                });
              }
            }}
          />
        }
      >
        {chineseConversionEnabled && (
          <>
            <SettingsField
              label={_(msg`Conversion Mode`)}
              description={_(
                msg`Convert Chinese characters between Simplified and Traditional variants.`
              )}
            >
              <Select
                value={preferences?.reader_chinese_conversion ?? 's2tw'}
                onValueChange={(value: string) => {
                  if (preferences) {
                    savePreferences.mutate({
                      ...preferences,
                      // biome-ignore lint/style/useNamingConvention: preferences field name
                      reader_chinese_conversion:
                        value as typeof preferences.reader_chinese_conversion,
                    });
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="s2hk">{_(msg`繁體中文（香港）`)}</SelectItem>
                  <SelectItem value="s2tw">{_(msg`繁體中文（台灣）`)}</SelectItem>
                  <SelectItem value="t2s">{_(msg`簡體中文`)}</SelectItem>
                </SelectContent>
              </Select>
            </SettingsField>

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
          </>
        )}
      </SettingsSection>
    </div>
  );
}

function FeedExclusionList() {
  const { _ } = useLingui();
  const { data: preferences } = usePreferences();
  const { mutate: savePreferencesAction, isPending } = useSavePreferences();
  const { data: feeds } = useFeeds();
  const excludedIds = preferences?.reader_translation_excluded_feed_ids ?? [];

  const excludedFeeds = (feeds ?? []).filter((feed) => excludedIds.includes(feed.id));
  const availableFeeds = (feeds ?? []).filter((feed) => !excludedIds.includes(feed.id));

  const addFeed = (feedId: string) => {
    if (!preferences || excludedIds.includes(feedId)) return;
    savePreferencesAction({
      ...preferences,
      // biome-ignore lint/style/useNamingConvention: preferences field name
      reader_translation_excluded_feed_ids: [...excludedIds, feedId],
    });
  };

  const removeFeed = (feedId: string) => {
    if (!preferences) return;
    savePreferencesAction({
      ...preferences,
      // biome-ignore lint/style/useNamingConvention: preferences field name
      reader_translation_excluded_feed_ids: excludedIds.filter((id) => id !== feedId),
    });
  };

  return (
    <div className="space-y-2">
      {excludedFeeds.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {excludedFeeds.map((feed) => (
            <Badge key={feed.id} variant="secondary" className="gap-1 pr-1 h-auto py-0.5">
              <span className="max-w-[200px] truncate">{feed.title}</span>
              <button
                type="button"
                onClick={() => removeFeed(feed.id)}
                disabled={isPending}
                aria-label={_(msg`Remove ${feed.title}`)}
                className="ml-0.5 rounded-sm opacity-60 hover:opacity-100 disabled:pointer-events-none transition-opacity"
              >
                <HugeiconsIcon icon={Cancel01Icon} className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {excludedFeeds.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {_(msg`No feeds excluded. All feeds will be translated when translation is enabled.`)}
        </p>
      )}

      {availableFeeds.length > 0 && (
        <Combobox
          value=""
          onValueChange={(value) => {
            if (value && typeof value === 'string') {
              addFeed(value);
            }
          }}
        >
          <ComboboxInput placeholder={_(msg`Search feeds to exclude...`)} />
          <ComboboxContent>
            <ComboboxList>
              {availableFeeds.map((feed) => (
                <ComboboxItem key={feed.id} value={feed.id}>
                  {feed.title}
                </ComboboxItem>
              ))}
              <ComboboxEmpty>{_(msg`No feeds found`)}</ComboboxEmpty>
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
      )}
    </div>
  );
}

function CategoryExclusionList() {
  const { _ } = useLingui();
  const { data: preferences } = usePreferences();
  const { mutate: savePreferencesAction, isPending } = useSavePreferences();
  const { data: categories } = useCategories();
  const excludedIds = preferences?.reader_translation_excluded_category_ids ?? [];

  const excludedCategories = (categories ?? []).filter((cat) => excludedIds.includes(cat.id));
  const availableCategories = (categories ?? []).filter((cat) => !excludedIds.includes(cat.id));

  const addCategory = (categoryId: string) => {
    if (!preferences || excludedIds.includes(categoryId)) return;
    savePreferencesAction({
      ...preferences,
      // biome-ignore lint/style/useNamingConvention: preferences field name
      reader_translation_excluded_category_ids: [...excludedIds, categoryId],
    });
  };

  const removeCategory = (categoryId: string) => {
    if (!preferences) return;
    savePreferencesAction({
      ...preferences,
      // biome-ignore lint/style/useNamingConvention: preferences field name
      reader_translation_excluded_category_ids: excludedIds.filter((id) => id !== categoryId),
    });
  };

  return (
    <div className="space-y-2">
      {excludedCategories.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {excludedCategories.map((cat) => (
            <Badge key={cat.id} variant="secondary" className="gap-1 pr-1 h-auto py-0.5">
              <span className="max-w-[200px] truncate">{cat.title}</span>
              <button
                type="button"
                onClick={() => removeCategory(cat.id)}
                disabled={isPending}
                aria-label={_(msg`Remove ${cat.title}`)}
                className="ml-0.5 rounded-sm opacity-60 hover:opacity-100 disabled:pointer-events-none transition-opacity"
              >
                <HugeiconsIcon icon={Cancel01Icon} className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {excludedCategories.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {_(
            msg`No categories excluded. All categories will be translated when translation is enabled.`
          )}
        </p>
      )}

      {availableCategories.length > 0 && (
        <Combobox
          value=""
          onValueChange={(value) => {
            if (value && typeof value === 'string') {
              addCategory(value);
            }
          }}
        >
          <ComboboxInput placeholder={_(msg`Search categories to exclude...`)} />
          <ComboboxContent>
            <ComboboxList>
              {availableCategories.map((cat) => (
                <ComboboxItem key={cat.id} value={cat.id}>
                  {cat.title}
                </ComboboxItem>
              ))}
              <ComboboxEmpty>{_(msg`No categories found`)}</ComboboxEmpty>
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
      )}
    </div>
  );
}
