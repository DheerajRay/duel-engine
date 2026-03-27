import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

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
    <App />
  </StrictMode>,
);
