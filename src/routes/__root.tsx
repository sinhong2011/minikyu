import { createRootRoute, Outlet } from '@tanstack/react-router';
import { MainWindow } from '../components/layout/MainWindow';

export const Route = createRootRoute({
  component: () => (
    <MainWindow>
      <Outlet />
    </MainWindow>
  ),
});
