import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    svelte(),
    VitePWA({
      // Conservamos un service worker propio (background-sync + outbox)
      // pero dejamos que Workbox inyecte el precache-manifest con los hashes de Vite.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      // El registro se hace manualmente en main.ts (registerSW).
      injectRegister: false,
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2}'],
      },
      manifest: {
        name: 'VEF',
        short_name: 'VEF',
        description: 'Sistema de ventas VEF',
        lang: 'es',
        theme_color: '#f4b400',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      // Durante la migración (fases 1-5) el SW queda inactivo en dev para no
      // interferir con el HMR. Se activa al portar la PWA (fase 6).
      devOptions: { enabled: false },
    }),
  ],
  server: {
    proxy: {
      // El dev-server de Vite (5173) reenvía las llamadas /api a uvicorn (8765).
      '/api': {
        target: 'http://127.0.0.1:8765',
        changeOrigin: true,
      },
    },
  },
})
