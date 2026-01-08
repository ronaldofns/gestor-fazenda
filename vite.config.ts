import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['logo192.png', 'logo512.png'],
      manifest: {
        name: 'Gerenciador de Fazendas',
        short_name: 'GestorFaz',
        description: 'Sistema de Gestão de Rebanho Bovino',
        start_url: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#ffffff',
        orientation: 'portrait',
        icons: [
          { 
            src: '/logo192.png', 
            sizes: '192x192', 
            type: 'image/png',
            purpose: 'any maskable'
          },
          { 
            src: '/logo512.png', 
            sizes: '512x512', 
            type: 'image/png',
            purpose: 'any maskable'
          }
        ],
        screenshots: [
          {
            src: '/logo512.png',
            sizes: '512x512',
            type: 'image/png',
            form_factor: 'narrow'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024, // 10 MB (aumentado para suportar chunks maiores)
        skipWaiting: false, // Não ativar automaticamente - aguardar confirmação do usuário
        clientsClaim: false, // Não assumir controle imediatamente
        // Escutar mensagens do cliente para ativar service worker
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/_/, /\/[^/?]+\.[^/]+$/],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 // 24 horas
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 ano
              }
            }
          }
        ]
      },
      devOptions: {
        enabled: false,
        type: 'module'
      }
    })
  ],
  server: {
    hmr: {
      protocol: 'ws',
      host: 'localhost',
      port: 5173
    }
  },
  build: {
    chunkSizeWarningLimit: 1000, // Aumenta o limite de aviso para 1 MB
    rollupOptions: {
      output: {
        // Cache busting para assets - usando hash para garantir atualização
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name?.split('.') || [];
          const ext = info[info.length - 1];
          if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(ext)) {
            return `assets/images/[name]-[hash][extname]`;
          }
          if (/woff2?|eot|ttf|otf/i.test(ext)) {
            return `assets/fonts/[name]-[hash][extname]`;
          }
          return `assets/[name]-[hash][extname]`;
        },
        // Code splitting manual para reduzir tamanho dos chunks
        manualChunks: (id) => {
          // Separar node_modules em chunks menores
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom')) {
              return 'vendor-react';
            }
            if (id.includes('supabase')) {
              return 'vendor-supabase';
            }
            if (id.includes('dexie')) {
              return 'vendor-dexie';
            }
            if (id.includes('recharts')) {
              return 'vendor-recharts';
            }
            return 'vendor-other';
          }
        }
      }
    }
  }
});
