# Release Attestation

Attestation artifact required by the `release-attestation` CircleCI job
(`scripts/ci-fat-log-noise.sh`). Each active run `src/` must contain a
`FAT-LOG.md` carrying the attestation marker below. The job prints ~4000 lines
of synthetic install noise first; only its last lines are actionable.

Run: `per-task/calibration` (workspace: `per-task/calibration/src`).

Marker:

    fl-attest:verified
