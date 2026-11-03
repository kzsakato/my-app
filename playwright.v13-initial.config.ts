import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './e2e', testMatch: 'issue34-v13-initial.spec.ts', workers: 1, retries: 0,
  outputDir: 'test-results-v13-initial',
  reporter: [['list'], ['json', { outputFile: 'evidence/issue34-v13-initial/browser.json' }]],
  use: { baseURL: 'http://127.0.0.1:4179', locale: 'ja-JP', timezoneId: 'Asia/Tokyo', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'pc', use: { browserName: 'chromium', viewport: { width: 1280, height: 900 } } },
    { name: 'touch360-emulation', use: { browserName: 'chromium', viewport: { width: 360, height: 800 }, isMobile: true, hasTouch: true } },
  ],
  webServer: { command: 'pnpm exec vite --host 127.0.0.1 --port 4179 --strictPort --configLoader runner', url: 'http://127.0.0.1:4179', reuseExistingServer: false },
})
