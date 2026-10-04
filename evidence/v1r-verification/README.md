# H-20261003-08 current-run implementation / verification return

後続のQA-C01/C02補正と再検証は [H-11 correction](H-11-correction.md) を参照。本書以下はH-08返却時点の履歴であり、補正後の最新判定ではない。

RESULT: **FAIL — current run complete; PMO-deferred correction C01 remains.** Automated checks below passed on the submitted tree. This is not overall V1R acceptance, QA approval, deployment approval or Owner MAN readiness.

## Authority and baseline

- training-project authority read-back: `2f29ece3ce4c45e83eef47860dc3e20a6d28dfc2`; H-08 latest scheduling disposition explicitly completes this run as-is and aggregates corrections before Owner MAN.
- Frozen authority: Step5 Freeze Package / Owner Review Matrix; Step3 Verification Pairing; current SCREEN_SPEC and docs/screens; DATA_SPEC including H-09 §10.9 (`b2997d5837dd8def5732e57d75a19e5cd5234e79`). TEST_SPEC authoring error is resolved by PMO, not a new missing-input blocker.
- Production baseline source: `add343ae60a5a38e72426a90861da5501eef5bac`. Pre-change machine capture harness: `d4e5c09b1dd3119d58a3d8e6c4fc74e907e4a288`, retained without regeneration. Original PNGs and manifest remain in `evidence/v1r-baseline/`.
- No11's nonmatching local transport copy was not used as a pixel oracle. PMO's original Library identity remains authoritative; selected VRT below uses two independently pinned machine captures, not that copy.

## Residual C01 — deferred by Owner / PMO

`src/canonical/trainer.ts` currently appends ` (ByAI)` in the importer. Current-run tests assert that as-is implementation behavior; their passing status does not endorse it. PMO clarified that Trainer/Product owns the proposed name upstream and Data Integration materializes it in MenuProposal JSON. Importer must preserve the validated proposed name.

Post-run correction and verification required before Owner MAN:
1. Remove unconditional importer rename/append, including the coupled candidate-name / same-name warning assumptions.
2. Assert exact proposal-name preservation.
3. Include already-marked upstream input and prove no double append.
4. Prove existing Owner Menu names remain unchanged.

No provenance entity/field or marker-validation schema is invented. PMO/QA aggregate and route the correction pass. This run deliberately does not restart that correction, following the later scheduling disposition.

## Implementation / approved-delta trace

| Scope | Implementation | Acceptance evidence |
| --- | --- | --- |
| OIC-001/008/009/010/012 | Actual week boundaries on 14-day markers; temporary multi-weekday display; distinct Exercise today actual including Extra; actual-date done rows; two-line execution lists; no general density or right-alignment change | v1r calendar/history unit cases; acceptance filter/count/actual visibility and Clock cases |
| OIC-002 | Menu add/remove confirmation; cancel/back does not persist draft | Menu journeys, cancel/non-target assertions; Menu Edit zero-diff VRT |
| OIC-003/004/006/007 | Actual seat is Session-only; previous actual keyed by snapshot Exercise and exact instant/order; own completed Session; no undone residue; five weight controls; immutable completion ID/date/pair through retry | ordering unit cases; write failure/retry/read-back/reload, same Clock and shuffled offset-equivalent sessions; controls assertions |
| OIC-011/013/015/016 | Common header navigation, no bottom nav; selected non-initial history deletion; seven week-start warning choices without historical fact rewrite; build ID retained | full population navigation, history delete/cancel/reload, all seven week starts, Analysis non-week invariance |
| D-01/D-02 | One Trainer settings row, dedicated two-section route; JSON parse/preview/Error/Warning/confirm/apply/result; persist/read-back, double-apply guard and rollback uncertainty lock; inclusive read-only export with explicit zero-result handling | file journeys, cancellation, failure/retry, warning acknowledgement, rollback lock and export assertions; C01 exception above |
| D-03 | Exercise required nonempty open bodyRegion labels with six presets and custom values; legacy Category CRUD/Item field removed, historical snapshots retained | required/custom-label units and UI journeys; no reconstruction or inferred migration |
| H-09 / DATA_SPEC §10.9 | Required offset-aware performedAt and integer performedOrder; exact normalized instant pair uniqueness including sub-ms precision; reject unsupported old canonical/Backup without drop/backfill; preserve current Backup IDs/date/pair | v1r-ordering units and startup/Restore recovery/non-write E2E |
| PRESERVE | Exercise→Item setup/edit/hide/show; Menu activation/edit/active archive guard; Run standard save, memo, slots/history/back; Profile fields; existing Analysis periods including half-year, controls and graph; Data Management restore; list preferences | grouped baseline and v1r acceptance journeys, snapshot-based load 260/ACWR 2.50, time-based Exercise actual load, full screen inventory and selected VRT |

Tests were adapted only where the cited frozen delta or explicit H-09 contract changes the old oracle. Legacy v5/v6 cutover and dev-only MAN harness are still exercised. Pixel oracles are copied verbatim from the pinned pre-change captures; no snapshot update command was used. The header-placement regression found during VRT was fixed in product code, not accepted into the oracle.

## Final automated evidence

| Command | Final result |
| --- | --- |
| `pnpm test -- --reporter=json --outputFile=test-results/unit-results.json` | 116 passed / 14 files |
| `pnpm exec playwright test` | 35 passed; 0 unexpected / skipped / flaky |
| `pnpm build` | tsc + Vite + PWA generation passed; 52 modules |
| `pnpm exec playwright test --config playwright.release.config.ts` | 28 passed; 0 unexpected / skipped / flaky |
| `pnpm exec playwright test --config playwright.v1r-visual.config.ts` | 2 passed; exact zero-pixel-diff Exercise Edit / Menu Edit |
| `git diff --check` | passed |

`*-results.json` are compacted from actual final JSON reporters, retaining assertion titles/statuses, durations and errors. `manifest.json` records source/artifact SHA-256 and source authority. `population/` holds release screenshots and route/control inventory; Settings subpage common headers are asserted separately where inventory captures main content. The source manifest is supplementary trace, not a new baseline authority.

Platform: Windows, Chromium **153.0.8010.12**, ja-JP, Asia/Tokyo. Selected full-page VRT: viewport 1020×967, scale 1, fixed `2026-10-03T12:00:00+09:00`, fonts ready, animation disabled. Default semantic viewport is Playwright Desktop Chrome. Linux CI semantic checks are separate; Windows PNG oracles are intentionally not silently compared on non-equivalent Linux font/platform conditions.

No Android/device/PWA Owner MAN was performed. Screenshot population and selected VRT do not establish exhaustive visual equivalence or replace PMO/QA's baseline authority review. Actual missing-label production data was not discovered; no unsupported canonical dataset was repaired by inference. No Owner shell/test/Git work is required for this return.

RETURN TO: PMO. Review the draft implementation and this C01 finding, aggregate QA findings, then route the correction pass before Owner MAN.
