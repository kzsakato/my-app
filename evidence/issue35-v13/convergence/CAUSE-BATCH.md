# Cause-batched E2E investigation — QA #6698924738

Specified 998c7bb Actions #42313993157 completed/failure. Unit/build succeeded. Normal **94 PASS / 25 FAIL (119)**, release **27 PASS / 19 FAIL (46)**. Compared with #42227764758, H-03 Extra, three H06 actual identity variants, OIC-015 and Sunday boundary cleared in both suites; no newly failing title. All cases, first CI observations, confidence, fixed/PR Windows comparison, disposition and owner are in batch-42313993157-cases.json. Artifact: https://github.com/kzsakato/my-app/actions/runs/42313993157/artifacts/13550313678

## Classification of the first actionable mismatch

| Group | Normal | Release | Evidence and action |
|---|---:|---:|---|
| Fixture / canonical data | 3 | 2 | OIC-013 and H-09 recovery fixture omitted required management facts; Q10/Q15 current planned row was hidden by its same-week Session. Verified corrections in both source lines. |
| Locator / UI operation | 12 | 11 | Includes Q14 with completed rows hidden and the wrong target route, corrected. Other cases need staged route/contract reconciliation. First locator failure does not establish later workflow correctness. |
| Formal expectation mismatch | 8 | 6 | T-07/T-08 Session counts (QA-C02), T-16/TO-04 actual weekdays (H06 A2/A3), and responsive sizing by viewport. OIC-008 first count mismatch confirmed, downstream oracle unresolved. |
| Environment difference candidate | 1 | 0 | V12-07 57/58 px on Linux, both Windows builds passed; root cause unconfirmed. Tech needs a same-image Linux fixed/PR comparison with computed row and font metrics. |
| Product mismatch suspected | 1 | 0 | Actual DEV-only H-07 producer output is rejected by current Trainer import in both builds. Tech #6699111123 asked to decide scope/contract. No product edit. |
| No first-stage classification | 0 | 0 | Subsequent roots remain unverified for the rows explicitly marked as such. |

Earlier Windows comparisons reproduce 24 ordinary and 19 release failures at the same observed point on c4fe4514 and PR, with V12-07 passing both. Evidence only supports common observations under that test setup. No V1.3-only product regression was reproduced. The DEV-only incompatibility was independently reproduced by changing just the test input locator in scratch worktrees and asserting the rejection of the actual downloaded file. The original test and producer/consumer source remain intact.

## Batch correction and verification

- Ordinary canonical / calendar cluster: OIC-013, three QA-C02 variants and two H06 A2/A3 variants. PR normal 6/6, fixed normal 5/6 plus successful OIC-013 rerun after an initial local timeout. The full-record, read-back, fault/hold, individual ID, weekday ordering and OFF assertions stay in place. The fixed and PR H-09 recovery diagnostic each passed using a legal recovery fixture while keeping the deliberately broken old payload. Its single fixture-line correction is included.
- Ordinary display cluster: Issue28 completed Run, Q14 geometry, Q10 ambiguous classification and TOP weekday/weight. Both fixed and PR 4/4; test viewport determines desktop/narrow numeric expectation, while fixtures expose the intended row. Existing status/size, warning, nonmutation and Run persistence assertions are retained.
- Final targeted PR release 7/7. Earlier H09/H-03 and abort Evidence unaffected. No product source, contract, schema, test skip or assertion deletion.
- Full-suite run #42315361871 covers the ten-case first commit 1e7aaf4; the recovery fixture follow-up triggers the final full-suite run.

The per-case list gives the next investigation owner. The existing Gate handoff still distinguishes QA independent verdict, Owner observation and operational verification. No old root/Chrome, real data, merge, deploy or QA acceptance.
