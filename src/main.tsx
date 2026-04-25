import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';
import { AppPreferencesProvider } from './preferences/AppPreferencesProvider.tsx';
import { applyPreferencesToDocument, readCachedPreferences } from './services/preferences.ts';

applyPreferencesToDocument(readCachedPreferences());

const shouldRegisterServiceWorker =
  import.meta.env.PROD &&
  typeof window !== 'undefined' &&
  window.location.protocol === 'https:';

if (shouldRegisterServiceWorker) {
  registerSW({ immediate: true });
} else if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => {
      registration.unregister();
    });
  }).catch(() => {
    // Ignore local cleanup failures.
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppPreferencesProvider>
      <App />
    </AppPreferencesProvider>
  </StrictMode>,
);
