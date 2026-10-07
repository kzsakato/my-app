# H-17 same-artifact Production promotion

Owner requested promotion of MAN-completed `118ff493` on 2026-10-07.
`118ff493/product/` preserves the eight saved Product files used at Simple
Staging, without rebuilding. `manifest.json` records their SHA-256 and sizes.
Staging entry, fixture and configuration are excluded. Git text conversion is
disabled for these artifact bytes.

Pages verifies this exact directory and uploads it directly. Changes to Product
source alone do not release a newly built candidate. A future release must
explicitly select its MAN-approved saved artifact and update the workflow and
verifier. Evidence-only changes outside `release/` do not redeploy.

Product source baseline: `118ff493838fa35aa0a80e88532d8731e4005c38`.
Build shown by these bytes: `2026-10-06 / 118ff493`.
Production URL: https://kzsakato.github.io/my-app/

This deploy transfers static files only, not browser data or Staging's fixture.
Runtime selection still depends on each browser partition's existing authority.
Release smoke uses an isolated automation partition and does not establish the
state or acceptance of the Owner's Production partition.
