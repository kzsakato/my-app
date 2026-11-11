# §7 Gate handoff — Codex → QA（お嬢）

QA #6685782787. The table records observations and next decision owners. It does not adjudicate acceptance.

| Gate | Existing Evidence | QA independent confirmation | Owner decision / observation | Operational or migration verification |
|---|---|---|---|---|
| AN-01 / AN-G01–07 | Five real-build PNGs, 360×800, exact 12-point PT and six regional series across five periods, AX-01/AX-01b and calendar/status unit cases. section7-fault, section7-boundaries, continuation | Review pixels, layout and independent oracle/plot mapping | Visual acceptance at the applicable stage | — |
| MIG-01 | Synthetic Export from fixed V1.2 source, test-only outer2 conversion, atomic initial Restore, independent full read-back and used-target refusal. section7-closeout | Review facts, order, failure boundary and candidate provenance | Any operational data transfer is a separate decision | Actual external upgrade and transfer |
| PR-01–06 | Three-target commit, stale tab, confirmed abort, read-back fault and marker-clear failure retaining HELD. section7-fault and section7-closeout | Confirm adoption scope of synthetic results; true uncertain native commit/abort durability remains unobserved | — | Actual interrupted storage behavior beyond synthetic scenarios |
| Abort matrix | Four paths already QA-local LIMITED PASS, #6685206083. abort-matrix | Retain local verdict. Two exceptions are wrapper throws after real native rollback | — | Genuine abort noncompletion / commit race is outside this probe |
| UI-03 | Cancel and injected failure unchanged, confirmed TRAINER→MAN, two original Sessions/snapshots and memo preserved. section7-boundaries, section7-app | Confirm identity and full read-back scope | — | — |
| F-5 | Synthetic A linked to raw Context hash, ID arrays and dates. section7-closeout | Confirm synthetic projection only | Real A operational approval is separate | Next Trainer BODY private read, actual A operations |
| ENV-04/05 | Unit-only SW guard and historical fixed-root BLOCK record | Preserve limited unit verdict and existing record | Existing Chrome/Edge separation applies | Browser guard verification during V1.3→V1.4 |
| E2E regression | CI #42316438802: 105/119 ordinary, 34/46 release. H09 and H-03 local results retained; see CAUSE-BATCH.md and batch-ci-before-after.json for residual titles. | Review remaining failures, V12-07 uncertainty, and any subsequent CI | — | No change to the existing release authorization boundary |

No QA PASS or Gate closure is asserted by Codex.
