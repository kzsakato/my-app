import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { execFileSync } from 'node:child_process'
import { canonicalBackupFixture } from './src/canonical/fixtures'
import { readFileSync } from 'node:fs'

const sha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
export default defineConfig({
  base: '/', publicDir: false,
  define: {
    __BUILD_IDENTIFIER__: JSON.stringify(`V1.2 MAN候補・ダミー専用 / ${sha.slice(0, 8)}`),
    'import.meta.env.VITE_V1R11_CANDIDATE': JSON.stringify('true'),
    'import.meta.env.VITE_V1R11_ORIGIN': JSON.stringify('http://localhost:4182'),
  },
  plugins: [
    { name: 'local-only-entry', enforce: 'pre',
      transformIndexHtml: { order: 'pre', handler: html => html.replace('/src/main.tsx', '/tooling/v12-local/main.ts').replace('<title>筋トレ消化チェック</title>', '<title>V1.2 MAN候補・ダミー専用</title>') },
      transform(code, id) {
        if (!id.replaceAll('\\', '/').endsWith('/src/data.ts')) return
        if (!code.includes("'training-check-v1r11-candidate'")) throw new Error('Local adapter source mismatch')
        return code.replace("'training-check-v1r11-candidate'", "'training-check-v12-local-man'")
      },
    },
    react(),
    VitePWA({ injectRegister: false, manifest: {
      id: '/v12-local-man', name: 'V1.2 MAN候補・ダミー専用', short_name: 'V12ダミー',
      start_url: '/', scope: '/', display: 'standalone', lang: 'ja', theme_color: '#326a41', background_color: '#f4f7f2',
      icons: [192,512].map(size => ({ src: `/icon-${size}.png`, sizes: `${size}x${size}`, type: 'image/png', purpose: 'any' })),
    }, workbox: { cacheId: 'v12-local-man', cleanupOutdatedCaches: false, clientsClaim: false, skipWaiting: false,
      globPatterns: ['**/*.{js,css,html,png}'], navigateFallback: '/index.html' } }),
    { name: 'dummy-icon', generateBundle() {
      for (const size of [192,512]) this.emitFile({ type: 'asset', fileName: `icon-${size}.png`, source: readFileSync(`tooling/v12-local/icon-${size}.png`) })
      const backup = structuredClone(canonicalBackupFixture) as any
      backup.payload.exercises[0].name = 'MAN専用ダミー'
      backup.payload.displayPreferences = { defaultSort: { priority: ['invalid'] }, optionSort: null, bodyRegionOrder: 123 }
      this.emitFile({ type: 'asset', fileName: 'dummy-backup-warning.json', source: JSON.stringify(backup, null, 2) })
    } },
  ],
  build: { outDir: 'dist-v12-local', emptyOutDir: true },
})
