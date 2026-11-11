# Issue #35 — remaining CI failures

QA #6685326677. Completed Actions #42219449821, e523f0d: unit 195 and build success; normal 81 PASS / 38 FAIL (119), release 14 PASS / 32 FAIL (46). Failure title sets are identical to #42216989686. ci-failures.json lists each title. CI logs and playwright-report artifact: https://github.com/kzsakato/my-app/actions/runs/42219449821/artifacts/13503763150

## Same-condition comparison

Read-only fixed product baseline c4fe4514 vs e523f0d in detached local worktrees. Both used the e523f0d test files and ordinary/release Playwright configurations, Windows, Node v24.21.0, same local Chromium, same test fixture and ports per suite. The comparison selected only the CI failures, set default timeouts to 9s/4s (per-test timeouts retained), and disabled screenshot/video/trace capture for the diagnostic rerun. This is not a Linux baseline CI replay. Every test has a row in base-head-cases.json. Error signatures use exact locator, expected/actual or validation diff where present.

- Normal: 37/38 reproduced at the same observed failure on both checkouts. V12-07 passed on both Windows checkouts. Linux CI's row-height expected 57 / received 58 remains unreproduced locally; no cause or platform-only conclusion asserted.
- Release: 32/32 reproduced at the same observed failure on both checkouts.
- No head-only failure in the Windows comparison. Baseline-common describes reproduction, not root cause. Underlying causes for other cases remain unclassified unless identified individually. Prior candidate/4182 startup problems are not attributed to this run. No app changes, skipped cases or relaxed oracle.

## Verified fixture and selector correction

H09 Session identity's three fixture variants failed validation on both unmodified test runs due to missing managementMode. The test fixtures now represent legal canonical state with existing defaults and an empty applied-proposal ledger. The test reaches the same actual-record values using the current Run controls and uses the formally specified TOP T-07/T-08 Session numerators. Exact count, independent identity, cancellation, Session/snapshot comparisons, legacy non-interference and persisted full-root equality remain asserted. Three targeted cases pass in fixed-baseline ordinary, PR ordinary and PR release Chromium. No case dropped. An earlier parallel local attempt timed out on the common-menu locator; the exact rerun passed. No assertion changed in the snapshot-only variant beyond the shared formal region navigation helper.

See GATES.md for reusable existing evidence and true external validation boundaries.
