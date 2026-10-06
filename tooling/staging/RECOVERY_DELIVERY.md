# H-14 temporary recovery preparation delivery

Authority: H-20261006-14 Technical Advisor recovery prepare page SW delivery review (2026-10-06). The temporary shim is limited to Staging `/__staging/prepare.html` navigation. Product baseline remains 118ff493. It is not a new Product candidate, generic recovery mechanism or authorization to reset Owner storage.

## Build and prove the full lifecycle

```powershell
node tooling/staging/build.mjs
node tooling/staging/build-recovery-delivery.mjs
pnpm exec tsc -p tooling/staging/tsconfig.json
pnpm exec vitest run --config tooling/staging/vitest.config.ts
node tooling/staging/verify-recovery-delivery.mjs local <absolute-wrangler-4.147.0-package-path>
node tooling/staging/verify-recovery-delivery.mjs remote <absolute-wrangler-4.147.0-package-path>
```

The build checks accepted source/dist, copies eight files into ignored `.generated/recovery-dist`, and changes only the SW NavigationRoute denylist with an anchored exact pathname expression. Query variants, descendants, diagnostic, initializer and authorize navigation remain outside the exception. Shell/API are the existing Worker; initializer and authorize remain same-origin POST + bearer + expiry + server purpose gated, no-store and outside precache.

Local and remote tests each create an isolated persistent automation profile. Synthetic legacy fixture creation happens before delivery measurements. The old accepted SW must control and intercept the preparation URL first. The test then uses only ordinary Product navigation and a bounded wait for the temporary SW, proves a network-served preparation shell and exact-path scope, and checks all IndexedDB and Web Storage values unchanged. Accepted legacy Product startup performs its existing identical-value `saveData` autosave; that operation is counted and its entire serialized value checked. The shim and preparation shell with no capability perform no storage writes. The harness does not force SW update/unregister or clear caches/site data. Normal SW installation/cache housekeeping is not suppressed.

The remote command temporarily deploys `my-app-staging` only, with an automation capability held in process memory and ignored generated configuration. It runs bounded recovery, zero-write duplicate, revokes on the server while retaining the temporary SW, tests the old bearer, restores accepted assets, and proves ordinary accepted SW/canonical reload/restart. Production hashes, deployment and main must stay equal. Failed remote verification closes capability and restores accepted artifact before returning failure. A failed convergence/data-integrity result is STOP, never permission to experiment on Owner Android.

Remote deploy completion is followed by bounded HTTP readiness checks: require two consecutive matching asset/gate observations before browser verification. The automation bearer is also retained in ignored `.generated/recovery-remote-automation-capability.local.json` for revocation proof after a failed process. After cleanup, `node tooling/staging/verify-recovery-restoration.mjs` checks the saved automation profile, old automation bearer and Production without issuing a new run. It does not execute the initializer.

Current 2026-10-06 disposition: local lifecycle passed twice. Remote preparation and zero-write duplicate passed, but the post-revocation preparation revisit did not show the expected STOP within 30 seconds. The exact browser cause was not captured. Server revocation and accepted restore were subsequently verified separately. Overall remote lifecycle is not marked PASS; **Owner run issuance remains HOLD** pending H-14 routing. The following Owner procedure is prepared for a later successful gate, not authorization to bypass this unresolved result.

Evidence is generated under `.generated/recovery-delivery-{local,remote}-evidence.json`; raw browser profiles/configuration remain ignored. Preserve reviewed summaries under `evidence/h14-recovery-delivery`. Automation PREPARED is never Owner PREPARED or independent QA acceptance.

## Distinct Owner run, only after automation PASS

```powershell
node tooling/staging/issue-recovery-run.mjs H-20261006-owner-android-h14-01 24
npx --yes wrangler@4.147.0 deploy --config tooling/staging/recovery-run.local.json
node tooling/staging/check-recovery-capability.mjs open temporary
```

The issuer fixes purpose `h14-recovery` and the temporary artifact. It stores the capability locally without printing its token and refuses to overwrite an unexpired saved recovery capability. Do not execute that capability in PC/automation. Before handing it to Owner, verify server purpose/run and all temporary manifest hashes through HTTP, with no fixture mutation. The saved local capability must remain available for immediate revocation checks.

Return OWNER PREP READY, not MAN READY. Owner uses the same affected Android normal Brave partition: open ordinary Staging, wait about ten seconds for normal SW update, then open the distinct preparation link once. Ask for device/browser and the displayed PREPARED run/attempt ID. STOP, blank or Product screen means stop and report that display; do not ask for retries, technical SW actions, storage clearing or PC substitution. A capability expires after at most 24 hours and must not be reused or extended silently.

## On Owner PREPARED: revoke first, then restore

1. Deploy `.generated/recovery-wrangler.json`. It retains the temporary artifact but its run/hash/expiry are empty, closing capability first.
2. Run `node tooling/staging/check-recovery-capability.mjs closed temporary`: POST initializer and authorize with the saved old bearer and correct Origin; require 403 for both. Do not erase the saved capability before this proof.
3. Deploy `tooling/staging/wrangler.json`, then run `node tooling/staging/check-recovery-capability.mjs closed accepted`. This restores accepted eight-file artifact and unmodified SW; confirm every accepted manifest hash. Record both Worker versions.
4. With the existing automation profile, verify ordinary navigation activates accepted SW again, temporary shell is no longer reached, Product storage stays unchanged and ordinary canonical reload/restart works. Do not run the Owner bearer in that profile. Production integrity must remain unchanged.
5. Owner opens ordinary Staging in the same Android Brave partition and confirms Build 2026-10-06 / 118ff493, トレーナー連携 present, カテゴリ absent, and PMO-required MAN checks. Only Owner confirmation establishes that partition's current canonical-ready UI. Keep V1R Close HOLD until the required acceptance checkpoints pass.

On failure/expiry before Owner PREPARED, use the same server close/restore steps and route state classification; no guessed storage repair. Temporary exclusion must not remain as the accepted release artifact.
