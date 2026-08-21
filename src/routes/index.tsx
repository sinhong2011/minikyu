import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { MinifluxLayout } from '@/components/miniflux';

const searchSchema = z.object({
  filter: z.enum(['all', 'starred', 'today', 'history']).optional(),
  categoryId: z.string().optional(),
  feedId: z.string().optional(),
  /**
   * Read-status filter. Absent means the view's own default — unread for the
   * article views, everything for Starred and History, which already imply a
   * status. `all` is therefore not the same as absent: it is an explicit
   * choice, and that distinction is what lets the default survive a reload.
   */
  status: z.enum(['all', 'unread', 'starred']).optional(),
  /** Sort column; absent means the view default (History sorts by read time). */
  sort: z.enum(['published_at', 'changed_at']).optional(),
  /** Sort direction; absent means newest first. */
  dir: z.enum(['asc', 'desc']).optional(),
  /** Free-text entry search. */
  q: z.string().optional(),
  /** Lower bound on published_at, unix seconds, as Miniflux expects it. */
  after: z.string().optional(),
  /** Open entry id — makes the reader deep-linkable and back-button aware. */
  entry: z.string().optional(),
  /**
   * Zen Mode. Absent means closed; `random` opens it and draws an article,
   * which then replaces the value with its own id. See `ZEN_RANDOM`.
   */
  zen: z.string().optional(),
});

export const Route = createFileRoute('/')({
  validateSearch: searchSchema,
  component: MinifluxLayout,
});
