# QA #6686298237 follow-up

Actions #42227764758 (9984099) completed/failure. Unit/build succeeded, normal E2E 88 PASS / 31 FAIL (119), release 21 PASS / 25 FAIL (46). All three H-03 cancellation titles moved from FAIL to PASS in both suites; no new failure titles. H09 stays passing. Full titles, deltas, and comparison classification are in ci-42227764758-cases.json. CI artifact https://github.com/kzsakato/my-app/actions/runs/42227764758/artifacts/13509015818

Earlier identical-spec Windows comparisons cover the remaining 30 ordinary and 25 release failures at the same observed point on the fixed V1.2 baseline and PR head. No observed head-only failure. Ordinary V12-07 passes locally on both and remains an unclassified Linux 57/58 px mismatch. Locator, fixture and expectation symptoms in the per-case file do not imply an identified product cause.

## Test-only fixes

- H-03 Extra 4/5: legal canonical fixture, current region and exact Session-ID route, identical verification of date, actual load/reps/sets/seat, no previous actual, 14-day markers, and full independent read-back/reload. The additional actual still may not impersonate a planned entry.
- OIC-015: explicit valid fixture, require full canonical equality with the newly selected weekday after each accepted warning. Cancellation and reload comparison retained.
- Clock Sunday boundary: formally required TOP T-08 numerator is one Session, denominator two Entries. Other date boundary assertions retained.
- H06 A1/A4/A5: required fixture facts, actual visible Run values and formal TOP T-07/T-08 Session numerators; exact identity/cancellation, marker, chronology and full-state equality retained.

Targeted ordinary: H-03 and calendar 11/11 each on fixed V1.2 and PR; H06 3/3 each. Targeted PR release 18/18 includes H09 four. Local overlapping first attempts had server/artifact collisions, and a host interruption produced file/network errors. Those attempts are excluded from pass evidence. Clean reruns are attached. Product code and data structures unchanged. Updated full CI must be read separately.

QA must independently review test-oracle sourcing, remaining CI and existing AN/MIG/PR/UI evidence. Gate inventory stays separate from QA/Owner acceptance. No SW browser guard retest, legacy worker/profile or data operations.
