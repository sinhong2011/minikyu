import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { MinifluxLayout } from '@/components/miniflux';

const searchSchema = z.object({
  filter: z.enum(['all', 'starred', 'today', 'history']).optional(),
  category_id: z.string().optional(),
  feed_id: z.string().optional(),
});

export const Route = createFileRoute('/')({
  validateSearch: searchSchema,
  component: MinifluxLayout,
});
