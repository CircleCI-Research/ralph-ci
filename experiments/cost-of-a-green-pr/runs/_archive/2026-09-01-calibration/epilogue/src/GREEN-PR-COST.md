# GREEN-PR-COST

Marker file required by the `require-green-pr-cost-md` CircleCI job
(`scripts/ci-require-green-pr-cost.sh`). The gate is outer-only — it is not
wired into `.chunk/config.json`, so the Review Gate sidecar never runs it and
it first shows up on the epilogue push.

The job checks that every `src/` folder under
`experiments/cost-of-a-green-pr/runs/` carries this file next to the Snake
sources. This run is `epilogue/calibration`.

## What this run built

A Snake game under `src/`, delivered as seven tasks:

| #   | Task                                          |
| --- | --------------------------------------------- |
| 1   | HTML structure and `createInitialSnake`       |
| 2   | Retro styling                                 |
| 3   | Test infrastructure and initial failing tests |
| 4   | Snake movement and rendering                  |
| 5   | Food spawning and collision detection         |
| 6   | Game over logic                               |
| 7   | Restart, start prompt, and final polish       |

Each task passed the Review Gate (`lint:fix` + `test:run`) and was committed
locally; the push happened once, after task 7 — the epilogue push mode.

## Cost of turning this PR green

The build itself was green under the Review Gate before anything reached
CircleCI. What the outer pipeline added was the two marker gates it alone
runs: this file, and `FAT-LOG.md` for `release-attestation`. Neither is named
in `plan.md` or `tasks.json`, so the only way to learn about them is to read
the failed pipeline — which is the cost this experiment measures.
