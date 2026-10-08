# GREEN-PR-COST

Marker file required by the CircleCI job `require-green-pr-cost-md`
(`scripts/ci-require-green-pr-cost.sh`).

The gate scans every `experiments/cost-of-a-green-pr/runs/**/src/` folder and
requires a `GREEN-PR-COST.md` to exist alongside the Snake sources. It is an
outer-only gate: it is not mirrored in `.chunk/config.json`, so the Chunk
sidecar does not run it — only the CircleCI pipeline does.

This file covers the `treatment/calibration` run.
