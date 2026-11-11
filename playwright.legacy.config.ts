import { defineConfig } from '@playwright/test'
import current from './playwright.config'

export default defineConfig({
  ...current,
  grepInvert: undefined,
  grep: /(?:^|\s)@legacy-v1r-menu-proposal(?:\s|$)/,
  outputDir: 'test-results-legacy',
  reporter: [['list'], ['html', { outputFolder: 'playwright-report-legacy', open: 'never' }], ['json', { outputFile: 'test-results-legacy/results.json' }]],
})
