# Issue #35 — offline Backup preview validators

Input stays in the Data Integration environment. Transfer only validator.cjs into that environment. Do not transfer the private Backup to Codex, GitHub, Actions, a website, or the Issue. The runner reads one file, writes no files or database records, and reports aggregate issue categories without raw messages, record IDs, filenames, or payloads.

- Product source: cfe668b8903ad9e41c2b4e7189762cdcb73e09c3.
- v12 calls the original previewCanonicalRestore(raw) from src/canonical/backup.ts.
- v13 calls the original previewInitialV13Restore(raw) from src/canonical/backupV13.ts.
- validator.cjs SHA-256: 58edcf557dda8466baea1b162dc492693b2fc5020be56994545adcd6c5b82a0f.
- Runtime: Node.js 20+; Node 24 recommended for the permission command below. No npm install, TypeScript runtime, browser, app server, or network needed. Synthetic verification used Node v24.21.0. The only external modules are built-in node:fs and node:crypto.

## Run privately

Verify the bundle with Get-FileHash or sha256sum before opening either input. If a connector returns only file content, save the complete original bytes (or decode the complete GitHub blob base64) locally and check the same SHA-256. Then run each case using the already recorded private input SHA from Data Integration's prior evidence.

    node --permission --allow-fs-read="<absolute path to validator.cjs>" --allow-fs-read="<absolute path to old backup>" "<absolute path to validator.cjs>" v12 "<absolute path to old backup>" "<expected old SHA256>"
    node --permission --allow-fs-read="<absolute path to validator.cjs>" --allow-fs-read="<absolute path to new backup>" "<absolute path to validator.cjs>" v13 "<absolute path to new backup>" "<expected new SHA256>"

Exit 0 means official preview accepted; review any warnings separately. Exit 1 means official preview rejected. Exit 2 means input or runner conditions prevented a usable result. The v13 function throws on rejection, so the single error count is the rejection category and underlying detailed warning/error counts are unavailable. A null warning value means unavailable. PASS is a preview result and grants no permission to restore. Report only the permitted input hash, bundle/source hashes, result, category counts and warning availability.

## Build provenance and synthetic evidence

Build from a clean git archive of src at the source SHA, placing runner.ts.txt as runner.ts beside src. With esbuild 0.28.2 run:

    esbuild runner.ts --bundle --platform=node --format=cjs --target=node20 --minify --legal-comments=inline --outfile=validator.cjs

The TypeScript wrapper calls the actual product functions and reduces only their output. See synthetic-evidence.json for the 10 local synthetic runs, including success, warnings, malformed or wrong version input, duplicate keys, invalid revision and input hash mismatch. All fixture bytes remained identical. No private input was accessed. Data Integration must still confirm that the bundle can be copied into its private execution environment and that Node is available there.
