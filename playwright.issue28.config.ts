import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e', testMatch: 'issue28.spec.ts', workers: 1,
  outputDir: 'test-results/issue28',
  reporter: [['list'], ['json', { outputFile: 'test-results/issue28-results.json' }]],
  use: { baseURL: 'http://127.0.0.1:4177', locale: 'ja-JP', timezoneId: 'Asia/Tokyo', screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1024, height: 900 } } },
    { name: 'mobile360', use: { viewport: { width: 360, height: 800 }, isMobile: true, hasTouch: true } },
    { name: 'mobile320', use: { viewport: { width: 320, height: 740 }, isMobile: true, hasTouch: true } },
  ],
  webServer: { command: 'npx vite --config vite.candidate.config.ts --configLoader runner', url: 'http://127.0.0.1:4177', reuseExistingServer: false },
})
