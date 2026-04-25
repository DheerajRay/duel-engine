import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      selfDestroying: true,
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: [
        'favicon.svg',
        'apple-touch-icon.png',
        'pwa-192x192.png',
        'pwa-512x512.png',
        'maskable-icon-512x512.png',
      ],
      manifest: {
        name: 'Duel Engine',
        short_name: 'Duel Engine',
        description: 'Browser-based Yu-Gi-Oh-inspired duel simulator.',
        theme_color: '#000000',
        background_color: '#000000',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        navigateFallback: 'index.html',
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}'],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalizedId = id.replace(/\\/g, '/');

          if (normalizedId.includes('/src/resource/')) {
            return 'card-catalog';
          }

          if (
            normalizedId.includes('/src/utils/cardParser.ts') ||
            normalizedId.includes('/src/services/gameContentStore.ts') ||
            normalizedId.includes('/src/constants.ts')
          ) {
            return 'card-catalog';
          }

          if (
            normalizedId.includes('/src/engine/') ||
            normalizedId.includes('/src/effects/')
          ) {
            return 'duel-engine';
          }

          if (
            normalizedId.includes('/src/utils/competitionMode.ts') ||
            normalizedId.includes('/src/utils/characterDecks.ts')
          ) {
            return 'competition-content';
          }

          if (normalizedId.includes('node_modules')) {
            if (
              normalizedId.includes('react') ||
              normalizedId.includes('scheduler') ||
              normalizedId.includes('react-router-dom')
            ) {
              return 'react-vendor';
            }

            if (
              normalizedId.includes('motion') ||
              normalizedId.includes('lucide-react')
            ) {
              return 'ui-vendor';
            }
          }
        },
      },
    },
  },
});
