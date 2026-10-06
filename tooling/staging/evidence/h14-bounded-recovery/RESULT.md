# H-20261006-14 bounded recovery implementation — 2026-10-06

RESULT: App Development tooling implementation / local automation PASS. Owner execution and V1R Close remain HOLD.

Inputs: training-project main `0d631cc8de4c2d706e46ffb6fd19585658a7aa4d`, H-14 Data decision and Technical existing preparation recovery review. Product baseline remains `118ff493838fa35aa0a80e88532d8731e4005c38`, not current tooling HEAD or a reconstructed earlier session.

## Implementation

- Explicit server `PREP_PURPOSE=h14-recovery`; default/omitted purpose remains `fresh`. Unknown purposes fail closed. Client pins run/purpose and reauthorizes before canonical persistence.
- Fresh still requires accepted `base` equality. Recovery requires valid persisted legacy v6, authority false, absent canonical/baseline/recovery/receipt. Full legacy validator and equality with ordinary startup payload must pass. Missing source cannot use default base as evidence of persisted legacy.
- Existing cutover saves legacy as immutable baseline; no `state/app` delete/write. The existing deterministic fixture, Profile weight 66, Monday 0, three approved Masters/Items, three initial setting changes, MenuProposal and explicit activation are unchanged. Sessions start empty. Legacy Profile/IDs/Category/Menu/Session/history are not imported.
- Exact completed same-run/purpose receipt is verification-only. Partial/dirty/mismatched/revoked state stops without guessed repair. Completion also checks the unchanged legacy source.
- Product runtime/schema/migration/SW source untouched. No remote deployment or Owner run issued.

## Verification

| Check | Result |
| --- | --- |
| `node tooling/staging/build.mjs` | PASS; accepted source guard, initializer build, accepted JS hash |
| `pnpm exec tsc -p tooling/staging/tsconfig.json` | PASS |
| `pnpm exec vitest run --config tooling/staging/vitest.config.ts` | 48 PASS: prepare 44, Worker 3, diagnostic Worker 1 |
| `verify-recovery-local.mjs` with Wrangler 4.147.0 | PASS, actual local workerd + Chromium/IndexedDB |
| Accepted Product source diff against 118ff493 | Empty |
| HTTP read-only Staging/Production integrity | All 8 Staging and 6 Production artifact hashes unchanged; unauthenticated preparation endpoints 403 |

Unit checks include non-base valid v6 with legacy Session/history, identical final fixture versus fresh, exact JSON baseline and unchanged legacy, default fresh rejection, dirty/partial/authoritative/missing-source/invalid-reference rejection, changed gate and changed completed legacy, and 12 recovery persist/read-back/mismatch failure cases. Pre-authority failures retain protected legacy; later-stage failures retain canonical authority and do not retry repair.

Browser checks use only a synthetic isolated partition. Genuine `state/app` starts with a deliberately different legacy Profile, Master, Category, Item, Menu, Entry, Session and history. Read-back proves exact `JSON.stringify` baseline (not raw IndexedDB binary bytes), no legacy contamination and no state/app changes. Duplicate instrumentation counts zero IndexedDB mutations and zero localStorage receipt writes. An already-loaded client stops after real server capability revocation. After revocation, the eight unchanged accepted assets render canonical Settings with トレーナー連携 and without カテゴリ; active menu and all stored data persist over reload and browser process restart.

Evidence: `local-evidence.json`, `remote-readonly.json`. No Owner payload, capability, token or browser profile is included.

Harness corrections during verification: the initial test navigated to the same URL with only a new fragment, which did not rerun the shell; explicit document navigation fixed the harness. The final SW delivery probe initially expected a usable Product UI at the nested preparation path; accepted relative asset paths instead leave the intercepted Product shell unable to load normally. The corrected probe asserts the SW response and intercepted Product HTML, not a usable preparation/UI. Neither initial harness failure is counted as PASS.

## Delivery boundary / next routing

This is local execution of the accepted Staging artifact, **not a recovery deployment to the public Staging origin** or Owner PREPARED. Remote recovery mode + revocation still needs a separately routed deployment check. No QA role or Owner MAN PASS is claimed.

With the unmodified accepted SW already controlling the partition, local automation reproduced `/__staging/prepare.html` being answered by SW with Product HTML instead of the preparation shell (relative assets at the nested path then fail). The diagnosed Owner partition already had an active SW. Consequently the current preparation link is not an approved/proven delivery path for that partition. The prior temporary diagnostic-path exception does not cover preparation. Do not ask Owner to clear storage, unregister SW, perform shell actions or retry links.

Return to PMO / Technical / QA: review this implementation, then specify the minimal Staging-only delivery/revocation/rollback boundary for an SW-controlled Owner partition and route the real Staging automation check before a distinct Owner run. Owner same-partition PREPARED + revoked ordinary canonical confirmation and any required MAN remain pending. Production main was read-only verified as `d4e5c09b1dd3119d58a3d8e6c4fc74e907e4a288`; no Production action occurred.
