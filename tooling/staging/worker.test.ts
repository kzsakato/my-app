import { it, expect, vi } from 'vitest'
vi.mock('./.generated/initializer.txt', () => ({ default: '/* gated tool */' }))
import worker, { permitted } from './worker'
import { createHash } from 'node:crypto'
const token='a'.repeat(64)
const env={PREP_RUN:'test',PREP_EXPIRES:'2026-10-05T00:00:00Z',PREP_TOKEN_HASH:createHash('sha256').update(token).digest('hex'),ASSETS:{fetch:vi.fn(async()=>new Response('product'))}}
const request=(headers:Record<string,string>={})=>new Request('https://staging.example/__staging/authorize',{method:'POST',headers:{Origin:'https://staging.example',Authorization:`Bearer ${token}`,...headers}})
it('requires run, expiry, same origin and matching server-side hash',async()=>{
 const now=Date.parse('2026-10-04T00:00:00Z')
 expect(await permitted(request(),env,now)).toBe(true)
 for(const modified of [{...env,PREP_RUN:''},{...env,PREP_EXPIRES:'bad'},{...env,PREP_TOKEN_HASH:''}])expect(await permitted(request(),modified,now)).toBe(false)
 expect(await permitted(request(),env,Date.parse(env.PREP_EXPIRES))).toBe(false)
 expect(await permitted(request({Origin:'https://evil.example'}),env,now)).toBe(false)
 expect(await permitted(request({Authorization:'Bearer '+ 'b'.repeat(64)}),env,now)).toBe(false)
})
it('revoked tool and API cannot be fetched; ordinary assets unaffected',async()=>{
 const closed={...env,PREP_TOKEN_HASH:''}
 expect((await worker.fetch(request(),closed)).status).toBe(403)
 expect((await worker.fetch(new Request('https://staging.example/__staging/initializer'),closed)).status).toBe(403)
 const shell=await worker.fetch(new Request('https://staging.example/__staging/prepare.html'),closed)
 expect(shell.headers.get('Cache-Control')).toContain('no-store');expect(await shell.text()).not.toContain('gated tool')
 expect(await(await worker.fetch(new Request('https://staging.example/'),closed)).text()).toBe('product')
})
it('server alone fixes purpose; unknown purposes fail closed', async () => {
 const current = { ...env, PREP_EXPIRES: new Date(Date.now() + 60000).toISOString() }
 for (const purpose of [undefined, 'fresh', 'h14-recovery']) {
  const response = await worker.fetch(request(), { ...current, PREP_PURPOSE: purpose })
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({ run: 'test', purpose: purpose ?? 'fresh' })
 }
 expect((await worker.fetch(request(), { ...current, PREP_PURPOSE: 'guess' })).status).toBe(403)
})
