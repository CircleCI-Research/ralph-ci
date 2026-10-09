# Cost of a Green PR

Classic Snake builds that compare how often an agent loop pushes to CircleCI. Same seven-task game. The later runs use a sidecar inner loop and a preflight pass before task 1.

Background: [Pencils down: The cost of a green PR](https://www.confidentcommit.com/p/cost-of-a-green-pr).

## Play

Serve a run's `src/` directory and open the printed URL. For example:

```bash
python3 -m http.server -d experiments/cost-of-a-green-pr/runs/single-push/calibration/src
```

| Run                    | Path                                                            |
| ---------------------- | --------------------------------------------------------------- |
| Phase 1 per-task       | `runs/per-task/calibration/src/index.html`                      |
| Phase 1 single-push    | `runs/single-push/calibration/src/index.html`                   |
| Control                | `runs/control/calibration/src/index.html`                       |
| Historical control     | `runs/_archive/2026-09-01-calibration/control/src/index.html`   |
| Historical per-task    | `runs/_archive/2026-09-01-calibration/treatment/src/index.html` |
| Historical single-push | `runs/_archive/2026-09-01-calibration/epilogue/src/index.html`  |

`metrics.json` and `activity.md` beside each game are the run record. The archive trio is the earlier calibration, not a copy of the Phase 1 games.

## Headline numbers

Native units stay separate. LLM dollars, wall-clock, and CI credits are not one score.

| Arm                    | Era     | Green            | LLM $ | Wall (min) | Pipeline runs | Est. CI credits | CI Doctor | Failure log chars |
| ---------------------- | ------- | ---------------- | ----- | ---------- | ------------- | --------------- | --------- | ----------------- |
| control                | Hist    | yes              | 16.75 | 56.3       | 8             | 93.9            | 3         | 800,898           |
| treatment → per-task   | Hist    | yes              | 14.27 | 50.7       | 8             | 98.0            | 3         | 19,936            |
| epilogue → single-push | Hist    | yes              | 13.78 | 62.9       | ≥1            | n/a             | 1         | 0                 |
| per-task               | Phase 1 | 7/7 every-commit | 17.15 | 55.5       | 7             | 81.4            | 0         | 0                 |
| single-push            | Phase 1 | firstPushGreen   | 15.73 | 56.7       | 1             | 14.0            | 0         | 0                 |

The historical single-push run under-counted pipelines in `metrics.json`. Treat that cell as at least one pipeline and leave credits blank.
