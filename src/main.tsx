import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { TanStackDevtools } from '@tanstack/react-devtools';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtoolsPanel } from '@tanstack/react-query-devtools';
import { RouterProvider } from '@tanstack/react-router';
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools';
import ReactDOM from 'react-dom/client';
import { AppProviders } from './AppProviders';
import { loadAndActivate } from './i18n/config';
import { queryClient } from './lib/query-client';
import { router } from './router';
import './App.css';

loadAndActivate('en');

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <I18nProvider i18n={i18n}>
    <QueryClientProvider client={queryClient}>
      <AppProviders>
        <RouterProvider router={router} />
      </AppProviders>
      {import.meta.env.DEV && (
        <TanStackDevtools
          plugins={[
            { name: 'Query', render: <ReactQueryDevtoolsPanel /> },
            {
              name: 'Router',
              render: <TanStackRouterDevtoolsPanel router={router} />,
            },
          ]}
        />
      )}
    </QueryClientProvider>
  </I18nProvider>
);
