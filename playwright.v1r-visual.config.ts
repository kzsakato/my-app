import { defineConfig } from '@playwright/test'
import release from './playwright.release.config'
// Owner baseline machine captures are Windows/ja-JP/Asia-Tokyo/1020x967/scale1.
// Run on the same platform; Linux CI's semantic suite is not pixel-equivalent.
export default defineConfig({ ...release, testMatch: 'v1r-visual.spec.ts', outputDir: 'test-results-v1r-visual', reporter: [['list'], ['html', { outputFolder: 'playwright-report-v1r-visual', open: 'never' }], ['json', { outputFile: 'test-results-v1r-visual/results.json' }]] })
