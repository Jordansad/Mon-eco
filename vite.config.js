import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// Déployé sur GitHub Pages : https://jordansad.github.io/Mon-eco/
// L'app n'est pas à la racine du domaine, d'où le sous-chemin ci-dessous
// (voir README.md, section Déploiement, si tu changes de dépôt/domaine).
const BASE_PATH = '/Mon-eco/';

export default defineConfig({
  base: BASE_PATH,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/apple-touch-icon.png'],
      manifest: {
        name: 'Mon Budget',
        short_name: 'Budget',
        description: 'Suis ton solde, ton patrimoine et tes objectifs d’épargne, en ligne comme hors ligne.',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'portrait',
        start_url: BASE_PATH,
        scope: BASE_PATH,
        lang: 'fr',
        icons: [
          {
            src: 'icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        cleanupOutdatedCaches: true,
        navigateFallback: 'index.html',
      },
      devOptions: {
        enabled: true,
      },
    }),
  ],
});
