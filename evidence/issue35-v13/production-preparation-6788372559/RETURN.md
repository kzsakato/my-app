# V1.3 production preparation — Issue #35 #6788372559

Candidate branch integrates main 90552c9bce58848f19740a13054c087147b71803 and V1.3 integration 0db3bd3a7f78b7016dd3791a8c76e6814291d43c. Merge commit 478ae75dbbf3598d20e99d98bfa36412a991ec87 has both ancestors. Git merged cleanly. The four main-only commits and fixed V1.2 release assets are retained.

The fixed artifact uses the normal production configuration with VITE_BUILD_DATE=2026-11-11 and VITE_BUILD_SHA=945baba12a0fcbf4facb2ab9a627f3d6d7e5783e. Its manifest records every file, size and SHA-256. Existing live /my-app/test files are also included byte-for-byte from deployment e3e913e76952158db6924feab9805a64c588ef9e and verified by HTTP. Live secondary source remains cfe668b. A fixed live source and matching files establish the current candidate identity; the precise bytes Owner accepted are not independently established by a recorded Owner acceptance manifest.

## One release blocker

The current V1.3 feature activation and storage isolation share VITE_V13_ISOLATED. Normal production enables the existing training-check DB but selects the prior analysis and disables v2 initial contribution application. Enabling isolation selects training-check-v13-test, initial Restore, and the fixed /v13-test controller guard. The accepted secondary deployment additionally uses /my-app/test. A switch to either existing build configuration alone cannot establish approved V1.3 production features plus the required Chrome data protection.

production-smoke.json records a new disposable Chromium context with a synthetic canonical and cutover state. Reload and analysis navigation preserve every inspected store. The normal candidate exposes the prior metric selector and no six-region V1.3 heading. No real browser data was accessed.

Technical Advisor/PMO must settle the production feature/storage activation path against the approved data transition. A production source/config correction and targeted acceptance will be needed if Chrome V1.2 storage is to continue in place. This preparation does not silently migrate or restore the existing data. The draft deployment workflow calls verify-v13.mjs --require-ready, which rejects this candidate until an accepted release replaces it. Do not override readyForDeployment merely to publish.

## Verification and PMO execution route

Completed locally:
- pnpm install --frozen-lockfile and pnpm build.
- node release/verify.mjs preserves and checks the original eight V1.2 files.
- node release/verify-v13.mjs checks all candidate and retained secondary files.
- node release/verify-v13.mjs --require-ready rejects the unready artifact.
- Both integration ancestors are present and V1.2 release files match main.
- Live secondary HTTP file hashes match e3e913e Git blobs.

After the production blocker is resolved, PMO reviews the replacement artifact manifest/source/build identity, required targeted test evidence and readiness flag, then merges the draft release PR into main. The existing release/** push trigger verifies the preserved V1.2 artifact and candidate readiness before uploading the fixed candidate directory. No rebuild occurs in Pages.

Before publishing, archive the currently live artifact and verify all eight production files against the retained V1.2 manifest; retain the currently deployed test subtree too. After publishing, compare every production and secondary URL with the new manifest and inspect the delivered build identifier. Owner acceptance and deployment success are separate records. Rollback uses the preserved V1.2 production directory plus the retained test subtree as a combined fixed artifact, checked before upload. main/Pages execution remains PMO-owned.

No main update or dispatch occurred during preparation. Staging and real Owner data are unchanged.
