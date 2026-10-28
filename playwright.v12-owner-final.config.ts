import {defineConfig} from '@playwright/test'
import base from './playwright.owner-fixes.config'
process.env.V12_EVIDENCE_ROOT='evidence/issue30-v12/final-01-07/regression'
export default defineConfig({...base,testMatch:['owner-v12-01.spec.ts','owner-v12-07.spec.ts','issue30-v12.spec.ts'],grep:/V12-01|V12-07|TOP two projections|REGION current|specific repeated|uncompleted Entry execution|Extra AND/,reporter:[['list'],['json',{outputFile:'evidence/issue30-v12/final-01-07/results.json'}]]})
