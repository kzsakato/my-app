# Issue #30 — V1.2 App Development return

**Current follow-up: the TOP/REGION HOLD is resolved under Technical #6385559389 and formal 06 §4.5. See [latest implementation/PC verification return](connection/RETURN.md). The original partial return below records the earlier 4fd21f8 state.**

Date: 2026-10-24 JST

**RESULT: BLOCKED (partial implementation verified; V12-01 TOP/REGION integration awaits contract clarification).**

RETURN TO: PMO（親分） / QA・Technical for the limited question below.
OWNER ACTION: 親分が未起動なら「Issue #30のCodex返却を確認し、限定HOLDの仕様調整を進めて」と手動起動。既決事項の再承認は不要。Issue投稿は親分の実読受領・自動再開を意味しない。
Production deployment, real Owner Backup/Restore, QA final PASS and Android/PWA MAN have not been performed.

## Authority and baseline

- Owner explicitly started this Codex implementation in this chat.
- [PMO implementation GO #6385158265](https://github.com/kzsakato/training-project/issues/30#issuecomment-6385158265); [Governance Gate PASS #6385106311](https://github.com/kzsakato/training-project/issues/30#issuecomment-6385106311).
- Current project source fetched from GitHub: `kzsakato/training-project` main `31277b0cb3440bee3c1b6c09ff7cff1133e0e86f`. Read TRAINING_PROJECT, roles/AppDevelopment, handoff/README, TEAM_CASE, source-routing, current formal 02/03/04/05/05_JSON/06, consolidated V1.2 requirements, QA/UI review and Issue #30 comments. The Issue comments hold the lightweight execution plan and subsequent phase/Gate/GO updates. Earlier “implementation HOLD” passages are superseded only by the explicit GO, not by file dates.
- Formal contract: 05 §7.1, 05_JSON §3.1, 06 V1.2 §4 and each 03 V1.2 addendum; QA #6385055723 and Technical #6385088623. The old V1.1 descriptions are not the V1.2 delta oracle.
- App base: `kzsakato/my-app` `codex/v1r11-implementation` **b45c6ded5e7457d80018d1cc6986a4f591739f8a**, exactly the source baseline named in formal 03. Remote ref rechecked before commit. App main `4233692fb07aeaec0fcc59fe585cadbc1b4b77ec` contains deployment history and a different src tree; it was not used as the V1.2 implementation base.
- Dedicated branch: `codex/issue30-v12-implementation`. Fresh clone initially clean; no unrelated user edits existed. Project sources are a separate read-only sparse checkout. No old root AI_BRIEF/AI_ROLES startup retrieval, no owner/no_peeking content read, and no claim of PS/Library access.
- V1.2 TEST_SPEC is absent from current release sources. Tests below implement formal contracts and QA's latest focus; they do not establish QA final acceptance or create a replacement QA specification.

## Implemented scope

| ID | Delivered behavior / limits |
|---|---|
| V12-01 | Optional canonical preferences; Default/Option independent 3-key order/direction; settings entry between weekly menu and analysis; vertical editor, explicit save/read-back, unsaved back discards; EX/TI/EXTRA and both MENU lists use nonmutating projections; one MENU checkbox, open OFF; missing concepts skipped; name/ID ties fixed; candidate name lists and independent-history timestamp/name ties. **TOP/REGION common row integration and their Option checkbox are not implemented pending the question below.** |
| V12-02 | One effective bodyRegionOrder source for relevant group/select/region comparisons; unknown valid labels after configured labels; current Exercise adapter does not choose first/Other for invalid classifications; row warning and existing Exercise edit path; normal Exercise edit requires one explicit valid region; historical snapshots remain unchanged. Owner's real dataset inconsistency count remains unknown. |
| V12-04 | TOP weekday panel 全ON=7 / 全OFF=0; completed-display flag unchanged; no persistence. |
| V12-05 | Status labels change from 12px to calc(12px + 1pt), computed ~13.3333px on both widths. Existing run number+unit calc(14px + 1pt), narrow calc(13px + 1pt), preserved and measured; no double addition. |
| V12-06 | Canonical visible/aria カテゴリ→部位, analysis 部位別/部位詳細, MENU 追加候補の部位. Internal category values and legacy implementation are not mechanically renamed. |
| V12-07 | EXTRA 部位 AND 除外(なし/2/4/6/10), default all/none, saved snapshot.exerciseId × saved Session.date, inclusive today through N days ago, future excluded from window, all TIs for same Exercise; sort remaining candidates. Baseline standard-setting detail, info paragraph, row operation and arrow preserved; no extra history UI introduced. |

Backup uses schemaVersion 1 optional extension. Missing/invalid settings fall back per entire setting while valid siblings survive. Preview shows warnings and effective values, explicitly gates confirmation, and apply requires the same normalized candidate, revalidates, replaces whole payload, and checks read-back. Normal Owner saves and Backup Export explicitly contain effective preferences. Mandatory facts/envelope errors are not repaired. Startup Recovery remains its existing separate path.

New fixed notification wording was not introduced: the row warning reuses `bodyRegion classification が不正です` from existing canonical validation; preferences warnings reuse existing input-validation wording and the existing Backup warning acknowledgement. QA should review the actual presentation; no new M-ID is claimed.

## Changed implementation and test files

- `src/CanonicalApp.tsx`, `src/DisplayPreferencesEditor.tsx`, `src/v1r11.css`
- `src/canonical/displayPreferences.ts`, `src/canonical/types.ts`, `src/canonical/validate.ts`, `src/canonical/backup.ts`, `src/canonical/management.ts`, `src/data.ts`
- `src/canonical/displayPreferences.test.ts`, `src/canonical/backup.test.ts`, `src/canonical/v1r-ordering.test.ts`
- `e2e/issue30-v12.spec.ts`, `playwright.v12.config.ts`, `playwright.v12-regression.config.ts`, `.gitignore`
- `e2e/issue28.spec.ts`: evidence-directory override only; existing acceptance assertions unchanged.
- This directory: result record, machine E2E results, fixture-based screenshots/read-back evidence.

The two prior Export/Restore full-object assertions were updated **only for the approved 05_JSON §3.1 addition of effective preferences**: all other facts still undergo full equality comparison, and exact default preference values are asserted from the formal contract. No visual baseline/snapshot file or existing Issue #28 acceptance expectation was changed.

## Verification evidence

| Command / check | Result |
|---|---|
| `pnpm install --frozen-lockfile` | PASS; dependency/lock files unchanged. Initial npm ci was inapplicable because this branch has a pnpm lockfile. |
| `pnpm test --reporter=dot` | **143/143 PASS, 18 files** (124 existing + 19 new cases). |
| `pnpm exec playwright test --config playwright.v12.config.ts` | **14/14 PASS**: 7 scenarios × desktop Chromium / 360px PC emulation. [Machine result](e2e-results.json). |
| `pnpm exec playwright test --config playwright.v12-regression.config.ts` | **8/8 PASS**: unchanged Issue #28 assertions × 2 widths. [Machine result](regression-results.json), [fixture evidence](regression/). |
| `pnpm run candidate:build` | PASS, tsc + isolated candidate build; local only. |
| `pnpm run build` | PASS, tsc + Vite/PWA build; local only. No deployment workflow invoked. |
| `git diff --check` | PASS. Generated tsconfig.tsbuildinfo excluded/restored; release/workflow artifacts unchanged. |

New E2E verifies explicit save/reload/read-back/non-target invariants; back discards; one MENU checkbox + both projections + stored order unchanged; per-open reset; N+1 endpoints / same Exercise multiple TIs / future / AND filtering; classification repair leaves Sessions and other Masters unchanged; old Backup warning/effective values, confirm cancel no-op, full replace/read-back/re-Export/reload; quota failure leaves draft/storage intact and supports explicit retry; weekday bulk actions; computed status/run font sizes. Unit cases also cover settings-unit fallback, unknown labels, absent keys, completion directions, missing recommended day, stable name/ID, leap month/year boundary, mandatory corruption and read-back mismatch.

Screenshots of the editor and Extra were visually inspected at desktop/360px. [Narrow editor](narrow-pc-emulation-display-editor.png), [narrow Extra](narrow-pc-emulation-extra.png), [Backup preview](narrow-pc-emulation-backup-preview.png). These are PC automation/emulation, not Android/device/PWA MAN. No all-30-screen or all-state-path PASS is claimed. Initial test-selector failures and two old assertions about Export shape were diagnosed, corrected against the approved contract, and rerun; no failure was hidden by snapshot replacement.

## BLOCKED BY / WAIT FOR

Limited question posted durably in [Issue #30 #6385229327](https://github.com/kzsakato/training-project/issues/30#issuecomment-6385229327). No answer received at this return.

V1.2 requires a planned Entry list with week/Exercise completion. Existing 06 §2.1 and `completedSessionRows` / RunPage preserve 1 Session per selectable actual row and cancellation of exactly that Session. For multiple Entries and multiple Sessions of the same Exercise (including Extra and snapshot-only regions), the sources do not define:

1. What pressing a completed Entry row does / which actual Session is selected.
2. Whether/where all individual Session rows remain, and their sorting keys/placement alongside the Entry projection.

Required decision: QA/UI + Technical contract reconciliation; PMO routing; Owner only if a new Owner-visible choice is necessary. App Development has not selected a representative Session, dropped repeated/Extra facts, or invented a new selection screen. The original TOP/REGION Session rendering/selection/cancel remains until this is resolved. Do not treat the settings/comparator or regression PASS as completion of this blocked V12-01 part.

Other residual verification: real Owner classification-inconsistency count (no live DB access/real Backup operation undertaken), Production/Owner device CSS/identity, QA V1.2 TEST_SPEC and final regression judgment, Android/PWA MAN, classification/restore-warning presentation review, full screen/state coverage, and production release require their respective Role/Owner actions. Existing new-document anchor/old 29-screen historical index format was not changed; no claim of 30-anchor verification.

Push destination and actual commit SHA are recorded in the Issue return and draft PR so this record does not self-reference a future commit. The branch is a partial review artifact, not merge/deploy-ready.
