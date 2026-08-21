import { describe, expect, it } from 'vite-plus/test';

import type { Entry, EntryResponse } from '@/lib/tauri-bindings';
import { selectUnreadPool } from './use-random-entry';

function entry(id: string, status: 'read' | 'unread'): Entry {
  return {
    id,
    status,
    title: `Entry ${id}`,
    published_at: '2026-08-01T00:00:00Z',
  } as unknown as Entry;
}

function page(...entries: Entry[]): EntryResponse {
  return { total: String(entries.length), entries } as unknown as EntryResponse;
}

describe('selectUnreadPool', () => {
  it('drops entries that have been marked read', () => {
    const pool = selectUnreadPool([page(entry('1', 'unread'), entry('2', 'read'))]);

    expect(pool.map((e) => e.id)).toEqual(['1']);
  });

  it('deduplicates entries repeated across overlapping pages', () => {
    const pool = selectUnreadPool([
      page(entry('1', 'unread'), entry('2', 'unread')),
      page(entry('2', 'unread'), entry('3', 'unread')),
    ]);

    expect(pool.map((e) => e.id)).toEqual(['1', '2', '3']);
  });

  it('tolerates pages with no entries', () => {
    const pool = selectUnreadPool([
      { total: '0', entries: null } as unknown as EntryResponse,
      page(entry('1', 'unread')),
    ]);

    expect(pool.map((e) => e.id)).toEqual(['1']);
  });
});
