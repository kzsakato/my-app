import {defineConfig} from '@playwright/test'
import base from './playwright.owner-fixes.config'
export default defineConfig({...base,testMatch:['owner-v12-mixed.spec.ts','owner-v12-sort.spec.ts'],outputDir:'test-results-mixed',reporter:[['list'],['json',{outputFile:'evidence/issue30-v12/mixed-sort-fix/results.json'}]]})
