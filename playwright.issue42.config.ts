import {defineConfig} from '@playwright/test'
export default defineConfig({testDir:'./e2e-v14',testMatch:'issue42-v14.spec.ts',workers:1,retries:0,timeout:30000,use:{baseURL:process.env.ISSUE42_BASE_URL??'http://127.0.0.1:4194',viewport:{width:360,height:800},locale:'ja-JP',timezoneId:'Asia/Tokyo',trace:'retain-on-failure',screenshot:'only-on-failure'},reporter:[['list'],['json',{outputFile:(process.env.ISSUE42_EVIDENCE_DIR??'evidence/issue42-v14')+'/e2e-results.json'}]],outputDir:'test-results-issue42'})

