import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import ReactDOM from 'react-dom/client';
import { defaultLocale, loadAndActivate } from '@/i18n/config';
import { applyUiFont } from '@/lib/apply-ui-font';
import { PlayerWindow } from '@/pages/PlayerWindow';
import '@/styles/global.css';

loadAndActivate(defaultLocale);
applyUiFont();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <I18nProvider i18n={i18n}>
    <PlayerWindow />
  </I18nProvider>
);
