# §7 application closeout — PMO #6684451890

Product build 2a2fe51 (V1.3 isolated app only). 195 unit tests passed on retry with two workers; the first unbounded local run failed to resolve a Vitest dependency in one suite. Isolated build succeeded and the five Chromium app tests passed.

- Marker clear: reread the clear in the same locked write transaction, then await commit. Synthetic reread failure aborts the clear. The prior independently verified three-target canonical write remains intact, its durable pending marker survives, and reload stays HELD. Previously captured pre-commit abort and initial post-commit read-back fault remain distinct cases.
- MIG-01: H12 captured a real Export from fixed V1.2 source using a synthetic seed. The test-only external upgrade changes outer version 1→2 and adds only revision 0 and an empty contribution map. The app commits into the unused isolated target, separate IDB reads match all old fields and array order, and a stale second preview is rejected without changing root or marker. No operational upgrade or data transfer.
- H13, H12 Run history, H12 Trainer Settings: identical corrected specs pass on fixed c4fe4514 source and PR-side source under the same ordinary Chromium configuration. Only test prerequisites/selectors were corrected. H13 retained 260 pt/2.50 across a Master edit. Run history uses stable entry identity and TOP T-08 one Session/two entries, then 0/2 after week rollover. Trainer headings and controls follow formal TR-01–03/TR-07–08; MAN assertions are retained.
- F-5: verified the synthetic index against the exact saved synthetic Context bytes (SHA-256), full arrays/IDs and optional activeMenuId, per-TI last date, and no embedded Session/history. No real A or next-body operation.
- Analysis inputs, all five exact plot vectors and matching real-build 360px images are linked from section7-fault; calendar boundary unit cases are in section7-boundaries. No new SW browser guard trial, no old root/profile work.

Owner visual assessment and QA independent sign-off are separate. ENV-04/05 retains its prior record under the Owner's V1.3 browser separation plan.
