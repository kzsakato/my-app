# Issue #35 — V1.3 Service Worker guard

Authority: https://github.com/kzsakato/training-project/issues/35#issuecomment-6683606650
PR #9 baseline: 8f2f15ca49660cf7fb4cb552db42f66b4530b046.

The V1.3 worker rejects registration before installing handlers unless its actual scope and script URL both match the existing /v13-test/ build. The worker validates precache URLs before registering handlers, then permits GET navigation fallback only within the exact same-origin path prefix. It serves only allowlisted asset URLs and removes only stale cache names in its dedicated namespace.

Unit tests evaluate the actual worker source in a Node VM with mocked events, Cache Storage and fetch. Fifteen tests cover wrong scopes/script, primary/sibling/cross-origin and traversal paths, out-of-scope manifest entries, non-GET, unlisted assets, same-scope fallback, cache misses, and cleanup ownership. All 188 unit tests passed, including seven additional MIG-01 initial Backup preview cases. The isolated V1.3 build and manifest injection succeeded. The Service Worker guard was tested only at unit level. Browser validation is scheduled for V1.3 → V1.4. ENV-04/05 remains blocked for the previous fixed-root first-navigation scenario.

Existing CI run 42204258305: normal 77 PASS / 42 FAIL, release 10 PASS / 36 FAIL. The H12 read-back failure test now uses a valid managementMode fixture and confirms the existing warning before fault injection. Other existing CI failures remain separate from this guard result. No fixed V1.2 artifact, Chrome data, or deployment changes.

Targeted normal H12 E2E: 2/2 PASS. This suite does not load the V1.3 isolated worker.
