# §7 synthetic persistence and plot verification

Product build ff69edd. Isolated application test 3/3 PASS, unit 195/195 PASS. Chromium on loopback, Asia/Tokyo, 2026-11-06, viewport 360×800, synthetic data only.

- PR-05/06: A synchronous canonical put failure is classified as zero mutation only after IDB accepts the explicit abort. Independent read-back confirms the original root and marker, with the file input still available for a new explicit submission. In the separate post-commit read-back fault, the entire three-target proposal and ledger are present at revision 1, the pending marker persists, no success appears, the input is disabled, and the application remains held after reload. Restore now uses the same confirmed-abort classification. Remaining uncovered cases include an indeterminate marker-clear and concurrent owner writer at each failure stage.
- MIG-01 and PR-04: first restore, second-tab restore rejection, first Proposal and stale different Proposal rejection all checked in the same actual app run. Inputs and complete read-back results are stored in the attached JSON. This uses a synthetic already-upgraded outer2 fixture; execution of an external one-time upgrade is not claimed.
- AN-G06: all seven plot arrays (PT plus six regions) match independent 12-point vectors in week/month/quarter/half/year. Week and month separate 36/530; quarter/half/year sum to 566. Per-region expected vectors and actual values are in AN-G06-periods.json, mapped to five full-page PNGs. Earlier AX-01b and legal ZERO/INVALID/boundary Evidence is separate. Owner visual assessment and QA independent verdict remain pending.

No browser test of guard ownership, root navigation, registration, or offline behavior. No fixed V1.2 or real data.
