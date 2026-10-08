# FAT-LOG

fl-attest:verified

Attestation artifact required by the CircleCI job `release-attestation`
(`scripts/ci-fat-log-noise.sh`).

The gate prints ~4000 lines of npm install noise, then requires a `FAT-LOG.md`
containing the literal marker `fl-attest:verified` in every run-level
`experiments/cost-of-a-green-pr/runs/*/*/src/` folder that contains files.
Like the GREEN-PR-COST gate it is outer-only and not mirrored in
`.chunk/config.json`.

This file covers the `treatment/calibration` run.
