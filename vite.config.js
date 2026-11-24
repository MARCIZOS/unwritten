import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// The PWA plugin caches the app shell so the interview screen reloads offline.
export default defineConfig({
  build: {
    // The only chunk over 500 kB is the Firestore SDK itself (about 164 kB gzipped), which the
    // offline cache needs. Everything else is split, so the limit sits just above it.
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        // Each Firebase SDK gets its own long-cached chunk instead of riding in every app update,
        // and the AI SDK only downloads with the pages that use it.
        manualChunks(id) {
          const fb = id.match(/node_modules\/@firebase\/([a-z-]+)/);
          if (fb) return `firebase-${fb[1].replace(/-(compat|types)$/, '')}`;
          if (id.includes('node_modules/react')) return 'react';
          return undefined;
        },
      },
    },
  },
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
