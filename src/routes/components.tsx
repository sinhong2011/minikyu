import { createFileRoute } from '@tanstack/react-router';
import { ComponentsPage } from '../pages/ComponentsPage';

export const Route = createFileRoute('/components')({
  component: ComponentsPage,
});
