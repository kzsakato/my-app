import {defineConfig} from '@playwright/test'
import base from './playwright.v12-owner-final.config'
process.env.V12_EVIDENCE_ROOT='evidence/issue30-v12/mixed-sort-fix/regression'
process.env.V12_OWNER_EVIDENCE='evidence/issue30-v12/mixed-sort-fix/regression'
export default defineConfig({...base,outputDir:'test-results-mixed-regression',reporter:[['list'],['json',{outputFile:'evidence/issue30-v12/mixed-sort-fix/regression-results.json'}]]})
