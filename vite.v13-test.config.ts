import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const path = '/v13-test/'

export default defineConfig({
  base: path,
  define: {
    __BUILD_IDENTIFIER__: JSON.stringify(`V1.3 検証 / ${(process.env.GITHUB_SHA ?? 'local').slice(0, 8)}`),
    'import.meta.env.VITE_V13_ISOLATED': JSON.stringify('true'),
  },
  build: { outDir: 'dist-v13-test' },
  plugins: [
    react(),
    VitePWA({
      injectRegister: false,
      manifest: {
        id: path,
        name: '筋トレ消化チェック V1.3 検証',
        short_name: 'V1.3 検証',
        start_url: path,
        scope: path,
        display: 'standalone',
        lang: 'ja',
      },
      scope: path,
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'v13-worker.js',
      injectManifest: { globPatterns: ['**/*.{html,js,css,webmanifest}'] },
    }),
  ],
})
