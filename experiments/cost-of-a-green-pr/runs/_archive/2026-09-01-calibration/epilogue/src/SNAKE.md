# SNAKE 🐍🕹️

Marker file required by the `require-cost-of-a-green-pr-snake-md` gate
(Chunk sidecar `validate --remote` and its CircleCI mirror).

This run (`epilogue/calibration`) builds a Snake game under `src/`:

- `index.html` — canvas, score, and start/game-over overlay
- `style.css` — retro dark/phosphor-green styling for the board and overlay
- `game.js` — ES module exporting the board constants (`GRID_SIZE`,
  `DIRECTIONS`, `KEY_DIRECTIONS`, `TICK_MS`, `COLORS`), the pure state
  functions (`createInitialSnake`, `createInitialState`, `restartState`,
  `startState`, `moveSnake`, `getNewDirection`, `applyInput`, `step`,
  `checkWallCollision`, `checkSelfCollision`, `checkFoodCollision`,
  `spawnFood`), the screen text (`formatScore`, `gameOverMessage`,
  `overlayState`), the canvas painters (`drawSnake`, `drawFood`, `render`),
  and `startGame()`, which wires the canvas, keyboard, Restart button, and
  tick loop
- `game.test.ts` — vitest coverage for the snake state, movement, direction
  handling, collision detection, food spawning, scoring, and the
  start/game-over/restart phases
- `README.md` — how to serve and play the game, and what the controls do
