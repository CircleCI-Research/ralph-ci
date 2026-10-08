# SNAKE 🐍🕹️

Marker file required by the `require-cost-of-a-green-pr-snake-md` gate
(Chunk sidecar `validate --remote` and its CircleCI mirror).

This run (`control/calibration`) builds a Snake game under `src/`:

- `index.html` — canvas, score, and start/game-over overlays (the latter
  carrying the restart button)
- `style.css` — retro arcade styling: centred board, neon canvas border, overlays
- `game.js` — ES module exporting `GRID_SIZE`, `COLORS`, `DIRECTIONS`,
  `KEY_DIRECTIONS`, `createInitialSnake`, `moveSnake`, `checkWallCollision`,
  `checkSelfCollision`, `checkFoodCollision`, `spawnFood`, `getNewDirection`,
  `directionFromKey`, `drawBoard`, `createGame` and `startGame`; the
  controller also exposes `reset`/`restart`
- `game.test.ts` — vitest coverage for the initial snake state, movement, all
  three collision checks, food spawning and eating, direction handling, canvas
  rendering, the 150ms game loop and the arrow-key controls (driven through a
  fake document, fake timers and a seeded random source), plus the restart
  path — button click, SPACE, score/snake/food/overlay reset and the
  play-die-restart-die loop end to end
- `style.test.ts` — vitest coverage for the index.html/style.css styling contract
- `README.md` — how to run and play the game, the rules, and the module API
