import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  testMatch: 'issue35-v13-app.spec.ts',
  outputDir: 'test-results-v13-app',
  use: { baseURL: 'http://127.0.0.1:4183', timezoneId: 'Asia/Tokyo', viewport: { width: 360, height: 800 } },
  webServer: {
    command: 'pnpm exec vite preview --config vite.v13-test.config.ts --host 127.0.0.1 --port 4183 --strictPort',
    url: 'http://127.0.0.1:4183/v13-test/',
    reuseExistingServer: false,
  },
})
