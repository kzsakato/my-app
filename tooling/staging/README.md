# V1R Staging preparation (H-20261004-11)

This tooling serves a fixed production artifact at `my-app-staging-v1r` and a separate, gated preparation action. It does not change Product source, register a preparation Service Worker, add an account system, or modify Production Pages/Kikuzo. Product candidate: `687716d17cebbacae63d91452e6bc01b335c70c5`, Build `2026-10-04 / 687716d1`.

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

The preparation link contains a 256-bit run bearer in its fragment. The shell sends it only in same-origin Authorization headers, clears the fragment, and displays only PREPARED or STOP. The Worker checks its SHA-256 hash, run ID, expiry, and Origin on every API/bundle request. Hash/run/expiry live in server-side deployment bindings; the reusable source contains no bearer. All preparation responses are `no-store`; the tool cannot register a Service Worker under its CSP.

Before every canonical persistence operation, the loaded client checks the live server gate again. Ordinary Product assets and navigation never request the preparation tool. The preparation page does not link to Product until the operator has closed the run. Once the Product SW controls the origin, its unmodified navigation fallback can show the Product shell for a preparation navigation; this cannot reactivate the revoked API or mutation tool. Initial preparation must therefore precede ordinary Product navigation on this new Staging origin.

Web Locks serialize preparation within one browser partition. A durable staging-only localStorage receipt is marked started before domain mutations; partial/dirty/unknown state always stops. Complete receipts reconstruct the entire expected canonical fixture from App-issued IDs and the original timestamp and require exact canonical/baseline/authority/read-back/restart equality. A duplicate exact completion does not write. There is no automatic repair/reset.

The baseline comes from accepted `loadData()` on a known-clean partition and must equal accepted `base`. Profile `{weight:66}` is the accepted initial Profile weight, with no `analysisStartDate` adoption. Canonical initialization takes Profile explicitly; it has no separate default-Profile API. The fixture uses the existing three-item package, no Front Plank, three canonical initial setting-change records, existing Android proposal, zero Sessions, Monday (`0`), and a separate validated/write/read-back active-menu selection. Menu apply itself does not activate it.

## Revocation and Owner checkpoint

Deploying the checked-in config closes all mutation capabilities:

```powershell
npx --yes wrangler@4.147.0 deploy --config tooling/staging/wrangler.json
node tooling/staging/verify.mjs revoked
```

The latter uses the saved automation capability and same persistent automation profile. It proves both old-token 403 responses and unchanged ordinary Product data/runtime across browser restart. For an already-loaded-client check, run `verify-live-revocation.mjs` while the automation capability is open; after it reports held, deploy the closed config, then create `.generated/release-revocation-check`. No Owner storage is involved.

Only after automated checks, issue a **different** Owner run (at most 24 hours), deploy `run.local.json`, and hand the single preparation link to Owner Android Brave. Return **OWNER PREP READY**, never MAN READY. Preserve the Owner capability locally for immediate revocation checks after the report; no shell/storage work is assigned to Owner.

On Owner PREPARED: immediately deploy the closed config, prove the current token cannot fetch initializer/authorize, verify ordinary production artifact/SW hashes, and ask Owner to open ordinary Staging in the same Brave partition. Owner must confirm canonical discriminators before QA/PMO accepts MAN READY. On STOP/expiry: do not guess-merge, reuse automation state, or ask Owner to diagnose. Classify and route the bounded test-environment recovery. Production release/merge is outside this tooling.
