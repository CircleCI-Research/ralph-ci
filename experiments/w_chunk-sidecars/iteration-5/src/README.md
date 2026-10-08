# Snake

A classic Snake game built with HTML5 Canvas and vanilla JavaScript ES
modules. Move the snake with the arrow keys, eat the red food, grow, and
avoid hitting the walls or yourself.

## How to play

1. Open `index.html` in a modern browser (any local static-file server
   works — `python3 -m http.server`, `npx serve`, etc.). Opening the file
   directly via `file://` also works in browsers that allow modules from
   local files.
2. Press **SPACE** to start the game.
3. Steer with the **arrow keys** (↑ ↓ ← →). The snake moves continuously;
   you set its direction, not its motion.
4. Eat the red square to grow and score a point.
5. The game ends when the snake's head hits a wall or its own body.
6. Press **SPACE** or click the **Restart** button to play again.

## Controls

| Key            | Action                  |
| -------------- | ----------------------- |
| Arrow keys     | Change direction        |
| SPACE          | Start / restart game    |
| Restart button | Restart after game over |

Note: 180° reversals are ignored — you cannot drive the head straight
back into the snake's neck.

## Files

- `index.html` — page structure (canvas, score, overlay, restart button)
- `style.css` — retro-style theme
- `game.js` — game logic (pure helpers + `startGame()` DOM wiring)
- `game.test.ts` — Vitest unit tests for the pure helpers

## Exported helpers (for testing)

`game.js` exports the following pure functions so they can be unit-tested
without a DOM:

- `createInitialSnake()`
- `moveSnake(snake, direction)`
- `checkWallCollision(head, gridSize)`
- `checkSelfCollision(snake)`
- `checkFoodCollision(head, food)`
- `spawnFood(gridSize, snake, random)`
- `getNewDirection(current, input)`
- `GRID_SIZE`

`startGame()` wires the helpers to the canvas and keyboard. It is
auto-invoked at module load when `document` is defined, and is a no-op
under Node (so the test runner does not need a DOM shim).
