import { defineConfig } from '@playwright/test'
process.env.V12_EVIDENCE_ROOT = 'evidence/issue30-v12/connection'
export default defineConfig({
  testDir: './e2e', testMatch: 'issue30-v12.spec.ts', workers: 1, retries: 0,
  outputDir: 'test-results-v12',
  reporter: [['list'], ['json', { outputFile: 'test-results-v12/results.json' }]],
  use: { baseURL: 'http://127.0.0.1:4177', locale: 'ja-JP', timezoneId: 'Asia/Tokyo', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'pc', use: { browserName: 'chromium', viewport: { width: 1280, height: 900 } } },
    { name: 'narrow-pc-emulation', use: { browserName: 'chromium', viewport: { width: 360, height: 800 } } },
  ],
  webServer: { command: 'pnpm exec vite --config vite.candidate.config.ts --configLoader runner', url: 'http://127.0.0.1:4177', reuseExistingServer: false },
})
