# SNAKE 🐍🕹️

Marker file required by the Chunk sidecar gate `require-cost-of-a-green-pr-snake-md`
(`scripts/chunk-remote-env.sh --gate-cost-of-a-green-pr-snake`, mirrored by
`scripts/ci-require-cost-of-a-green-pr-snake-md.sh`).

The gate scans every `experiments/cost-of-a-green-pr/runs/*/*/src/` folder that
contains files and requires a `SNAKE.md` holding the literal marker `🐍🕹️`
(see the heading above). This file covers the `treatment/calibration` run.
