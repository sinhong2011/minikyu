import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import ReactDOM from 'react-dom/client';
import { defaultLocale, loadAndActivate } from '@/i18n/config';
import { TrayPopover } from '@/pages/TrayPopover';
import '@/styles/global.css';

loadAndActivate(defaultLocale);

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <I18nProvider i18n={i18n}>
    <TrayPopover />
  </I18nProvider>
);
