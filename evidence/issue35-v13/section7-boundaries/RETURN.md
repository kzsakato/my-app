# §7 calendar and scheduled Run verification

PMO #6683907580. PR #9 product source c560d8d; this change adds evidence and tests.

| Case | Independent expectation | Measured |
|---|---|---|
| AN-G06 week | 2026-08-17 to current bucket 2026-11-02 | 12 buckets, 12 PT at first and last, interior zero |
| AN-G06 month | 2025-12-01 to 2026-11-01 | same values, including year rollover |
| AN-G06 quarter | 2024-01-01 to 2026-10-01 | same values |
| AN-G06 half | 2021-01-01 to 2026-07-01 | same values |
| AN-G06 year | 2015-01-01 to 2026-01-01 | same values |
| AN-G05 | legal ZERO, NO_ENTRY with U=5, all rates zero INVALID | distinct states and no D ratio for first two |
| CTX-01 | inclusive 2026-07-30–2026-11-06, source order | both edges retained, adjacent days excluded |
| UI-03 | cancelled update is identical; confirmed update commits MAN and 19kg, retains two original Sessions including past memo, excludes current draft memo, repeat prompt uses ordinary MAN wording | independent IDB reads match; second cancellation leaves complete post-save root unchanged |

AN-G06 inputs are generated from the unit test date table. Each case contains four records at the first bucket start, the previous day, today, and tomorrow. The included records are 2kg × 2 sides × 3 reps × 1 set = 12 PT each. 100% chest rates yield 2 estimated sets, D2/U0/T2, chest ratio 1.0 and one Exercise.id breakdown with 2. The unit test compares actual 12-point PT arrays and those derived values without using product formulas to generate expectations. These tests complement the existing AX-01/AX-01b fixtures and real-build week plots at 360px, in evidence/issue35-v13/continuation. No new browser guard or old root testing. Further period PNGs, Owner visual review, complete fault matrix, MIG second-restore browser rejection and next-body private live read remain open.

Results: pnpm test 195/195; targeted ordinary-build Playwright UI-03 1/1. The previous H12 2/2 is a targeted result. No suite-wide quality verdict.
