import { defineConfig } from 'vite'
import local from './vite.v12-local.config'

const origin = process.env.V12_WIFI_ORIGIN
if (!origin) throw new Error('V12_WIFI_ORIGIN is required; no implicit LAN/public origin')
const u = new URL(origin)
const octets = u.hostname.split('.').map(Number)
const privateIP = octets.length === 4 && octets.every(n => Number.isInteger(n) && n >= 0 && n <= 255) &&
  (octets[0] === 10 || (octets[0] === 192 && octets[1] === 168) || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31))
const testOnly = process.env.V12_WIFI_TEST === '1' && u.hostname === '127.0.0.1'
if (u.protocol !== 'https:' || u.port !== '8443' || u.origin !== origin || (!privateIP && !testOnly)) throw new Error('Explicit private IPv4 HTTPS origin on 8443 required')
export default defineConfig({
  ...local,
  define: { ...local.define, 'import.meta.env.VITE_V1R11_ORIGIN': JSON.stringify(origin) },
  plugins: [
    { name: 'wifi-origin-entry', enforce: 'pre', transform(code,id) {
      if (id.replaceAll('\\','/').endsWith('/tooling/v12-local/main.ts')) {
        if (!code.includes('http://localhost:4182')) throw new Error('WiFi bootstrap mismatch')
        return code.replaceAll('http://localhost:4182', origin).replace('検証用localhost以外','検証用HTTPS origin以外')
      }
    }, generateBundle() { this.emitFile({ type:'asset',fileName:'wifi-build.json',source:JSON.stringify({origin,testOnly,db:'training-check-v12-local-man',pwaId:'/v12-local-man'}) }) } },
    ...(local.plugins ?? []),
  ],
  build: { ...local.build, outDir:'dist-v12-wifi' },
})
