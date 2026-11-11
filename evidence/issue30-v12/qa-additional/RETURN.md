# Issue #30 — QA-requested additional verification

Date: 2026-10-25 JST. Executor: App Development / Test Execution (Codex).

**RESULT: PASS for the requested PC automated checks below. No confirmed implementation mismatch was reproduced, and no runtime implementation was changed. QA's current LIMITED judgment is not replaced by this report.**

## Authority and exact target

- Request: [QA #6393564113](https://github.com/kzsakato/training-project/issues/30#issuecomment-6393564113), explicitly supplied by Owner to this Codex chat for execution.
- Current GitHub sources actually fetched: `training-project` main **d48ad156e88bd2f3b8eaf4d9345a7ef0b7033e98**; [V1.2 TEST_SPEC](https://github.com/kzsakato/training-project/blob/d48ad156e88bd2f3b8eaf4d9345a7ef0b7033e98/release/V1.2/04_%E3%83%86%E3%82%B9%E3%83%88/TEST_SPEC.md), current Role/Handoff rules and formal app-design, Issue #30 Owner FIX and Technical #6385559389. The only project-source change since the prior fetched version was the new TEST_SPEC.
- Runtime under test: `my-app@d7e41c5f0cd8fdeccbe535bfa67907f35f0150cf`, branch `codex/issue30-v12-implementation`, draft PR #4, formal base `b45c6ded5e7457d80018d1cc6986a4f591739f8a`. Initial worktree clean; remote branch matched d7e41c5.
- **No changes to `src/`, canonical validation, Backup schema, Entry/Session contract, Owner UI, existing V1.2 tests, Issue28 assertions or visual baseline files.** This is a test/Evidence-only follow-up. Generated tsconfig.tsbuildinfo was restored/excluded.
- No production deployment, PR merge, real Owner data/Backup/Restore or credential setting changes.

## Commands and results

| Command | Final result | Evidence |
|---|---|---|
| `pnpm test --reporter=dot --reporter=json --outputFile=evidence/issue30-v12/qa-additional/unit-results.json` | **144/144 PASS**, 18 files; 0 failed/pending | [JSON](unit-results.json), [log](unit.log) |
| `pnpm exec playwright test --config playwright.v12-additional.config.ts` | **42/42 PASS**: existing 22 V1.2 cases plus 20 added checks, both widths | [JSON](e2e-main-results.json), [derived case log](e2e-main-results-summary.log) |
| `pnpm exec playwright test --config playwright.v12-additional.config.ts --grep 'Q08 independent'` | **2/2 PASS**: subsequently added independent Default/Option editor case × both widths | [JSON](q08-e2e-results.json), [raw log](q08-e2e.log) |
| `pnpm exec playwright test --config playwright.v12-additional-regression.config.ts` | **8/8 PASS**; existing Issue28 acceptance assertions unchanged | [JSON](issue28-regression-results.json), [raw log](issue28-regression.log), [fixture Evidence](regression/) |
| `pnpm run candidate:build` | PASS; local isolated candidate build | [log](candidate-build.log) |
| `pnpm run build` | PASS; local tsc + Vite/PWA build | [log](pwa-build.log) |
| `git diff --exit-code d7e41c5 -- src e2e/issue28.spec.ts e2e/issue30-v12.spec.ts` | PASS, empty diff | Source/acceptance oracles preserved |
| `git diff --check` / staged whitespace check | PASS | Checked before commit |

**V1.2 E2E total: 44/44 across the two explicitly recorded runs (42 + 2), not a claimed single 44-case run.** The final additional config now selects all 44 scenarios on a fresh full run. Final reports contain 0 skipped, unexpected or flaky cases. No new test.skip/fixme/only or weaker baseline assertions were introduced. Runtime: Node v24.21.0, pnpm 12.6.0, existing frozen lockfile/dependencies unchanged.

The first preflight inventory test timed out on an unused measurement of TOP status after navigation away from TOP. This was a test-harness locator error, not an application mismatch: the unused post-navigation call was removed, while explicit TOP and REGION CSS assertions were retained. The final inventory passed on both widths. No app fix, acceptance threshold reduction or snapshot substitution was used.

## Added verification details

### Restore / IndexedDB (Q09)

- Invalid JSON, wrong format, unsupported outer version, TI sets=0, dangling TI reference, and blank classification label are uploaded through the actual Backup file input. Each renders Error with no Restore action, and **all contents/keys of every candidate IndexedDB object store** are compared before/after, not just canonical rows. [Non-mutation fixture](pc-restore-invalid-nonmutation.json).
- Invalid defaultSort (duplicate priority), invalid optionSort (unknown direction), and invalid bodyRegionOrder (duplicate label) each fall back as a whole setting. Valid sibling sorts/custom bodyRegionOrder survive. Expected values are literals from formal 05/05_JSON, not values obtained by calling the implementation normalizer.
- Each case asserts visible warning plus the exact **corrected effective values** in Default/Option/region preview, Restore disabled before acknowledgement, cancelled confirmation leaves every store untouched, confirmed Restore produces the exact normalized full candidate, noncanonical stores remain untouched, and reload retains that result. See `fallback-*-readback.json`.
- Restore quota fault is injected at canonical `put`, before persistence. The UI reports success unconfirmed, all stores remain unchanged, preview remains available, removing the injected fault and explicitly retrying succeeds/read-backs/reloads. This does not claim all post-commit/power-loss faults are zero-mutation.
- Existing old-v1 missing-preferences Backup E2E remains unchanged and was rerun.

### Classifications / repair (Q10)

- Normal compatibility fixtures cover zero classifications, multiple different valid labels, and a nontrim label (`" 胸"`). Each shows row warning and edit, renders no first-label/Other substitute, removes the invalid classification from region choices, initializes the editor to unset with save disabled, and requires explicit valid region selection. Repair then updates the displayed region, clears warning, preserves all Sessions/snapshots/non-target facts, and survives reload.
- **Blank/nontext label distinction:** the unchanged canonical validator rejects a blank label before a normal list can render; this is exercised as a Restore core Error/non-apply case. The supported nontrim label case exercises the invalid display-adapter warning/repair route. No validator relaxation or invalid payload disguised as valid live data was introduced.
- The ambiguous-classification route test visits TOP, TOP region destinations, EX-LIST, TI-LIST, HISTORY-SELECT, MENU-NEW candidate rows and MENU-EDIT registered rows, and uses the MENU row's warning edit path. All avoid silent first-label adoption. Existing EXTRA warning/edit states are covered by all three repair fixtures.
- Static route audit: current Exercise display projections call `exerciseBodyRegion`. `CanonicalApp.tsx:927` uses `find` on **historical Session.snapshot**, not current Master; it was left unchanged. The old ExerciseEditor fallback at lines 1428–1444 contains `[0]` but is guarded by `!onSaved`; the sole current call site (line 1085) supplies `onSaved`, so that fallback is not rendered by current Settings navigation. Trainer context rejects ambiguous labels before returning a single label; its exchange contract was not altered. These are bounded source findings, not claims about hypothetical future callers.

### Wording, accessibility and geometry (Q14/Q15)

- For every inspected state, both rendered `body.innerText` and Playwright's body accessibility snapshot must contain **no visible/accessibility 「カテゴリ」**. Internal `category` identifiers are not considered failures.
- Explicit assertions verify 部位 on EXTRA/HISTORY-SELECT/EX-LIST/TI-LIST, 部位別/部位詳細 and the 部位 selector in ANALYSIS, and 追加候補の部位 on both MENU editors. Normal, warning, edit, invalid Restore and failed-save/retry states are included.
- **82 screen/state observations** (41 per width) save accessible-tree + geometry JSON; **96 screenshots** include those states and existing V1.2 scenario captures. All measured page widths fit the viewport, visible controls stay inside the viewport, selected text containers have no hidden overflow, and title/status rectangles do not overlap. [Machine verification summary](verification-summary.json).
- TOP and REGION status computed font = 12px + 1pt (~13.3333px). Run number+unit = 14px + 1pt on desktop / 13px + 1pt at 360px; unchanged existing increment, no second +1pt. [CSS/read-back record](narrow-pc-emulation-target-screen-css-nonmutation.json).
- Screenshots of all requested target groups are retained: TOP, REGION, EXTRA-LIST, HISTORY-SELECT, EX-LIST, TI-LIST, ANALYSIS region/detail, MENU-NEW/EDIT, plus DISPLAY/RUN/HISTORY and warning/edit/Restore failure states. Selected narrow Restore-preview and MENU-edit screenshots were manually viewed; the complete set was mechanically inspected as above. This is not a claim of exhaustive human review of every screenshot.

## TEST_SPEC 16-case correspondence

All results below are Codex PC execution Evidence. QA performs its own 16-case reconciliation and judgment.

| TEST_SPEC | Fixture/scenario / evidence | PC result and boundary |
|---|---|---|
| Q01 | Existing `TOP two projections...`, `REGION current planned...` in issue30-v12.spec.ts; multiple Entries/current Sessions/Extra | PASS; counts/load and one-row identity |
| Q02 | Existing `completed Entry re-execution...` and `REGION...completed Entry...PLAN-RUN` | PASS; new Session vs preserved originals |
| Q03 | Existing `specific repeated Session cancellation...`, TOP actuals toggle | PASS; only selected Session removed |
| Q04 | Existing TOP/REGION/MENU Option tests + displayPreferences unit | PASS for exercised permutations, skipped concepts, name/ID/order invariants |
| Q05 | Existing topProjection unit synthetic comparator + duplicate-pair rejection | PASS synthetic; no invalid equal pair admitted as canonical browser fixture |
| Q06 | Existing TOP two-projection 0/7 weekdays and separate Entry/actual axes | PASS |
| Q07 | Existing REGION current/snapshot/missing/snapshot-only tests | PASS; snapshot nonmutation |
| **Q08** | Added `Q08 independent Default/Option...` + existing editor/quota tests; `DISPLAY-*.png`, `display-independent-readback.json` | **PASS**; both definitions, save/reload, discard, failure and retry |
| **Q09** | Added 5 Restore scenarios (invalid loop, three independent fallback cases, quota) + existing old-v1 case; `restore-*.png`, `fallback-*-readback.json` | **PASS** for specified Error/fallback/confirmation/read-back and pre-write quota fault |
| **Q10** | Three repair fixtures + cross-route ambiguous case; `classification-*.png`, `ambiguous-*.png`, full read-back JSON | **PASS** for supported warning routes; blank core label remains rejected |
| Q11 | Existing unit open-label/order/fallback tests + added custom-order fallback preview/read-back | PASS for tested settings; no app region-order editor introduced |
| Q12 | Existing Extra AND E2E + 2/4/6/10-day and leap/year boundary unit cases | PASS |
| Q13 | Existing EX/TI/EXTRA/MENU/name/history tests plus target-state inventory; MENU original arrays/order checked | PASS for executed scenarios; not every possible list permutation |
| **Q14** | Added target-screen CSS/geometry at 1280/360; existing long title/125.25 kg Issue28 regression | **PC PASS**; Android/PWA MAN unperformed |
| **Q15** | 82 rendered/accessibility/geometry states + correct visible/aria labels and warning/edit/retry actions | **Automated PC PASS**; warning comprehension/final wording remains QA/Owner judgment |
| **Q16** | Unchanged Issue28 suite 8/8, existing V1.2 22/22, all-store/read-back checks | **PASS** within tested fixtures and local environment |

## Scope and remaining work

Changed files: `.gitignore`, new `e2e/issue30-v12-additional.spec.ts`, new `playwright.v12-additional.config.ts` and `playwright.v12-additional-regression.config.ts`, result index pointer and this Evidence directory. No runtime code or baseline/oracle changes.

This is **not all-30-screen/all-state coverage**. Untested by this additional inventory include Trainer import/export/management-off flows, profile editing, initial cutover/recovery/bootstrap screens, every lifecycle/archive/empty-state variant, all dialog branches and real browser/device/storage-failure combinations. Existing regression Evidence does not turn these into newly tested paths. All specifically requested target screen groups and the listed warning/edit/failure states were covered at both PC widths.

QA final PASS, Owner understanding/visual acceptance, Owner Android/PWA MAN, live-data classification inconsistency count, Production identity and deployment approval remain separate. No real data was read or changed for these fixtures. The test clock intentionally uses 2026-10-24 as a reproducible fixture; execution/report date is 2026-10-25 JST.

**RETURN TO: QA（お嬢）／PMO（親分）**. BLOCKED BY: none for these requested automated checks. WAIT FOR: QA's Evidence-to-TEST_SPEC reconciliation and updated judgment. OWNER ACTION: no new implementation/scope GO required; if QA is not active, start 「Issue #30のCodex追加検証Evidenceを確認し、16ケースのQA判定を更新して」. Posting the return does not itself prove receiving-role read receipt or automatic resumption. Commit SHA/push/PR identity are recorded in the Issue return and PR #4; draft remains unmerged and deployment is untouched.
