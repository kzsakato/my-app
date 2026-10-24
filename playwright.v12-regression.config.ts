import { defineConfig } from '@playwright/test'
import base from './playwright.v12.config'
process.env.ISSUE28_EVIDENCE_ROOT = 'evidence/issue30-v12/regression'
export default defineConfig({ ...base,
  testMatch: 'issue28.spec.ts',
  outputDir: 'test-results-v12-regression',
  reporter: [['list'], ['json', { outputFile: 'test-results-v12-regression/results.json' }]],
  projects: [
    { name: 'desktop', use: { browserName: 'chromium', viewport: { width: 1280, height: 900 } } },
    { name: 'narrow-pc-emulation', use: { browserName: 'chromium', viewport: { width: 360, height: 800 } } },
  ],
})
