import { createFileRoute } from '@tanstack/react-router';
import { TemplatesPage } from '../pages/TemplatesPage';

export const Route = createFileRoute('/templates')({
  component: TemplatesPage,
});
