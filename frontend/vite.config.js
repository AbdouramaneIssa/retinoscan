import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['eye.svg', 'apple-touch-icon.png', 'hero.jpg'],
      manifest: {
        name: 'RetinoScan CM — Diagnostic IA',
        short_name: 'RetinoScan',
        description: "Diagnostic assisté par IA : rétinopathie diabétique, diabète, hypertension et risque cardiovasculaire.",
        lang: 'fr',
        theme_color: '#072b48',
        background_color: '#f6f9fc',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        categories: ['medical', 'health'],
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,jpg,ico,woff2}'],
        navigateFallback: '/index.html',
        // Ne pas intercepter les appels API backend ni Firebase
        navigateFallbackDenylist: [/^\/api/, /^\/predict/, /^\/rapport/, /^\/chat/],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com',
            handler: 'CacheFirst',
            options: { cacheName: 'google-fonts', expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
        ],
      },
      devOptions: { enabled: true },
    }),
  ],
})
