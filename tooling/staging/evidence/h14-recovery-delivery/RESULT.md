# H-14 recovery prepare SW delivery — 2026-10-06

RESULT: implementation complete / local lifecycle PASS twice / remote lifecycle STOP / cleanup and accepted restoration PASS. **No Owner run issued; not OWNER PREP READY. V1R Close HOLD.**

Authority: GitHub training-project `ad12057`, H-20261006-14 Technical Advisor recovery prepare page SW delivery review. App remains a separate repository. Product baseline stays `118ff493838fa35aa0a80e88532d8731e4005c38`.

## Implementation

`build-recovery-delivery.mjs` verifies accepted source and all eight dist hashes, creates a separate ignored temporary artifact and changes only `sw.js`'s NavigationRoute denylist to anchored `/__staging/prepare.html`. Other seven files remain byte-identical. Diagnostic/query/descendant/API navigation paths are not excluded. Original Product source, accepted dist, canonical logic and schema are unchanged.

The existing Worker/gated initializer and bounded recovery mode are reused. `verify-recovery-delivery.mjs` tests local workerd and real Staging with distinct isolated persistent synthetic-data profiles. Issuer and HTTP-only capability checker are prepared for a future Owner gate but were **not invoked**. Operations/revoke/restore instructions: `tooling/staging/RECOVERY_DELIVERY.md`.

## Results and limits

| Check | Result |
| --- | --- |
| initializer and temporary delivery build | PASS; only SW differs |
| tooling TypeScript / unit tests | PASS / 48 PASS; Worker 3 rerun with explicit recovery expiry boundary PASS |
| local workerd/Chromium full lifecycle | PASS twice; each update and restore used one ordinary navigation cycle |
| remote accepted SW -> temporary shell | PASS, second run two ordinary navigation cycles |
| delivery data preservation | PASS: full IndexedDB/localStorage/sessionStorage equal |
| exact-path scope / POST / bearer / Origin / purpose | PASS |
| remote bounded recovery / duplicate | PREPARED / zero-write PASS |
| server capability revocation | PASS: old automation token receives 403 on authorize and initializer |
| browser revisit after revocation, before restore | **FAIL**: expected STOP text not observed within 30 seconds |
| accepted restore after failure | PASS, version `16113452-360a-455d-a98b-bfd780ddb350`, all eight hashes |
| existing automation profile after restore | PASS: normal SW convergence in one cycle; preparation path intercepted by accepted SW; canonical Settings, reload, process restart and full storage equality |
| Production hashes / deployment / main | unchanged: deployment 6828068757, main d4e5c09b1dd3119d58a3d8e6c4fc74e907e4a288 |
| Owner run / Owner partition | not issued / not accessed |

Local harness initially over-asserted zero writes over ordinary legacy Product startup, which contains an existing same-value autosave. The harness now checks the exact autosave payload and all final storage values, and requires zero writes from the subsequent shell/probe itself. No fixture/storage manipulation is used to achieve delivery once measurements start. A local network-idle wait was replaced with DOM-content-loaded plus explicit shell/SW response checks; two subsequent complete runs passed. No forced SW update/unregister, cache clear or site-data delete was used.

The first remote attempt did not account for deployment propagation; its cleanup immediately received the previous temporary SW hash and masked the original exception. `first-remote-attempt.md` records this as non-PASS. The second attempt added two consecutive bounded asset/gate readiness checks and retained error evidence. It proved server revocation but again did not complete the browser STOP-display checkpoint. **The missing STOP text does not prove revocation failure, data loss, or a specific SW bug.** Browser response/DOM at that failure was not captured sufficiently to establish its cause. Do not turn that unknown into an Owner workaround or relabel the complete remote suite PASS.

On the failed run, server close and accepted restore were executed automatically. Separate `verify-recovery-restoration.mjs` then used the same synthetic persistent profile, verified the saved old bearer denied, accepted SW convergence, legacy/baseline agreement, canonical authority and ordinary canonical UI/reload/restart. Storage equality here covers the post-cleanup verification interval; a full snapshot at the failed revisit itself was not retained. Owner storage was never inspected or changed.

## Evidence / routing

- `local-first.json`, `local-repeat.json`: local full lifecycle PASS.
- `temporary-manifest.json`: exact temporary artifact hashes.
- `remote-failed.json`: second remote failure and deployment/readiness records.
- `restoration.json`: subsequent restore/canonical/Production verification.
- `first-remote-attempt.md`: first attempt limitations and cleanup.

Current public Staging is accepted Product/SW with preparation capability closed, not the temporary artifact. Further remote mutation is stopped; Owner receives no preparation URL. Return to PMO / Technical / QA to classify the post-revocation browser checkpoint and scope the next automation diagnostic (capture navigation response, DOM and SW state at failure without changing Product/Owner storage). Independent QA or Owner MAN acceptance is not claimed.
