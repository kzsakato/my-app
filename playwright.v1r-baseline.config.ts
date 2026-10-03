import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './e2e', testMatch: 'v1r-baseline.spec.ts', workers: 1,
  outputDir: 'v1r-baseline-results', reporter: [['list']],
  use: { baseURL: 'http://127.0.0.1:4180', viewport: { width: 1020, height: 967 }, deviceScaleFactor: 1, locale: 'ja-JP', timezoneId: 'Asia/Tokyo' },
  webServer: { command: 'pnpm exec vite --host 127.0.0.1 --port 4180', url: 'http://127.0.0.1:4180', reuseExistingServer: false },
})
