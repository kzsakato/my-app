# PREPARED attribution investigation — 2026-10-05

Status: **NOT MAN READY. Owner device attribution unresolved.** No Owner storage reset, cache deletion, migration, or reinstall performed/requested.

## Facts and timeline (JST)

- 2026-10-04 23:40:52: saved read-back receipt belongs to `H-20261004-11-automation` on PC Playwright, not Android.
- 2026-10-04 23:49:18.835: server deployed Owner run at version `df682b17-34d7-4fdb-b3ba-903d2fbb941e`. The old `owner-run-evidence.json` is a PC smoke test using that run; it explicitly says `ownerDeviceTested:false`. The run name alone does not identify the browser/device.
- User later reported `PREPARED` in chat. No device, browser partition, attempt ID, or client completion callback was attached to that message. H-11 incorrectly promoted it to a confirmed Owner-partition preparation result.
- 2026-10-05 08:59:27.732: after that report, deployment `76508502-5715-4a95-9f9d-205a14c477fe` closed the gate. This is the Cloudflare deployment timestamp, not an inferred client execution timestamp.
- Owner subsequently reported legacy Settings on Android Brave despite the expected Build, and canonical UI on PC.

The server only authenticated bundle/authorization requests. It did not store device-bound preparation completion receipts. Existing files cannot retrospectively prove that the earlier PREPARED was displayed in the same Android partition used for the later ordinary visit. The historical device question remains pending.

## Source interpretation and reproduction

Accepted `loadData()` reads browser-local cutover authority. Missing/false authority selects legacy; true authority plus invalid canonical data selects recovery, not silent legacy fallback. Build identifies the shared bundle containing both runtime paths, not local authority.

`prepare()` emits PREPARED only after successful cutover/bootstrap/menu/activation, exact full-data read-back, authority/baseline checks, startup checks, and completion receipt in the executing browser. It does not seed another browser or device. Revoking the Worker gate disables subsequent preparation requests/writes; it has no mechanism to delete existing browser data.

`partition-investigation.json` reproduces identical Build with canonical UI/authority/fixture in a prepared PC test profile versus legacy UI/missing authority in a fresh mobile-emulation context. This is **not an inspection of actual Owner Android**. Post-revocation ordinary reload/restart still retains the prepared automation data (`revoked-evidence.json`). If actual PREPARED was shown on the same Android partition, the intervening partition/storage/runtime path still needs investigation; do not guess that Owner cleared data.

## Correction and next boundary

PMO's release-neutral Staging identity was available and established at `https://my-app-staging.kzsakato-lab.workers.dev/`. It uses the same eight immutable Product assets. Closed-gate version: `c1bdde97-e1fe-4b09-b0e4-6cdd42e56b8e`. Old `my-app-staging-v1r` remains closed and its data is not reset or moved.

The tool now shows a non-sensitive run/attempt ID derived from its local completed receipt. Future Owner preparation tokens must not be used to initialize PC test profiles; automation scripts enforce this distinction. Metadata still cannot independently identify physical Android hardware: obtain the explicit Owner device/browser report and preserve the final visible-runtime checkpoint.

Tooling build and TypeScript PASS, isolated unit tests20/20 PASS. New-origin HTTPS preparation, duplicate, tab interruption, network loss, ordinary canonical Settings, Monday, reload/restart, artifact hashes, and revocation PASS. An initial reproduction probe targeted a local automation profile removed by the prior tooling build's `emptyOutDir:true`; it did not establish the desired comparison. The build now preserves test profiles/evidence and the successful comparison was performed after explicit new-origin automated preparation. That local test-directory lifecycle is not evidence of any Owner storage deletion.

No new Owner capability has been issued during this investigation. Both origins' mutation gates are closed. First identify where the earlier PREPARED was displayed; then use a new bounded Owner-only run on the final neutral origin, explicitly in Android normal Brave, record PREPARED plus attempt ID, revoke, and confirm the ordinary canonical UI in that same partition before any MAN READY decision. A dirty/partial state stops; it is never auto-reset.
