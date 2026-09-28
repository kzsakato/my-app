import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const buildDate = (process.env.VITE_BUILD_DATE ?? new Date().toISOString()).slice(0, 10)
const buildSha = (process.env.VITE_BUILD_SHA ?? process.env.GITHUB_SHA ?? 'local').slice(0, 8)

export default defineConfig({
  base: './',
  define: {
    __BUILD_IDENTIFIER__: JSON.stringify(`Build ${buildDate} / ${buildSha}`),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: '筋トレ消化チェック',
        short_name: '筋トレチェック',
        start_url: '.',
        display: 'standalone',
        theme_color: '#326a41',
        background_color: '#f4f7f2',
        lang: 'ja'
      }
    })
  ]
})
