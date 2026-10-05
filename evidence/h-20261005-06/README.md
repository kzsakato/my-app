# H-20261005-06 — final MAN correction verification

Date: 2026-10-05 JST. Executor: App Development / Test Execution (Codex).
RESULT: PASS for implementation and automated verification. PMO / QA acceptance and any new Staging delivery remain separate.

## Authority and provenance

- `training-project` GitHub main `2b61711`, AI_BRIEF v20; H-20261005-06 plus H-02/03/04/05, Step5 Freeze and EP-20261001-V1R.
- Accepted prior Product: `687716d17cebbacae63d91452e6bc01b335c70c5`.
- Safe continuation: `174398f08e79e88427ebbb82a33fd427fa525429` (accepted Product plus existing Staging tooling).
- Product correction: `d34b3927d63c66e60d68f1350d040725402a70b3`.
- Branch: `codex/h-20261005-06-v1r-final`. Build: `2026-10-05 / d34b3927`.
- Production main remains `d4e5c09b1dd3119d58a3d8e6c4fc74e907e4a288`. No merge, Staging/Production deploy, initializer operation, or Owner browser storage operation was performed.

## Root cause and corrections

| Item | Finding and final behavior |
| --- | --- |
| A1 | Run exposed a setting-change reason input. Removed this input/state; actual completion writes only Session memo/actuals. Explicit standard save still creates a genuine SettingChange when tracked settings change, without a Run-supplied reason. ItemEditor reason remains. |
| A2 | Selected weekdays used tap-order array presentation. Display is now sorted by the fixed Monday=0 through Sunday=6 semantic, independently of weekStartsOn. |
| A3 | Completed records were filtered by selected actual-date weekdays. Show-completed now exposes all current-week records not already represented by visible planned rows, including Extra, without selecting or changing weekdays. OFF retains candidate filtering. |
| A4 | Top mapped all entries for one Exercise to a representative latest Session, but planned-row navigation discarded Session ID; Run looked up latest same-Exercise again. Different records could therefore show/cancel the same latest actual. Rows now bind a specific Session, prefer their own membership when available, and pass that ID through completed navigation. Run never resolves an unselected latest record. Cancellation removes only that explicit ID. Missing/deleted IDs never fall back to another Session. |
| A5 | Removed only the incomplete Run previous-actual panel. Completed Run retains its own actual panel and existing editable controls. Previous/order domain contracts are unchanged and still tested. |
| A6 | New item numeric defaults/fallbacks (weight, reps, seconds, sets) are zero. Canonical save validation remains unchanged; invalid zero blocks persistence. Existing items are not rewritten. |
| A7/A8 | Item validation formerly went through global notice with canonical paths. ItemEditor now validates before commit, maps known paths to explicit Japanese field labels, uses a safe generic message for unknown paths, and holds errors in local form state. Edits clear errors; revalidation recomputes them; leaving/re-entering discards them. |

The former delete predicate already used Session ID: the demonstrated defect is identity loss before deletion, not evidence of a bulk-delete predicate. The earlier H-03 cancellation tests exercised Extra rows that already preserved Session identity; their PASS did not cover planned-entry selection across multiple same-Exercise records. Owner findings are not dismissed by those older passes.

Completion counts remain Exercise-based projections over remaining canonical Sessions. Snapshot, date, performedAt/performedOrder, membership, storage authority, schema and validator contracts are unchanged. The Staging tooling tree is identical to `174398f`; its existing accepted-source setup has not been advanced for this new candidate.

## Executed verification

| Command / check | Result |
| --- | --- |
| `pnpm test --reporter=default --reporter=json --outputFile=evidence/h-20261005-06/unit-results.json` | 121 tests, 16 files PASS |
| `VITE_BUILD_DATE=2026-10-05 VITE_BUILD_SHA=d34b3927d63c66e60d68f1350d040725402a70b3 pnpm build` (PowerShell environment variables) | PASS, TypeScript + Vite + PWA |
| `pnpm exec playwright test` | 49 PASS, 0 skipped / unexpected / flaky, retries=0 |
| `pnpm exec playwright test --config playwright.release.config.ts` | 42 PASS, 0 skipped / unexpected / flaky, retries=0 |
| `git diff --check` | PASS |

Build SHA was inspected in the generated JS, and every dist file is SHA-256 recorded in [build-manifest.json](build-manifest.json). Tests use isolated localhost Chromium contexts, Japanese locale / Asia-Tokyo timezone and fixed clocks; these are not Android Brave MAN results.

Focused cases are included in both final dev/release totals:

1. Same item / two entries, same item / same entry, and two items / same Exercise: create normal A/B through the canonical Session factory as deterministic persisted setup, then create Extra C through the real UI. A/B/C have distinct actuals and one explicit ordered instant. This is not a claim that all three were entered through Owner UI.
2. Open A/B/C by their bound IDs and verify own weight/reps/sets/seat/memo. Cancel B, then A, then C through UI. After each cancellation compare the entire canonical payload and serialized remaining Sessions, verify distinct today count / weekly completion / every 14-day marker, open each survivor's own actual, reload, and verify cancelled IDs do not reappear. Non-Session and legacy data remain equal.
3. Unit negative case: cancel B again, or pass item/date instead of Session ID, is a no-op; same date/item/entry/equal actuals cannot select a sibling. Remaining latest-actual ordering still returns C.
4. Reverse/random weekday selection, deselect/reselect, Monday/Sunday week-start; future Sunday normal/Extra completed Friday remain visible while Sunday is unselected. OFF hides them and canonical data stays unchanged.
5. New weighted/time item zero defaults; invalid save does not write; errors show human labels; correction/revalidation removes obsolete field errors; back, another item, common-menu navigation and re-entry do not retain errors. Valid time item saves/reloads without rewriting the existing item.
6. Existing save failure / read-back failure, cutover/Restore, settings history, Menu, Trainer, calendar boundaries, Analysis, item lifecycle and full screen navigation remain covered.

## Acceptance assertion changes and initial failure

No threshold or domain assertion was relaxed for green tests. H06 explicitly supersedes three old UI expectations:

- A1: Run reason input is absent; explicit standard-save event and independent Session memo remain checked. The ItemEditor reason regression is retained.
- A5: incomplete previous panel assertions become absence assertions; Extra own-actual selection assertions replace the former panel checks. Existing ordering unit tests are unchanged.
- A3: the initial full dev run was 48 PASS / 1 FAIL because an old OIC-010 assertion expected zero records after deselecting Saturday. The actual result was the two completed Extras, as newly required. The test now asserts both exact Extra records remain, then asserts OFF hides them. See [dev-e2e-initial.log](dev-e2e-initial.log). The final complete run is 49/49.

## Evidence index

- [Unit results](unit-results.json), [unit log](unit.log), [build log](build.log).
- [Dev cases/results](dev-results.json), [dev log](dev-e2e.log), [dev Session journey payloads](dev-session-journeys.json).
- [Release cases/results](release-results.json), [release log](release-e2e.log), [release Session journey payloads](release-session-journeys.json).
- [Mobile Run](release-run-mobile.png), [item local errors](release-item-local-error.png), [completed records](release-completed-records.png). These release screenshots were visually inspected for the targeted controls and readable field labels; this is not a formal QA/VRT sign-off.

Residual implementation blockers: none found within H06. QA decides any limited Owner recheck. Staging redeploy/prep is explicitly not authorized by this completion. Return to PMO before changing delivery/preparation configuration. No Owner reset/reinstall/cache deletion or additional exploratory MAN requested.
