import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: { enabled: true },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'], 
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/qiabbgqqgiukyvntisde\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 7 
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      },
      manifest: {
        name: 'Work Immersion App',
        short_name: 'WI App',
        description: 'Offline-first Work Immersion Tracker',
        theme_color: '#2563EB',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'maskable-pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          },
          {
            src: 'pwa-180x180.png',
            sizes: '180x180',
            type: 'image/png'
          },
          {
            src: 'pwa-32x32.png',
            sizes: '32x32',
            type: 'image/png'
          },
          {
            src: 'pwa-16x16.png',
            sizes: '16x16',
            type: 'image/png'
          }
        ]
      }
    })
  ],
})
