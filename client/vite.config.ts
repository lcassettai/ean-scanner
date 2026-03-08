import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['pwa-icon.svg'],
      manifest: {
        name: 'EAN Scanner',
        short_name: 'EAN Scanner',
        description: 'Escáner de códigos EAN para inventario',
        theme_color: '#22c55e',
        background_color: '#f0fdf4',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: 'pwa-icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        navigateFallback: 'index.html',
        runtimeCaching: [
          {
            // Las llamadas a la API van siempre a la red; el app ya maneja offline con localStorage
            urlPattern: /^\/api\//,
            handler: 'NetworkOnly',
          },
          {
            // El viewer intenta red primero, si no hay cae en caché
            urlPattern: /^\/i\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'viewer-cache',
              expiration: { maxEntries: 20, maxAgeSeconds: 3600 },
            },
          },
        ],
      },
    }),
  ],
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
      '/i':   'http://localhost:3001',
    },
  },
})
