import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// The PWA plugin caches the app shell so the interview screen reloads offline.
export default defineConfig({
  build: { chunkSizeWarningLimit: 1500 },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'UNWRITTEN',
        short_name: 'UNWRITTEN',
        description: 'The AI that asks what nobody thought to ask.',
        theme_color: '#f5f7fb',
        background_color: '#f5f7fb',
        display: 'standalone',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml' }],
      },
      workbox: { navigateFallback: '/index.html', globPatterns: ['**/*.{js,css,html,svg,woff2}'] },
    }),
  ],
});
