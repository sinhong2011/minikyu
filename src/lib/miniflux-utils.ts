import {
  differenceInCalendarDays,
  format,
  formatDistanceToNow,
  type Locale,
  parseISO,
} from 'date-fns';
import { enUS, ja, ko, zhCN, zhTW } from 'date-fns/locale';
import type { Entry } from '@/lib/tauri-bindings';

const DATE_LOCALE_MAP: Record<string, Locale> = {
  en: enUS,
  ja,
  ko,
  'zh-CN': zhCN,
  'zh-TW': zhTW,
};

export function getDateLocale(appLocale: string): Locale {
  return DATE_LOCALE_MAP[appLocale] ?? enUS;
}

const SECTION_DATE_FORMATS: Record<string, string> = {
  ja: 'yyyy年M月d日 EEEE',
  ko: 'yyyy년 M월 d일 EEEE',
  'zh-CN': 'yyyy年M月d日 EEEE',
  'zh-TW': 'yyyy年M月d日 EEEE',
};

const SHORT_DATE_FORMATS: Record<string, string> = {
  ja: 'yyyy年M月d日（EEEE）',
  ko: 'yyyy년 M월 d일 (EEEE)',
  'zh-CN': 'yyyy年M月d日 EEEE',
  'zh-TW': 'yyyy年M月d日 EEEE',
};

export function formatSectionDate(date: Date, appLocale: string): string {
  const locale = getDateLocale(appLocale);
  const pattern = SECTION_DATE_FORMATS[appLocale] ?? 'EEEE, MMMM d, yyyy';
  return format(date, pattern, { locale });
}

export function formatShortDate(date: Date, appLocale: string): string {
  const locale = getDateLocale(appLocale);
  const pattern = SHORT_DATE_FORMATS[appLocale] ?? 'EEEE, MMM d, yyyy';
  return format(date, pattern, { locale });
}

export type EntryDateSectionType = 'today' | 'yesterday' | 'weekday' | 'full-date';

interface EntryWithPublishedAt {
  // biome-ignore lint/style/useNamingConvention: matches Miniflux API shape
  published_at: string;
}

export interface EntryDateGroup<T extends EntryWithPublishedAt> {
  key: string;
  date: Date;
  entries: T[];
}

export const parseDateInput = (value: string): Date | null => {
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

  const parsed = parseISO(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export function formatRelativeTime(dateString: string): string {
  const date = parseDateInput(dateString);
  if (!date) return '';

  return formatDistanceToNow(date, {
    addSuffix: true,
  });
}

export function formatEntryTime(dateString: string, use24h = true): string {
  const date = parseDateInput(dateString);
  if (!date) return '';

  return format(date, use24h ? 'HH:mm' : 'hh:mm a');
}

export function getEntryDateSectionType(date: Date, now: Date = new Date()): EntryDateSectionType {
  const dayDiff = differenceInCalendarDays(date, now);

  if (dayDiff === 0) return 'today';
  if (dayDiff === -1) return 'yesterday';
  if (dayDiff <= -2 && dayDiff >= -6) return 'weekday';

  return 'full-date';
}

export function groupEntriesByCalendarDate<T extends EntryWithPublishedAt>(
  entries: T[]
): EntryDateGroup<T>[] {
  const groups: EntryDateGroup<T>[] = [];

  entries.forEach((entry, index) => {
    const parsedDate = parseDateInput(entry.published_at);
    const groupDate = parsedDate ?? new Date(0);
    const key = parsedDate ? format(groupDate, 'yyyy-MM-dd') : `invalid-${index}`;
    const previousGroup = groups.at(-1);

    if (!previousGroup || previousGroup.key !== key) {
      groups.push({
        key,
        date: groupDate,
        entries: [entry],
      });
      return;
    }

    previousGroup.entries.push(entry);
  });

  return groups;
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
