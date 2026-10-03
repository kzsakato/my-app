import { defineConfig, devices } from '@playwright/test'
export default defineConfig({
  testDir: './e2e', testMatch: ['grouped-baseline.spec.ts', 'v1r-acceptance.spec.ts'], fullyParallel: false, workers: 1, retries: 0,
  outputDir: 'test-results-release', reporter: [['list'], ['html', { outputFolder: 'playwright-report-release', open: 'never' }], ['json', { outputFile: 'test-results-release/results.json' }]],
  use: { locale: 'ja-JP', timezoneId: 'Asia/Tokyo', baseURL: 'http://127.0.0.1:4174', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [{ name: 'release', use: { ...devices['Desktop Chrome'] } }],
  webServer: { command: 'pnpm exec vite preview --host 127.0.0.1 --port 4174', url: 'http://127.0.0.1:4174', reuseExistingServer: false },
})
