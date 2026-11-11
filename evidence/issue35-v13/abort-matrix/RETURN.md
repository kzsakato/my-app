# Issue #35 — transaction abort classification

QA #6684917711 and Tech #6684889008. Product source 60f98a7 unchanged. Isolated V1.3 production build on loopback, Chromium, synthetic Backup and Proposal only. Four fault cases and all nine isolated app tests passed. Commands: pnpm exec vite build --config vite.v13-test.config.ts --configLoader runner; pnpm exec playwright test --config playwright.v13-app.config.ts.

| Operation | App-facing abort | Observable result |
|---|---|---|
| Restore | Returns normally | Rejection status, chooser enabled, no HELD or success, independent before/after canonical and cutover equal. The Restore UI does not expose the zero-mutation enum; its branch is inferred from these visible results and the unchanged control flow. |
| Restore | Throws | UNKNOWN_HELD in diagnostic, fixed warning, chooser absent, no success. |
| Proposal | Returns normally | REJECTED_ZERO_MUTATION in diagnostic, chooser enabled, no HELD or success, independent before/after canonical and cutover equal. |
| Proposal | Throws | UNKNOWN_HELD in diagnostic, fixed warning, chooser disabled, no success. |

A native canonical put request first emits success inside the readwrite transaction. The next pending-marker put is intercepted with a synchronous QuotaExceededError. All four cases call native abort and observe its real abort event. For the two exception cases only, the wrapper throws InvalidStateError after native abort returns, hiding the acknowledgement from the application while keeping synthetic storage safely rolled back. This tests the app classification when abort throws. It does not model a real browser commit race or establish what data survives in that scenario. Actual independent read-backs are attached in each case.

No product code or schema changes. No old root/profile trial, actual V1.2 data, real data, or deployment.
