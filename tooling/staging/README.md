# V1R Staging preparation (H-20261004-11)

This tooling serves a fixed production artifact at the release-neutral `my-app-staging` and a separate, gated preparation action. It does not change Product source, register a preparation Service Worker, add an account system, or modify Production Pages/Kikuzo. Product candidate: `118ff493838fa35aa0a80e88532d8731e4005c38`, Build `2026-10-06 / 118ff493`. The earlier `my-app-staging-v1r` is retained with its capability closed for investigation; its browser storage is not reset or migrated. Historical evidence files identify their original origin and are not proof for this new origin.

## Prepare and test

From the app repository root, with the accepted production `dist` present:

```powershell
node tooling/staging/build.mjs
pnpm exec tsc -p tooling/staging/tsconfig.json
pnpm exec vitest run --config tooling/staging/vitest.config.ts
node tooling/staging/issue-run.mjs H-20261004-11-automation 2
npx --yes wrangler@4.147.0 deploy --config tooling/staging/run.local.json
node tooling/staging/verify.mjs prepare
```

Generated bundles, local run configuration/capability, and browser profiles are ignored. Do not commit the capability URL/token or browser profile. Production assets stay in `dist`; the initializer is a Worker text module behind a POST gate, never a public static asset or a PWA precache entry. Rebuilding the initializer does not rebuild or alter production assets.

## Capability boundary

The preparation link contains a 256-bit run bearer in its fragment. The shell sends it only in same-origin Authorization headers, clears the fragment, and displays PREPARED or STOP, with a non-sensitive run/attempt ID on success. The ID is derived from the local completed receipt, not a server assertion about a device. Record the reported device/browser together with this ID; a bare PREPARED cannot establish which browser partition ran the tool. The Worker checks its SHA-256 hash, run ID, expiry, and Origin on every API/bundle request. Hash/run/expiry live in server-side deployment bindings; the reusable source contains no bearer. All preparation responses are `no-store`; the tool cannot register a Service Worker under its CSP.

Before every canonical persistence operation, the loaded client checks the live server gate again. Ordinary Product assets and navigation never request the preparation tool. The preparation page does not link to Product until the operator has closed the run. Once the Product SW controls the origin, its unmodified navigation fallback can show the Product shell for a preparation navigation; this cannot reactivate the revoked API or mutation tool. Initial preparation must therefore precede ordinary Product navigation on this new Staging origin.

Web Locks serialize preparation within one browser partition. A durable staging-only localStorage receipt is marked started before domain mutations; partial/dirty/unknown state always stops. Complete receipts reconstruct the entire expected canonical fixture from App-issued IDs and the original timestamp and require exact canonical/baseline/authority/read-back/restart equality. A duplicate exact completion does not write. There is no automatic repair/reset.

The baseline comes from accepted `loadData()` on a known-clean partition and must equal accepted `base`. Profile `{weight:66}` is the accepted initial Profile weight, with no `analysisStartDate` adoption. Canonical initialization takes Profile explicitly; it has no separate default-Profile API. The fixture uses the existing three-item package, no Front Plank, three canonical initial setting-change records, existing Android proposal, zero Sessions, Monday (`0`), and a separate validated/write/read-back active-menu selection. Menu apply itself does not activate it.

## H-14 explicit bounded recovery mode

The preceding base-equality condition remains mandatory for normal `fresh` runs (also the default for existing configurations). A server-issued `PREP_PURPOSE=h14-recovery` run permits a different, valid, genuinely persisted legacy v6 payload only when authority is false and canonical, baseline, recovery point and preparation receipt are absent. The existing full legacy validator must pass. A completed receipt for this exact run/purpose is verification-only; partial, other-run or changed state stops. The client pins the server run/purpose and checks it again before persistence. Unknown purposes fail closed. Storage contents never promote a fresh run into recovery.

Recovery preserves the full legacy payload in the existing immutable baseline using `cutoverCanonical`; it never writes `state/app`. No legacy Profile, IDs, Category, Menu, Session or history is imported. The canonical candidate and all subsequent approved bootstrap/proposal/activation operations are unchanged. Canonical Sessions start empty; previous Owner MAN Sessions are not reconstructed. Final and duplicate checks also verify that the legacy source still matches its baseline.

`issue-run.mjs` accepts an optional fourth argument `h14-recovery` after run ID and duration. Issuing/deploying an Owner run requires the H-14 routing checkpoint; the automated implementation check does not issue one. In particular, the existing accepted Product SW intercepts `/__staging/prepare.html` navigation on already controlled partitions. H-14's former diagnostic-page exception does not authorize a preparation-page exception. Do not send the current preparation link to Owner as a proven recovery delivery path, reset storage, or change Product SW to work around this boundary.

The later H-14 Technical recovery prepare page SW delivery review authorizes an exact prepare-path exclusion in a **temporary Staging artifact only**, followed by capability revocation and accepted SW restoration. Use [RECOVERY_DELIVERY.md](RECOVERY_DELIVERY.md) for that separately verified lifecycle and distinct Owner run. The Product source and accepted artifact remain unchanged.

Reproduce local recovery automation after the build and unit/type checks above:

```powershell
node tooling/staging/verify-recovery-local.mjs <absolute-path-to-wrangler-4.147.0-package>
```

This uses local workerd, the accepted eight Product assets, real Chromium/IndexedDB and isolated synthetic legacy data. It checks baseline equality, no legacy import/write, zero-write duplicate, purpose pinning, live server revocation, ordinary canonical reload/process restart, and the existing SW delivery limitation. It neither reads Owner capabilities nor deploys to Staging. Its PASS is App Development automation evidence, not Owner PREPARED, QA acceptance or Close.

## Revocation and Owner checkpoint

Deploying the checked-in config closes all mutation capabilities:

```powershell
npx --yes wrangler@4.147.0 deploy --config tooling/staging/wrangler.json
node tooling/staging/verify.mjs revoked
```

The latter uses the saved automation capability and same persistent automation profile. It proves both old-token 403 responses and unchanged ordinary Product data/runtime across browser restart. For an already-loaded-client check, run `verify-live-revocation.mjs` while the automation capability is open; after it reports held, deploy the closed config, then create `.generated/release-revocation-check`. No Owner storage is involved.

Only after automated checks, issue a **different** Owner run (at most 24 hours), deploy `run.local.json`, and hand the single preparation link to Owner Android Brave. Do not execute fixture preparation with that Owner capability in PC/automation browsers; check its server gate without mutation only. The automated preparation scripts reject owner-named runs. Return **OWNER PREP READY**, never MAN READY. Preserve the Owner capability locally for immediate revocation checks after the report; no shell/storage work is assigned to Owner.

On Owner PREPARED: immediately deploy the closed config, prove the current token cannot fetch initializer/authorize, verify ordinary production artifact/SW hashes, and ask Owner to open ordinary Staging in the same Brave partition. Owner must confirm canonical discriminators before QA/PMO accepts MAN READY. On STOP/expiry: do not guess-merge, reuse automation state, or ask Owner to diagnose. Classify and route the bounded test-environment recovery. Production release/merge is outside this tooling.
