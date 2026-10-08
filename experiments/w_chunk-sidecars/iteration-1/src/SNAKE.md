# SNAKE 🐍🕹️

This iteration builds a Snake game as part of the `w_chunk-sidecars` experiment.

Source files live alongside this marker in `src/`:

- `index.html` — game canvas and page chrome
- `game.js` — game logic (ES module)
- `game.test.ts` — Vitest unit tests

The Chunk sidecar `--gate-snake` policy gate requires this file to be present in
each `experiments/w_chunk-sidecars/*/src/` folder and to contain the literal
marker `SNAKE 🐍🕹️` (see `scripts/chunk-remote-env.sh`).
