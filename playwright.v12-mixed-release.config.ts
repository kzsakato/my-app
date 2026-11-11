import {defineConfig} from '@playwright/test'
import base from './playwright.owner-fixes.config'
const dir='evidence/issue30-v12/mixed-sort-release'
process.env.V12_MIXED_EVIDENCE=dir
process.env.V12_OWNER_EVIDENCE=dir+'/regression'
process.env.V12_EVIDENCE_ROOT=dir+'/regression'
export default defineConfig({...base,testMatch:['owner-v12-mixed.spec.ts','owner-v12-sort.spec.ts','owner-v12-01.spec.ts','owner-v12-07.spec.ts','issue30-v12.spec.ts'],grep:/QA [ABCD]|V12-sort diagnosis|V12-01|V12-07|TOP two projections|REGION current|specific repeated|uncompleted Entry execution|Extra AND/,outputDir:'test-results-v12-mixed-release',reporter:[['list'],['json',{outputFile:dir+'/results.json'}]]})
