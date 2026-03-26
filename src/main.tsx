import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { Toaster } from 'sonner';
import { registerSW } from 'virtual:pwa-register';

if (import.meta.env.PROD) {
  registerSW({ immediate: true });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <Toaster position="top-center" theme="dark" />
  </StrictMode>,
);
