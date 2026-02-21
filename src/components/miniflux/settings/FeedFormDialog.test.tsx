import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FeedFormDialog } from './FeedFormDialog';

i18n.load('en', {});
i18n.activate('en');

function renderDialog() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider i18n={i18n}>
        <FeedFormDialog
          open
          mode="edit"
          initialFeedUrl="https://example.com/feed.xml"
          initialTitle="Example Feed"
          initialCategoryId={null}
          showAdvancedByDefault
          categories={[]}
          pending={false}
          onOpenChange={() => {}}
          onSubmit={async () => {}}
        />
      </I18nProvider>
    </QueryClientProvider>
  );
}

describe('FeedFormDialog', () => {
  it('shows crawler setting with original-content focused copy', () => {
    renderDialog();

    expect(screen.getByText('Download original content (crawler)')).toBeInTheDocument();
    expect(screen.getByText('Useful for summary-only feeds')).toBeInTheDocument();
  });
});
