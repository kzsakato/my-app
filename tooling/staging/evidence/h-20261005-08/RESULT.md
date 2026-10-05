# H-20261005-08 — controlled Staging advancement

Return date: 2026-10-06 JST. Executor: App Development / Test Execution.
RESULT: **OWNER VISIBLE CHECK READY. Not MAN READY; Owner Android confirmation remains pending.**

- Authority: training-project H-20261005-08 and QA H-07 PASS; refreshed GitHub main a2c0c41 / AI_BRIEF v20 on Oct 6.
- Accepted Product: `d34b3927d63c66e60d68f1350d040725402a70b3`; H06 artifact manifest at evidence head afeba31.
- Tooling advancement: `515d528` on `codex/h-20261005-08-staging`. Only accepted SHA/asset hash/expected visible Build references advanced. Product source, worker/client/prepare runtime, wrangler gate config, schema and authority remain unchanged.
- Ordinary Staging: https://my-app-staging.kzsakato-lab.workers.dev/
- Deployed Worker: `bd649a96-a99d-4a03-8e07-873deebdf0b1`, deployed Oct 5 JST. Visible Build: `2026-10-05 / d34b3927`.
- Gate remained CLOSED throughout: empty run/hash/expiry. No new Owner or automation preparation capability issued, no initializer execution, no Owner storage access/reset/reinstall.

## Verification

Before deploy, existing prepared automation profile passed ordinary canonical/read-back/reload/restart checks on 687716d1 (`pre-update.json`). This profile is explicitly not the Owner Android partition.

All eight local Product files matched the H06 accepted release manifest. Initializer byte hash before/after rebuild was identical: `02bc088861ea0add5cb9705e75af6e93e9b97094dde73e81ab5f334690e137d1`. Tooling build and TypeScript PASS; tooling unit tests 20/20 PASS. No Product rebuild or Product changes were needed.

Post-deploy `verify-update.mjs` used the SAME persistent automation profile, without initializer, unregister, cache deletion, forced registration update, or storage reset. On Oct 6, the initial document already loaded the new JS; one ordinary reload was performed. Full canonical/baseline/authority/receipt matched the pre-existing prepared read-back exactly (SHA-256 `323e4c462d8ffd20a51dada4c77b312b038288cea99be0e7538462b81321b8d9`). Instrumented IndexedDB mutations: zero. Preparation requests: zero. Settings shows new Build, Trainer and no legacy Category. See `update-evidence.json` and `settings.png`.

`verify.mjs revoked` then PASS: all eight HTTPS artifact hashes (including SW), unauthorized and old Owner-token authorize/initializer 403, source/project/secret/missing-asset 404, same-origin root SW scope, Monday control, existing active menu, exact full state across reload and browser process restart (`post-update.json`, `provenance.json`). This only probes the old Owner token over HTTP; it does not execute that Owner run in automation.

Production Pages deployment remains 6828068757 / d4e5c09b1dd3119d58a3d8e6c4fc74e907e4a288. Root HTML, referenced JS/CSS/registerSW/manifest and SW hashes equal before/after. Kikuzo HTTP200/body hash unchanged (`pre-deploy-integrity.json`, `post-deploy-integrity.json`).

## Initial probe failures and proof limits

Oct 5 immediately after deployment, first strict HTTP probe failed on index.html; subsequent HTTP checks matched the accepted candidate. The next ordinary browser probe still displayed old Build. An initial verify-update attempt also failed its visible Build check, and read-only cache inspection showed the old revision/old JS still cached. These were not counted as PASS and no reset was used to hide them. On Oct 6 the same profile naturally loaded the new JS and all checks passed. The exact timing/cause of the browser's delayed SW update has not been isolated; do not claim that a single reload always guarantees an immediate candidate switch on every device.

The continuity proof plus unchanged storage/runtime contract supports retaining the already-prepared Owner partition from H-11 (`H-20261005-owner-android-02/ccac1a88`, ordinary checks previously reported all OK). It does not directly inspect Android or certify its current visible Build. Owner must confirm the next checkpoint; PC PASS must not substitute for that result.

## Exact next Owner action

In the SAME normal Android Brave partition used for H-11, open ordinary Staging (not a preparation link). If it is already open, perform one ordinary reload. In Settings check Build `2026-10-05 / d34b3927`, Trainer present and legacy Category absent; confirm existing menu/data remain. Report `Build一致・設定OK・既存データOK` or the mismatch. If old Build remains after the ordinary reload, report the displayed Build and stop; no reset, reinstall, repeated preparation or diagnosis requested.

RETURN TO PMO / WAIT FOR Owner visible confirmation. No new exploratory MAN requested; MAN READY remains PMO/QA's later decision.
