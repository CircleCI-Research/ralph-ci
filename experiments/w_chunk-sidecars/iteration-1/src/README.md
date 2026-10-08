# Classic Snake Game

A retro-styled Snake game built with HTML5 Canvas and vanilla JavaScript ES modules.

## How to Play

1. Open `index.html` in any modern web browser.
2. Press **SPACE** to start the game.
3. Use the **arrow keys** to steer the snake:
   - **↑** Up
   - **↓** Down
   - **←** Left
   - **→** Right
4. Eat the red food cell to grow the snake and increase your score.
5. Avoid running into the walls or your own tail — that ends the game.
6. When the game is over, press **SPACE** or click **Restart Game** to play again.

## Rules

- The board is a 20×20 grid.
- The snake moves continuously in the current direction at a fixed tick rate.
- You cannot reverse 180° in a single tick (the input is ignored).
- Each food eaten grows the snake by one segment and adds 1 to the score.
- Food never spawns on a snake segment.

## File Layout

| File           | Purpose                                                  |
| -------------- | -------------------------------------------------------- |
| `index.html`   | Page structure (canvas, score, overlays, restart button) |
| `style.css`    | Retro neon-on-black styling                              |
| `game.js`      | Game logic (pure functions) and DOM wiring               |
| `game.test.ts` | Vitest unit tests for the pure game logic                |

The pure functions exported from `game.js` (`createInitialSnake`, `moveSnake`,
`checkWallCollision`, `checkSelfCollision`, `checkFoodCollision`, `spawnFood`,
`getNewDirection`, `isGameOver`) are unit tested with Vitest. Canvas rendering
and DOM event handlers are intentionally not unit tested.

## Running the Tests

From the package root (where `package.json` lives):

```bash
pnpm install
pnpm test:run
```
