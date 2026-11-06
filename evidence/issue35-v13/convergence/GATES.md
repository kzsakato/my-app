# §7 gate evidence inventory — QA #6685326677

These are implementation observations for independent QA review.

| Gate | Existing evidence can close | Open / next owner |
|---|---|---|
| AN-01 / AN-G01–07 | Five actual 360×800 build captures with 12-point PT and six region series, exact oracle vs plot. AX-01/AX-01b, boundaries, ZERO vs NO_ENTRY vs INVALID in saved tests. See section7-fault, continuation and section7-boundaries. | QA independent check, Owner visual acceptance. No arbitrary extra PNG count. |
| MIG-01 | Actual synthetic export produced by fixed V1.2 source, test-only external outer2 upgrade, first atomic restore, independent full facts/array comparison, used-target rejection. See section7-closeout. | Operational external upgrade and live transfer require separate authorization. Synthetic scope can be independently reviewed now. |
| PR-01–06 | Full three-target write, non-target records, stale second tab, confirmed pre-commit abort, read-back failure and failed marker clear retaining durable HELD. See section7-fault and section7-closeout. | Genuine uncertain native abort/commit-race durability was not reproduced. No assertion about surviving data in that case. |
| Abort matrix | QA #6685206083 local LIMITED PASS. All four observe real abort; wrapper throws after native rollback in two branches. See abort-matrix. | No repeat needed for these four branches. It is not evidence of real failed native abort. |
| UI-03 | Two Session/snapshot facts and memo preserved, cancellation and injected precommit failure unchanged, confirmed TRAINER→MAN and ordinary prompt thereafter. See section7-boundaries and section7-app. | Independent QA. |
| F-5 | Synthetic Context raw hash and all projection IDs/date summary; optional activeMenuId and archived identity unit coverage. See section7-closeout. | Private live read by next Trainer BODY and operational A outside this GO. |
| ENV-04/05 | Unit guard evidence and previously recorded synthetic probe. | Prior fixed-root BLOCK retained, V1.3→V1.4 browser guard verification as directed. No new V1.3 gate. |
| Suite regression | Actions #42219449821 unit/build pass, normal 81/119, release 14/46. | Suite still fails. See per-case comparison. |

No QA PASS, MAN, merge, deploy or real-data action.
