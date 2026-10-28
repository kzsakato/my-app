import { defineConfig } from '@playwright/test'
import base from './playwright.v12-regression.config'
process.env.ISSUE28_EVIDENCE_ROOT = 'evidence/issue30-v12/qa-additional/regression'
export default defineConfig({ ...base,
  outputDir: 'test-results-v12-additional-regression',
  reporter: [['list'], ['json', { outputFile: 'test-results-v12-additional-regression/results.json' }]],
})
