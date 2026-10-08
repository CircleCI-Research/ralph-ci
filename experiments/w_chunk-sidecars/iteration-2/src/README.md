# Classic Snake Game

A small, retro-styled Snake game built with HTML5 Canvas and vanilla
JavaScript (ES modules). The core game logic is split into pure functions so
it can be unit tested with Vitest.

## How to play

1. Open `index.html` in any modern browser.
2. Press **SPACE** to start a new game.
3. Use the **arrow keys** to steer the snake.
4. Eat the red food to grow and score points.
5. Avoid running into the walls or your own body — that ends the game.
6. When the game ends, click **Restart Game** or press **SPACE** to play
   again.

## Controls

| Key           | Action                   |
| ------------- | ------------------------ |
| `Space`       | Start / restart the game |
| `Arrow Up`    | Turn the snake up        |
| `Arrow Down`  | Turn the snake down      |
| `Arrow Left`  | Turn the snake left      |
| `Arrow Right` | Turn the snake right     |

180-degree turns are ignored (e.g. while moving right, pressing left does
nothing) so the snake cannot instantly collide with itself.

## File layout

- `index.html` — page markup, canvas, score and overlay elements.
- `style.css` — retro-arcade styling (dark background, neon-green accents).
- `game.js` — game logic plus DOM/canvas glue. Exports pure helpers used by
  the test suite:
  - `createInitialSnake`, `createGameState`
  - `moveSnake`, `getNewDirection`
  - `checkWallCollision`, `checkSelfCollision`, `checkFoodCollision`,
    `isGameOver`
  - `spawnFood`
  - `POINTS_PER_FOOD`, `GRID_SIZE`
- `game.test.ts` — Vitest unit tests for the pure helpers.

## Running the tests

From the repository root:

```sh
pnpm test:run
```

The tests use only deterministic fakes — no real timers, no real randomness,
and no DOM. The browser-only `startGame` glue is guarded with
`typeof document !== "undefined"` so it never runs under Vitest.
