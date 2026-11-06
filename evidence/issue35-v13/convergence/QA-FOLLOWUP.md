# Follow-up to QA #6685782787

Actions #42224306287 (0930e7e) completed/failure. Unit and build succeeded. Normal 85 PASS / 34 FAIL (119), release 18 PASS / 28 FAIL (46). In each suite, H09 different-entries, different-items-extra, same-membership and snapshot-only were removed from the failure list; zero additions. See latest-ci-cases.json for titles and previous comparison references.

For remaining titles, earlier same-test Windows comparison gives 33 ordinary and 28 release baseline-common observations; no head-only observation. V12-07 passed on both local Windows builds, while CI observed row height 57 vs 58. Its root cause remains unclassified. The per-title observedKind is a symptom or fixture/selector indication; it does not assert that Linux and Windows have identical root causes. The prior comparison ran with shortened default timeout and diagnostic capture disabled.

The additional H-03 change is test-only in e2e/v1r-acceptance.spec.ts. It seeds explicit required MAN fields and accepted defaults, uses the existing weekday chooser and exact Session identity, verifies the same date and snapshot label, and retains the 14-marker oracle, full-record read-back, reload and legacy noninterference. H-03 3/3 on fixed c4fe4514 and the PR-side ordinary Chromium builds. PR release targeted H-03 and H09 together 7/7. No product code or data contract changes. Full updated CI is separate.

Updated GATES.md separates implementation evidence, QA independent confirmation, Owner decision/observation, and operational or migration verification. ENV-04/05 existing record and abort-local verdict are retained. No gate adjudicated by Codex.

CI artifact: https://github.com/kzsakato/my-app/actions/runs/42224306287/artifacts/13506167413
