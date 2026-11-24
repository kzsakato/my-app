import {defineConfig} from '@playwright/test'
import baseline from './playwright.config'
// Reproduce the eight CI failures without changing the historical CI definition.
export default defineConfig({...baseline,
 testMatch:['issue30-v12.spec.ts','issue35-v13-ui.spec.ts','owner-v12-01.spec.ts','v1r-acceptance.spec.ts'],
 grep:/TOP two projections|REGION current|specific repeated|independent sort drafts|touch drag reorders|normal Restore, completed|H-03 focused 4\/5|OIC-008\/009/,
 reporter:[['list'],['json',{outputFile:'evidence/issue42-v14/compat-targeted-results.json'}]],outputDir:'test-results-issue42-compat',
 webServer:[{command:'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4173 --strictPort',url:'http://127.0.0.1:4173',reuseExistingServer:false,env:{VITE_V13_PRODUCTION:'false'}},{command:'node node_modules/vite/bin/vite.js --config vite.candidate.config.ts',url:'http://127.0.0.1:4177',reuseExistingServer:false}]
})
