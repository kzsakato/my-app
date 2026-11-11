# Production connection correction — #6789917630

Source 0f1b87cc7b8bf26d6053a041b7ae96e23727c58c. VITE_V13_PRODUCTION=true enables existing V1.3 features in the fixed production build. The secondary configuration explicitly enables the same feature flag while retaining VITE_V13_ISOLATED and its storage/controller behavior. Root keeps training-check; it opens App and the existing data management screen.

Normal Restore reuses previewCanonicalRestore and applyCanonicalRestore/recoverCanonical. The V1.3 preview parses the outer2 envelope, validates existing contribution structure and canonical inner1, then hands the same payload through the existing preview/whole replacement/readback flow. Global and per-target revisions and appliedProposalIds remain equal to Backup values. Root writers use the existing V1.3 revision increment and transaction/marker/readback. The initial empty-target restore remains secondary-only.

Targeted root build verification passed:
- Synthetic latest Backup with global revision7, existing target revision2, existing ledger entries restores into an occupied synthetic root canonical.
- Readback and exported outer2 payload equal the complete imported payload.
- AnalysisV13 and TrainerContext v2 available.
- A new NO_ENTRY proposal advances revision7→8 once and preserves the existing rate and ledger.
- Initial contribution overwrite of an existing VALID target is rejected with all data unchanged.
- Owner profile save advances revision8→9; complete canonical and cutover match after reload.
- Fixed V1.2 artifact and retained secondary files match their prior hashes.

Run from repo root:
    VITE_V13_PRODUCTION=true VITE_BUILD_DATE=2026-11-11 VITE_BUILD_SHA=0f1b87cc7b8bf26d6053a041b7ae96e23727c58c pnpm build
    node evidence/issue35-v13/production-connection-6789917630/root-connect.mjs
    node release/verify-v13.mjs
    node release/verify.mjs

The browser script runs a disposable localhost root context and synthetic fixtures. It reads/writes no Owner data. Data Design/Integration was asked to confirm ordinary Restore revision/ledger preservation in #6789992263; no reply was available at the time of this record. No extra confirmation UI, new database or extra migration process was added. The existing readyForDeployment=false and --require-ready stay pending limited QA/PMO decision, as instructed by Tech. main and live deployments were not changed.
