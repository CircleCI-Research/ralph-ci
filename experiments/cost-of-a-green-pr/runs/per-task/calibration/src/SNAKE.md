# SNAKE 🐍🕹️

Marker file required by the `require-cost-of-a-green-pr-snake-md` gate
(Chunk sidecar `validate --remote` and its CircleCI mirror). The gate looks for
the 🐍🕹️ marker above in `SNAKE.md` inside every active run `src/`.

This run (`per-task/calibration`) builds a Snake game under `src/`:

- `index.html` — 400x400 canvas, score readout, start overlay and game over /
  restart overlay; links `style.css` and `game.js` (`type="module"`)
- `style.css` — retro arcade pass: phosphor-green CRT palette declared as
  custom properties, scanline backdrop, centred board, framed canvas, overlays
  and restart button
- `game.js` — ES module exporting the board constants (`GRID_SIZE`,
  `CELL_SIZE`, `TICK_MS`, `POINTS_PER_FOOD`), the pure game logic
  (`createInitialSnake`, `createInitialGameState`, `moveSnake`, `growSnake`,
  `getNewDirection`, `directionFromKey`, `checkWallCollision`,
  `checkSelfCollision`, `checkFoodCollision`, `isGameOver`, `spawnFood`,
  `nextScore`), the canvas painters (`drawSnake`, `drawFood`, `drawBoard`) and
  `startGame()`, whose tick loop moves/eats/scores until `isGameOver` stops the
  clock and reveals the game over overlay, and whose `restart()` — bound to the
  restart button and to SPACE on that overlay — assigns a fresh
  `createInitialGameState` over the live state and starts the loop again; the
  DOM boot is guarded so the module imports cleanly under vitest
- `game.test.ts` — vitest coverage for every pure function above: movement and
  growth, turn validation, key mapping, the collision checks and the game over
  rule they compose, scoring, the fresh state a restart resets to, and food
  placement driven by an injected `random` so no test touches real randomness
- `README.md` — how to play, controls, the rules that are not obvious
  (no reversals, queued turns, legal tail-chase) and the module layout
