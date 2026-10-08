# SNAKE 🐍🕹️

Marker file required by the `require-cost-of-a-green-pr-snake-md` gate
(Chunk sidecar `validate --remote` and its CircleCI mirror,
`scripts/ci-require-cost-of-a-green-pr-snake-md.sh`). Every active run
`src/` under `experiments/cost-of-a-green-pr/runs/` needs this file with the
marker above.

Run: `single-push/calibration` (arm: single-push, run id: calibration).

This run builds a Snake game under `src/`:

- `index.html` — canvas, score display, and start / game-over overlays
- `game.js` — ES module with the pure game logic exports
- `game.test.ts` — vitest coverage for the exported logic
