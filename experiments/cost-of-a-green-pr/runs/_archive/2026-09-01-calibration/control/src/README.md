# Classic Snake 🐍

A grid-based Snake game in vanilla JavaScript, HTML5 canvas and CSS — no build
step, no dependencies. Steer the snake into the food, grow, and try not to hit
a wall or your own tail.

## How to play

1. Open `index.html` in a browser. `game.js` is an ES module, so `file://`
   will be blocked by CORS — serve the folder instead, e.g.:

   ```sh
   npx serve .        # or: python3 -m http.server
   ```

   then visit the printed URL.

2. Press **SPACE** to start (any arrow key works too).
3. Steer with the **arrow keys** or **WASD**.
4. Eat the red pellet to grow and score.
5. When you die, hit **Restart Game** on the overlay — or press **SPACE** — to
   play again.

## Rules

| Rule       | Behaviour                                                        |
| ---------- | ---------------------------------------------------------------- |
| Board      | 20×20 cells, 20px each (400×400 canvas)                          |
| Speed      | One cell every 150ms, constant                                   |
| Scoring    | 10 points per piece of food                                      |
| Growth     | One segment per piece of food                                    |
| Turning    | 180° turns are rejected — the snake cannot bite its own neck     |
| Game over  | Head leaves the grid, or lands on its own body                   |
| Tail chase | Moving into the cell the tail vacates this tick is legal         |
| Restart    | Fresh 3-segment snake, score back to 0, new food, loop restarted |

## Files

| File            | Purpose                                                       |
| --------------- | ------------------------------------------------------------- |
| `index.html`    | Canvas, score readout, start and game-over overlays           |
| `style.css`     | Retro CRT-green styling: centred board, neon border, overlays |
| `game.js`       | ES module — pure game logic plus the DOM/canvas controller    |
| `game.test.ts`  | Vitest coverage for the logic, the loop and the controls      |
| `style.test.ts` | Vitest coverage for the index.html/style.css styling contract |

## Module API

`game.js` exports pure functions so the rules can be tested without a browser:

| Export                                | Returns                                              |
| ------------------------------------- | ---------------------------------------------------- |
| `createInitialSnake()`                | 3 segments in the middle of the grid, facing right   |
| `moveSnake(snake, direction, grow?)`  | A new snake one cell along; keeps the tail if `grow` |
| `checkWallCollision(head, gridSize?)` | `true` when the head has left the board              |
| `checkSelfCollision(snake)`           | `true` when the head overlaps its own body           |
| `checkFoodCollision(head, food)`      | `true` when the head is on the food                  |
| `spawnFood(gridSize, snake, random)`  | A free cell, or `null` when the board is full        |
| `getNewDirection(current, input)`     | `input`, unless it is a 180° turn                    |
| `directionFromKey(key)`               | A direction vector for arrows/WASD, else `null`      |
| `drawBoard(ctx, snake, food)`         | Paints one frame                                     |

None of them mutate their arguments, and `spawnFood`'s `random` is injectable,
so tests seed it rather than relying on `Math.random`. Its retry loop is capped
at `gridSize * gridSize` attempts and falls back to a scan for the first free
cell, so no random source — real or fake — can hang the game.

`createGame(doc, options)` builds the controller around a document-like object
and returns `{ state, tick, start, stop, endGame, reset, restart,
requestDirection, handleKeydown }`. `startGame(doc)` wires it to the page and
is called automatically when the module loads in a browser. `options.tickMs`
and `options.random` make the loop and the food placement deterministic under
`vi.useFakeTimers()`.

## Tests

Run from the repository root (this folder is one run of the
_cost of a green PR_ experiment, not a standalone package):

```sh
pnpm test:run
```
