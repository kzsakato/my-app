import { defineConfig } from 'vitest/config'
export default defineConfig({ test: { environment: 'node', include: ['tooling/staging/**/*.test.ts'] } })
