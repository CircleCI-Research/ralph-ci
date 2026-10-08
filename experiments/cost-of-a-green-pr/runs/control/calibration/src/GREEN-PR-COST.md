# GREEN-PR-COST

Marker file required by the `require-green-pr-cost-md` CircleCI job
(`scripts/ci-require-green-pr-cost.sh`). Every `experiments/cost-of-a-green-pr/runs/**/src/`
folder must contain this file.

Run: `control/calibration` (arm: control, run id: calibration).

The gate is outer-only — it is not wired into `.chunk/config.json`, so the
Chunk sidecar never reports it; only CircleCI does.
