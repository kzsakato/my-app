import { defineConfig } from '@playwright/test'
import base from './playwright.v12.config'
process.env.V12_EVIDENCE_ROOT = 'evidence/issue30-v12/qa-additional'
export default defineConfig({ ...base,
  testMatch: ['issue30-v12.spec.ts', 'issue30-v12-additional.spec.ts'],
  outputDir: 'test-results-v12-additional',
  reporter: [['list'], ['json', { outputFile: 'test-results-v12-additional/results.json' }]],
})
