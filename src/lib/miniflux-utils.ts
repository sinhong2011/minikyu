import { formatDistanceToNow, parseISO } from 'date-fns';
import type { Entry } from '@/lib/tauri-bindings';

const parseDateInput = (value: string): Date | null => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (/^\d+$/.test(trimmed)) {
    const numeric = Number(trimmed);
    if (!Number.isFinite(numeric)) return null;
    const isSeconds = trimmed.length <= 10;
    const date = new Date(isSeconds ? numeric * 1000 : numeric);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return parseISO(trimmed);
};

export function formatRelativeTime(dateString: string): string {
  const date = parseDateInput(dateString);
  if (!date) return '';

  return formatDistanceToNow(date, {
    addSuffix: true,
  });
}

export function getFeedIconUrl(entry: Entry): string | null {
  const siteUrl = entry.feed?.site_url;
  if (!siteUrl) return null;
  try {
    return `https://icons.duckduckgo.com/ip3/${siteUrl}.ico`;
  } catch {
    return null;
  }
}
