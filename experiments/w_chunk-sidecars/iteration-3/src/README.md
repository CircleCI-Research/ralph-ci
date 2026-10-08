# Snake

A classic Snake game built with HTML5 Canvas and vanilla JavaScript ES
modules. Logic is split into pure, testable functions in `game.js`, with a
thin DOM/canvas shim (`startGame`) that wires keyboard input, the render
loop, and the start/game-over UI.

## Play

1. Open `index.html` in any modern browser (or serve the folder with any
   static file server — `python3 -m http.server`, `npx serve`, etc.).
2. Press **SPACE** to start.
3. Steer with the **arrow keys**.
4. Eat the red food to grow and score a point. Hit a wall or yourself and
   it's game over.
5. On the game-over screen, press **SPACE** or click **Restart** to play
   again.

## Rules

- **Grid:** 20×20 cells, 20px each (400×400 canvas).
- **Tick:** the snake advances one cell every 150ms.
- **Direction changes:** instant on arrow press, but 180° reversals are
  ignored (you cannot walk back into your own neck).
- **Collisions:** walking off the grid or into your own body ends the run.

## Project layout

- `index.html` — markup: canvas, score, game-over overlay, start message.
- `style.css` — retro neon styling.
- `game.js` — game logic (pure functions) + `startGame` (DOM wiring).
- `game.test.ts` — Vitest unit tests for the pure functions.

## Tests

From the repo root:

```
pnpm test:run
```

Tests cover initial snake creation, movement, wall / self / food
collisions, food spawning (with seeded RNG), direction filtering, the
per-tick state transition, and fresh-state creation used by restart.
