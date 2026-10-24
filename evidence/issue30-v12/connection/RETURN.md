# Issue #30 — TOP/REGION connection implementation return

Date: 2026-10-24 JST

**RESULT: PASS — authorized App Development implementation and the PC verification below.**

The prior TOP/REGION contract BLOCK is resolved. This is not QA final PASS, release acceptance, Android/PWA MAN or deployment approval.

## Authority / current source

- Owner supplied [Technical #6385559389](https://github.com/kzsakato/training-project/issues/30#issuecomment-6385559389) to this Codex chat to continue the already-authorized V1.2 implementation.
- Re-fetched current Issue #30 comments, including PMO #6385482622 and QA #6385496227, and safely fast-forwarded the read-only project-sources checkout to current main **06e3c9d3f16750ee2529051e849f63b89d60d7e5**.
- Read the formal synchronized TOP connection addendum (`b203b33a9b6db0bd7b5f26a95d04c3a0edb373d3`), REGION addendum (`3e765db93a996c90f18d38ce5ed8716a5a1aedcb`), and 06 §4.5 (`06e3c9d3f16750ee2529051e849f63b89d60d7e5`). These explicitly resolve the earlier Entry/Session ambiguity without new screens, new fixed headings or selection controls.
- App branch `codex/issue30-v12-implementation` was clean at **4fd21f8ed8d004e087958a7e4c6b3f9e4c6c622c**, matching the fetched remote. Base remains the formal V1.1 candidate **b45c6ded5e7457d80018d1cc6986a4f591739f8a**. No unrelated work, deployment workflow or release artifact changed.

## Implemented delta

- TOP and REGION keep **one planned row per active Entry.id**, regardless of completion. Existing week/Exercise completion supplies each row's badge. Current TI/Exercise names, each Entry's recommended day and current Exercise region feed Default/Option projection; names then Entry.id break ties. REGION skips its constant region key.
- Added the approved **Optionソート** checkbox beside 実施済も表示; per-page open defaults OFF. Option sorting touches only planned rows, not stored arrays/order or actual history.
- Planned row tap always sends its own Entry.id to existing PLAN-RUN. Completed Entry tap does not select a Session. Existing inputs/re-execution path remain enabled, and re-execution appends a new Session without replacing prior actuals.
- Actual rows remain a separate presentation group, **one row per Session.id**, shown only when 実施済も表示 is ON. Tapping supplies that exact Session.id/TI.id to the existing specific-Session path. Cancellation removes only the selected Session.
- Actual ordering is `performedAt DESC, performedOrder DESC, Session.id ASC` in a display-only comparator. Neither `sessionOrder` nor canonical validation/persisted facts were changed.
- TOP filters planned rows by Entry.recommendedDay and actuals by saved Session.date. REGION filters planned by current Exercise region and actuals by saved snapshot region. Snapshot-only regions stay reachable; missing snapshot region remains in TOP's region-unfiltered actual group and is never filled from current Master or assigned to a fabricated REGION.
- Counts/load continue to use original Sessions. Completed Entry badges add no numerator or load. No new headings, selection screens, representative Session choice, aggregation, or Session duplication were added.

Together with the prior [independent implementation](../RETURN.md), this implements the six adopted candidates V12-01/02/04/05/06/07 within the documented scope. V12-01 TOP/REGION connection is no longer deferred.

## Changed files in this follow-up

- `src/CanonicalApp.tsx`: Entry completion/rendering, independent projected groups, Option state and sorting.
- `src/canonical/topProjection.ts`: display-only Session ID tie comparator.
- `src/canonical/topProjection.test.ts`: comparator behavior/non-mutation and explicit retention of the canonical duplicate-ordering-pair rejection.
- `e2e/issue30-v12.spec.ts`: four new connection scenarios, parameterized over desktop/360px; separate Evidence output path. Existing seven V1.2 scenarios retained.
- `playwright.v12.config.ts`, `playwright.v12-regression.config.ts`: follow-up Evidence destinations. Existing Issue #28 acceptance assertions remain unchanged.
- Result pointers and this Evidence directory. Original partial-run Evidence is retained at its original paths.

## Verification

| Check | Result / evidence |
|---|---|
| `pnpm test --reporter=dot` | **144/144 PASS, 18 files**. [unit.log](unit.log). |
| `pnpm exec playwright test --config playwright.v12.config.ts` | **22/22 PASS**, 11 scenarios × desktop Chromium / 360px PC emulation. [machine result](e2e-results.json). |
| `pnpm exec playwright test --config playwright.v12-regression.config.ts` | **8/8 PASS**, existing Issue #28 assertions unchanged. [machine result](regression-results.json), [fixture read-back/screenshots](regression/). |
| `pnpm run candidate:build` | PASS, tsc + isolated candidate build; local only. |
| `pnpm run build` | PASS, tsc + Vite/PWA build; local only. |
| `git diff --check` | PASS. Generated tsconfig.tsbuildinfo restored/excluded. |

New connection coverage: multiple Entries per Exercise, multiple current-week Sessions including Extra, current/snapshot region differences, snapshot-only and missing snapshot regions, independent Default/Option order vs fixed actual history order, completion badges with actuals OFF, weekdays 0/7 and Entry-day vs actual-day independence, per-open Option reset, completed Entry→PLAN-RUN→back, specific Session read-only controls, one-Session cancellation and persistent reload, completed Entry re-execution creating a new Session, unchanged existing Sessions/Entry order and unchanged displayed counts/load under presentation operations.

**Exact equal instant/order limitation:** canonical validation already rejects multiple Sessions with the identical performed instant and performedOrder. It remains unchanged. The requested final Session.id tie is tested using synthetic comparator inputs, with a separate assertion that the same synthetic payload still fails canonical validation. Browser fixtures use equal instants with distinct performedOrder; an invalid duplicate pair was not passed off as accepted live data. No tolerance, snapshot or acceptance oracle was loosened to make a test pass.

Narrow TOP/REGION screenshots were visually inspected; desktop images are also retained. [Narrow TOP](narrow-pc-emulation-top-connected.png), [narrow REGION](narrow-pc-emulation-region-connected.png), [desktop TOP](pc-top-connected.png). All screenshots and storage checks use isolated fixture data and the candidate IndexedDB namespace, not Owner/Production data. No all-30-screen/all-path or Android/device/PWA PASS is asserted.

## Return / residual work

BLOCKED BY: none for this App Development connection scope.

RETURN TO: PMO（親分）→ QA（お嬢） for the specified independent QA regression/wording review and subsequent phase judgment.

Remaining role/acceptance work: V1.2 TEST_SPEC and QA final evaluation, Owner real-data classification inconsistency count (not read from a live DB or real Backup), Production/Owner device identity and CSS confirmation, Android/PWA MAN and final visual acceptance, any required broader screen/state coverage, and separately authorized production deployment. Existing warning wording still reuses prior validation messages; final presentation review belongs to QA. No real Backup/Restore or production operation was performed.

OWNER ACTION: no new scope/implementation GO is needed. If PMO is not active, manually start 「Issue #30のCodex接続実装返却を確認し、QA移行を進めて」. Posting the result is not proof of PMO/QA read receipt or automatic continuation. Actual follow-up commit/push and draft PR identity are recorded in Issue #30 and PR #4, avoiding a self-referential future commit in this file.
