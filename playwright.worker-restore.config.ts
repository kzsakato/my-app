import {defineConfig} from '@playwright/test'
export default defineConfig({testDir:'./e2e',testMatch:'worker-restore.spec.ts',workers:1,retries:0,reporter:'list',use:{baseURL:process.env.V12_RESTORE_URL??'http://localhost:4182',locale:'ja-JP',timezoneId:'Asia/Tokyo'},timeout:30000})
