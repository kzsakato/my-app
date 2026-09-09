import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
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
