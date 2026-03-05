import { SparklesIcon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { listen } from '@tauri-apps/api/event';
import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { commands } from '@/lib/tauri-bindings';
import { cn } from '@/lib/utils';

interface SummarizeStreamEvent {
  // biome-ignore lint/style/useNamingConvention: Tauri event payload field name
  stream_id: string;
  event: 'delta' | 'done' | 'error';
  text: string;
  // biome-ignore lint/style/useNamingConvention: Tauri event payload field name
  provider_used: string | null;
  // biome-ignore lint/style/useNamingConvention: Tauri event payload field name
  model_used: string | null;
}

function stripHtmlToPlainText(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body.textContent ?? '';
}

// Session-level cache: persists summaries across entry navigation within the session
interface CachedSummary {
  summary: string;
  modelUsed: string | null;
  providerUsed: string | null;
}
const summaryCache = new Map<string, CachedSummary>();

export interface ArticleSummaryHookState {
  summary: string | null;
  loading: boolean;
  error: string | null;
  modelUsed: string | null;
  providerUsed: string | null;
  collapsed: boolean;
  onToggleCollapse: () => void;
  handleSummarize: () => void;
}

export function useArticleSummary(
  entryId: string,
  articleText: string,
  language?: string,
  autoSummarize = false
): ArticleSummaryHookState {
  const [summary, setSummary] = useState<string | null>(null);
  const [modelUsed, setModelUsed] = useState<string | null>(null);
  const [providerUsed, setProviderUsed] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const activeStreamIdRef = useRef<string | null>(null);
  // Always-current entryId ref — avoids stale closure in the stream listener
  const currentEntryIdRef = useRef(entryId);
  currentEntryIdRef.current = entryId;

  // Restore from cache/DB or reset when entry changes
  useEffect(() => {
    const cached = summaryCache.get(entryId);
    if (cached) {
      setSummary(cached.summary);
      setModelUsed(cached.modelUsed);
      setProviderUsed(cached.providerUsed);
      setError(null);
      setLoading(false);
      setCollapsed(false);
    } else {
      setSummary(null);
      setModelUsed(null);
      setProviderUsed(null);
      setError(null);
      setLoading(false);
      setCollapsed(false);
      // Try loading from DB
      commands.getArticleSummary(entryId).then((result) => {
        if (result.status !== 'ok' || !result.data) return;
        // Guard: only apply if still on the same entry
        if (currentEntryIdRef.current !== entryId) return;
        const { summary: dbSummary, provider_used: dbProvider, model_used: dbModel } = result.data;
        setSummary(dbSummary);
        setModelUsed(dbModel ?? null);
        setProviderUsed(dbProvider ?? null);
        summaryCache.set(entryId, {
          summary: dbSummary,
          modelUsed: dbModel ?? null,
          providerUsed: dbProvider ?? null,
        });
      });
    }
    activeStreamIdRef.current = null;
  }, [entryId]);

  // Listen for streaming events
  useEffect(() => {
    const unlisten = listen<SummarizeStreamEvent>('summarize-stream', (event) => {
      const data = event.payload;
      if (data.stream_id !== activeStreamIdRef.current) return;

      switch (data.event) {
        case 'delta':
          setSummary((prev) => (prev ?? '') + data.text);
          break;
        case 'done': {
          const currentId = currentEntryIdRef.current;
          setSummary(data.text);
          setProviderUsed(data.provider_used);
          setModelUsed(data.model_used);
          setLoading(false);
          activeStreamIdRef.current = null;
          summaryCache.set(currentId, {
            summary: data.text,
            modelUsed: data.model_used,
            providerUsed: data.provider_used,
          });
          commands.saveArticleSummary(currentId, data.text, data.provider_used, data.model_used);
          break;
        }
        case 'error':
          setError(data.text);
          setLoading(false);
          activeStreamIdRef.current = null;
          break;
      }
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  const handleSummarize = useCallback(() => {
    if (loading || !articleText.trim()) return;
    setLoading(true);
    setError(null);
    setSummary(null);

    const streamId = `summary-${entryId}-${Date.now()}`;
    activeStreamIdRef.current = streamId;

    // Fire-and-forget: don't await so events stream to the listener in real-time
    commands
      .summarizeArticleStream(
        {
          text: stripHtmlToPlainText(articleText),
          language: language ?? null,
        },
        streamId
      )
      .then((result) => {
        if (result.status === 'error' && activeStreamIdRef.current === streamId) {
          setError(result.error);
          setLoading(false);
          activeStreamIdRef.current = null;
        }
      });
  }, [articleText, entryId, language, loading]);

  // Auto-summarize when entry changes (if enabled)
  const autoSummarizedEntryRef = useRef<string | null>(null);
  useEffect(() => {
    if (autoSummarize && articleText.trim() && autoSummarizedEntryRef.current !== entryId) {
      autoSummarizedEntryRef.current = entryId;
      handleSummarize();
    }
  }, [autoSummarize, entryId, articleText, handleSummarize]);

  // Listen for command palette / menu event
  useEffect(() => {
    const handler = () => {
      if (!summary && !loading) {
        handleSummarize();
      } else if (summary) {
        setCollapsed((prev) => !prev);
      }
    };
    document.addEventListener('command:summarize-article', handler);
    return () => document.removeEventListener('command:summarize-article', handler);
  }, [summary, loading, handleSummarize]);

  const onToggleCollapse = useCallback(() => {
    setCollapsed((prev) => !prev);
  }, []);

  return {
    summary,
    loading,
    error,
    modelUsed,
    providerUsed,
    collapsed,
    onToggleCollapse,
    handleSummarize,
  };
}

// ── Summary text renderer — renders bullet/numbered lines as a list ──

const BULLET_RE = /^[\s]*[-•–—*]\s+/;
const NUMBERED_RE = /^[\s]*\d+[.)]\s+/;

function SummaryContent({ text }: { text: string }) {
  const lines = text.split('\n').filter((l) => l.trim().length > 0);
  const isList = lines.length > 1 && lines.every((l) => BULLET_RE.test(l) || NUMBERED_RE.test(l));

  if (!isList) {
    return <p className="whitespace-pre-wrap">{text}</p>;
  }

  return (
    <ul className="flex flex-col gap-1.5 pl-1">
      {lines.map((line, i) => (
        <li key={i} className="flex gap-2">
          <span className="mt-[0.55em] size-1 shrink-0 rounded-full bg-foreground/40" />
          <span>{line.replace(BULLET_RE, '').replace(NUMBERED_RE, '')}</span>
        </li>
      ))}
    </ul>
  );
}

// ── Display component (body area) ──

interface ArticleSummaryCardProps {
  summary: string | null;
  loading: boolean;
  error: string | null;
  modelUsed?: string | null;
  providerUsed?: string | null;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onRetry: () => void;
}

export function ArticleSummaryCard({
  summary,
  loading,
  error,
  modelUsed,
  providerUsed,
  collapsed,
  onToggleCollapse,
  onRetry,
}: ArticleSummaryCardProps) {
  const { _ } = useLingui();

  if (!summary && !loading && !error) return null;

  return (
    <div className="mb-4">
      <AnimatePresence mode="wait">
        {loading && !summary && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="rounded-lg border border-dashed bg-muted/30 p-3"
          >
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <HugeiconsIcon icon={SparklesIcon} className="h-3.5 w-3.5 animate-pulse" />
              {_(msg`Generating summary...`)}
            </div>
          </motion.div>
        )}

        {error && (
          <motion.div
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="rounded-lg border border-destructive/30 bg-destructive/5 p-3"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-destructive">{error}</span>
              <Button variant="ghost" size="sm" onClick={onRetry} className="h-6 text-xs">
                {_(msg`Retry`)}
              </Button>
            </div>
          </motion.div>
        )}

        {summary && (
          <motion.div
            key="summary"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-lg border bg-muted/30 p-3"
          >
            <button
              type="button"
              onClick={onToggleCollapse}
              className="flex w-full items-center gap-2 text-left"
            >
              <HugeiconsIcon icon={SparklesIcon} className="size-4 shrink-0 text-primary" />
              <span className="flex-1 text-xs font-medium">{_(msg`AI Summary`)}</span>
              {loading && (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary animate-pulse">
                  {_(msg`streaming...`)}
                </span>
              )}
              {!loading && providerUsed && modelUsed && (
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                  {modelUsed}
                </span>
              )}
              <svg
                className={cn(
                  'size-3 shrink-0 text-muted-foreground transition-transform duration-200',
                  collapsed && '-rotate-90'
                )}
                viewBox="0 0 12 12"
                fill="none"
              >
                <path
                  d="M3 4.5L6 7.5L9 4.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <AnimatePresence>
              {!collapsed && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                  className="overflow-hidden"
                >
                  <div className="mt-2 border-t border-border/50 pt-2.5 text-sm leading-relaxed text-foreground/80">
                    <SummaryContent text={summary} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
