import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const candidateOrigin = process.env.VITE_V1R11_ORIGIN ?? 'http://127.0.0.1:4177'
if (!['http://127.0.0.1:4177', 'https://my-app-simple-118ff493.kzsakato-lab.workers.dev'].includes(candidateOrigin)) {
  throw new Error('Unapproved V1.1 candidate origin')
}

// Deliberately separate from production's PWA/deployment configuration.
export default defineConfig({
  base: '/',
  publicDir: false,
  define: {
    __BUILD_IDENTIFIER__: JSON.stringify(`V1.1 candidate / ${(process.env.VITE_BUILD_SHA ?? 'local').slice(0, 8)}`),
    'import.meta.env.VITE_V1R11_CANDIDATE': JSON.stringify('true'),
    'import.meta.env.VITE_V1R11_ORIGIN': JSON.stringify(candidateOrigin),
  },
  plugins: [react()],
  build: { outDir: 'dist-v1r11-candidate', emptyOutDir: true },
  server: { host: '127.0.0.1', port: 4177, strictPort: true },
  preview: { host: '127.0.0.1', port: 4177, strictPort: true },
})
