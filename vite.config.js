import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { resolve } from 'path';

export default defineConfig({
  root: '.',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        docsIndex: resolve(__dirname, 'docs/index.html'),
        docsGettingStarted: resolve(__dirname, 'docs/getting-started.html'),
        docsFormulas: resolve(__dirname, 'docs/formulas.html'),
        docsRelaySettings: resolve(__dirname, 'docs/relay-settings.html'),
        docsOverlays: resolve(__dirname, 'docs/coordination-overlays.html'),
        docsExamples: resolve(__dirname, 'docs/worked-examples.html'),
        docsExport: resolve(__dirname, 'docs/export-sharing.html'),
        docsFaq: resolve(__dirname, 'docs/faq.html'),
        blogIndex: resolve(__dirname, 'blog/index.html'),
        blogIdmt: resolve(__dirname, 'blog/idmt-overcurrent-relay-curves.html'),
        blogCoordination: resolve(__dirname, 'blog/protection-coordination-study.html'),
        blogIecIeee: resolve(__dirname, 'blog/iec-60255-vs-ieee-c37112.html'),
        blogCable: resolve(__dirname, 'blog/cable-protection-bs7671.html'),
      },
    },
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icon.svg', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'IDMT Relay Simulator',
        short_name: 'Relay Sim',
        description: 'Interactive overcurrent relay coordination simulator',
        theme_color: '#0a0e17',
        background_color: '#0a0e17',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
    }),
  ],
});
