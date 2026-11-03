# Issue #34 V13-05 limited implementation RETURN — 2026-11-03

**RESULT: BLOCKED (partial implementation, not release-ready).**
Instruction: [QA/UI #6605006790](https://github.com/kzsakato/training-project/issues/34#issuecomment-6605006790), manually activated by Owner. No QA PASS, Owner acceptance, or production GO is claimed.

## Fixed sources and baseline

- Project current source fetched from GitHub: `c1fec8d794bc1490f4038b1e316ff1a299e7f254`.
- Data Contract v1.0 `683d40a93196cfe3be4830a0b724d5e8dc5f0e58`, blob `d02cb87bd6c366bd46dcb8ca77cb9b8f9d2c5cb0`; supplement01 `c1fec8d794bc1490f4038b1e316ff1a299e7f254`, blob `1eb56b0870431fef4931d5b8eb0394556277e8a9` verified. See `sources.json`.
- UI authority #34 #6580006841 / #6603833022; preimplementation F01–F11 #6603522655 as narrowed by #6605006790; Governance #35 #6604833112. Current TEAM_CASE §5/§7 read. No access to Project instructions/PS/Library claimed.
- App implementation baseline: **c4fe4514ab093a9e2084dc286310d46f81ab8864**, dedicated branch **codex/issue34-v13-initial**. Source worktree initially clean. Other worktrees and branches were preserved.
- App main: `90552c9bce58848f19740a13054c087147b71803`. main deploys the fixed V1.2 artifact, not its own src. Production HTTP GET of **all eight files** matches the saved manifest size/SHA256 (`production-readonly.json`). Successful Pages run: https://github.com/kzsakato/my-app/actions/runs/40684136216 . Owner device Build/cache/SW controller remains unverified.
- DB remains `training-check`, version7, existing `canonical/cutover/baseline/state/recovery` stores. No new schema, migration marker, default rates, or provenance claim was invented. Existing PT formula, Session/snapshot, displayPreferences, V1.2 analysis UI and release artifacts remain unchanged.

## Implemented and deliberately disabled

- Exact six-key integer percent validator (0..100, step5, sum100), entry/global safe revision validation, orphan/history validation. Missing old fields are not converted to NO_ENTRY.
- Strict v2 raw JSON parser reuses the existing duplicate-key scanner. Unknown/missing fields, invalid revisions, duplicate targets, old target union, addExercise/changeMenuOrTI/correction/mixed operations are rejected.
- Existing stable ID (active/archived) NO_ENTRY preview checks generation revision and proposalId without rebasing. Single preview shows before→after rates, reason, analysis effect, Cancel/Approve. Cancel changes nothing. **Approve currently always refuses before write**, or remains HELD when an unresolved state/read exists. No success path is claimed.
- Pure, unconnected read-only arithmetic over explicitly selected saved Sessions: sets×percent/100, D/U/ZERO/UNAVAILABLE, stable ID aggregation. It does **not** choose a period. Display-only integer percentages use largest remainder with fixed six-key tie order; raw amounts remain unchanged. No production coefficients were seeded.
- Pure Context v2 projection covers archived Exercise/TI, 100-local-day history, states/revision. Synthetic projection tests are **not** provenance evidence. The UI requests v2 and currently **refuses all Export with a diagnostic and no file** because no independent provenance attestation is established; it does not silently fall back to v1. Existing v1 parser/candidate/context functions remain unchanged and tested, including normal v1 UI apply on legacy data.
- Central low-level/Owner/Trainer writer paths reject any V13-bearing root/candidate until all-writer revision integration is established. Existing legacy writers remain unchanged in meaning. Migration/revision initialization, global increment/overflow/noop integration and v2 atomic commit/read-back are **not implemented or enabled**.
- Old Backup export remains on legacy data; V13 data cannot be mislabeled outer1. Old Restore rejects V13 fields and outer2 stays unsupported. Existing legacy displayPreferences normalization/warning/full-replacement paths remain. Unproven legacy Restore handling is unresolved below.
- **No analysis UI replacement is included in the final diff.** Initial experimental connection used existing 12 buckets; review against AN-10 showed this cannot establish the V13 period-window contract. The connection and CSS were removed before commit. Screenshots in `superseded-analysis-draft/` and `browser-pre-period-review.json` are withdrawn draft evidence, **not final UI PASS**.

## Necessary limited STOPs / required decisions

1. **Legacy canonical provenance and proposal history** — Existing `cutover` only records authoritative/establishedAt and a pending proposalId. `recoverCanonical → writeCanonical` replaces root without recording Restore provenance. A timestamp plus missing fields cannot independently prove pre-V13 authoritative origin; absent appliedProposalIds cannot prove no prior accepted proposal history. **Data Integration/Data Design** must identify an available sufficient independent evidence source or define an approved alternative handling for such installations. No new proof/reset was fabricated. Initial migration/write and normal v2 Export stay disabled. All-writer revision work is outstanding; it must be completed and independently verified before enabling v2.
2. **V13 period window** — QA AN-10 explicitly distinguishes window length from bucket grain (#6555713359, #6556799581). The latest AN synthesis #6577343452 still identifies formal boundary/default-window oracles as missing; Contract v1.0/supplement do not define them. Latest instruction's “共通期間を維持” does not establish whether or how the legacy12-bucket selector becomes a V13 window. **QA/UI + Data/PMO** must resolve the applicable window/default/endpoints/buckets and concrete oracle. No inferred rolling/calendar/default3month choice is shipped. Analysis UI F11 is blocked; old UI is preserved.
3. **Legacy Restore authority** — F09 demands rejection of origin-unproven old Backup, while §5 also requires preserving current Restore behavior. Current outer1/createdAt are insufficient evidence. Existing legacy Restore success is preserved and regression-tested, **not presented as compliance with the new provenance rule**. **Data Integration/Data Design + QA/PMO** must connect the current operational Backup to sufficient provenance or specify which existing Restore is to be withheld. No new/expanded Restore success path is enabled. This is a release blocker.

These are limited RETURNs, not requests to repeat Owner's existing implementation GO. New Exercise create mapping, VALID correction, new Restore success and automatic HELD recovery remain outside this initial scope.

## Final validation and F01–F11 mapping

All browser execution uses isolated Playwright contexts and loopback with synthetic data. No Owner browser, Android device, production database, old staging or Worker was operated.

| Case | Evidence / actual result | Limitation |
|---|---|---|
| F01 | archived Exercise/TI +100 local days +NO_ENTRY pure Context projection; normal legacy v1 candidate/context tests | Normal UI v2 Export blocked by provenance, no success file claimed |
| F02 | malformed/orphan/history states rejected; UI unknown-origin Export produces no download/zero store change | MASTER storage access fault matrix incomplete |
| F03 | stale/duplicate/VALID/deleted targets rejected by preview checks; UI v2 always zero-write refused | Migration/global increments/multi-tab atomic success not implemented |
| F04 | disabled/mixed operations rejected; Cancel independently compares all five stores | addExercise success intentionally disabled |
| F05 | strict rates and archived NO_ENTRY preview; no shape-only migration; refusal/reload retains all stores | rev0→1/global+1 success blocked, not simulated as persist PASS |
| F06 | formal rates example and raw/escaped duplicate, unknown/missing/string/noninteger/step/range/sum/all0 rejection | Persist/read-back rates path inactive |
| F07 | v1 strict branch/string revision/candidate/normal UI apply/reload passes; new v2 operations never upgrade v1 | v1 normal UI Context download now replaced by safe-refusing v2 request |
| F08 | existing pending marker remains HELD/disabled across reload; no marker auto-clear | v2 commit/read-back/marker-release fault injection, abnormal termination and multi-tab success are **not executed**, path disabled |
| F09 | outer2 and V13-bearing old-envelope Restore reject without changes | Origin-unproven old outer1 rejection unresolved; not whole F09 PASS |
| F10 | existing Backup/preferences warn/explicit full Restore/reload regression passes | New Restore success out of scope; old provenance boundary unresolved |
| F11 / AN | pure sets allocation, ZERO/U/unavailable, display-only100%, time30/60 same sets, PT1200/1080/960/2160 pass | Final 5-section UI/period/Android checks blocked. 4 browser cases explicitly skipped with reason, not counted PASS |

- `pnpm test -- --reporter=json --outputFile=evidence/issue34-v13-initial/unit.json`: **197/197 PASS** (baseline163 +34 additional). Numerical oracles trace to QA #6556799581 / #6556841441 and current instruction; additional implementation guards are identified as such.
- `pnpm run build`: **PASS exit0**, `build.log`. No production dispatch.
- `pnpm exec playwright test --config playwright.v13-initial.config.ts`: **10 PASS, 4 BLOCKED/skipped**, no unexpected failure; PC1280 and touch360 Chromium emulation. `browser.json`; full store snapshots `*-zero-mutation.json`.
- Existing V1.2 suite: **22 PASS**, `v12-regression.json` / log. Issue28 regression: **8 PASS**, `issue28-regression.json` / log. These suites ran with the same affected Trainer/storage/Backup implementation; neither asserts the withdrawn analysis UI. Existing expectations were not edited.
- An additional older `v1r-acceptance` run failed its first stale `表示する推奨曜日:` selector (V1.2 actual `曜日指定:`), then was interrupted. `regression.log` / `legacy-suite-stale-selector.md` retained. It is **not a completed regression PASS**, nor evidence of a new V13 product defect. No oracle was changed to hide it.
- Initial new browser run: 10 PASS/2 FAIL due `getByLabel` versus combobox accessible-name locator; corrected locator, same numeric expectations. The earlier 12-PASS analysis draft run was subsequently withdrawn because of period-contract insufficiency. Both reports retained separately from final `browser.json`.
- Production8 hash checks are HTTP-only; no browser/SW/device identity, public new candidate, Android/PWA or independent QA PASS claimed.

## Return / next action

RETURN TO: QA/UI for independent evidence assessment; Data Integration/Data Design for provenance/Restore boundary; PMO for limited blocked-scope routing. Issue35 formal contracts are applied without modification.

WAIT FOR: sufficient provenance/history rule, period-window oracle, legacy Restore handling. OWNER ACTION: no repeated implementation GO or device operation requested now; PMO should route the above limited decisions. This draft must not be merged/deployed as a completed V13 candidate. Source/deployment/workflow files and main remain unchanged; no new hosting path was prepared.

Changed source: `src/TrainerPanel.tsx`, `src/data.ts`, `src/canonical/{types,backup,contributions,contributionAnalysis,trainerV13}.ts`; tests/config/Evidence and output ignores only. Commit SHA and Draft PR are returned in Issue #34 after push; this document intentionally does not self-reference its containing commit SHA.
