# Classic Snake 🐍

A grid-based Snake game in vanilla JavaScript, rendered on an HTML5 canvas.
No build step, no dependencies — open the page and play.

## How to play

1. Open `index.html` in a browser.
   - Straight off the filesystem works, but the page is an ES module
     (`<script type="module">`), so some browsers will block it over `file://`.
     If the board never appears, serve the folder instead:
     ```sh
     cd src
     python3 -m http.server 8000
     # then visit http://localhost:8000/
     ```
2. Press **SPACE** to start.
3. Steer with the **arrow keys**. The snake moves on its own — you only choose
   which way it turns.
4. Eat the amber food. Each meal grows the snake by one segment and adds
   **10 points**.
5. The run ends when the head leaves the board or runs into the snake's own
   body. The final score is shown on the game over screen.
6. Play again with the **Restart Game** button or by pressing **SPACE**.

## Controls

| Key / control    | What it does                               |
| ---------------- | ------------------------------------------ |
| `SPACE`          | Start a run; restart once the game is over |
| `↑` `↓` `←` `→`  | Turn the snake                             |
| **Restart Game** | Same as SPACE on the game over screen      |

A few rules worth knowing:

- **You cannot turn back through your own neck.** A 180-degree reversal is
  ignored, so a stray keypress can never kill you outright.
- **Turns are queued, not instant.** Up to two inputs are buffered and applied
  one per tick, so a quick round-the-corner double-tap registers, but a mashed
  keyboard cannot bank a long tail of stale turns.
- **Chasing your own tail is legal.** The tail vacates its cell on the same
  tick the head enters it, so following yourself around is not a collision.
- **Food never spawns under the snake**, and it is placed against the snake's
  length _after_ it has grown.

## Files

| File           | Contents                                                                |
| -------------- | ----------------------------------------------------------------------- |
| `index.html`   | Page shell: 400×400 canvas, score readout, start and game over overlays |
| `style.css`    | Retro CRT styling — phosphor-green palette, scanlines, overlays         |
| `game.js`      | ES module: pure game logic, canvas painters, and `startGame()`          |
| `game.test.ts` | Vitest unit tests for every pure function in `game.js`                  |

## Board

- 20 × 20 cells of 20 px each — a 400 × 400 canvas.
- One tick every 150 ms.
- 10 points per piece of food.

These are exported from `game.js` as `GRID_SIZE`, `CELL_SIZE`, `TICK_MS` and
`POINTS_PER_FOOD`; changing them changes the game, and `index.html`'s canvas
dimensions should be kept at `GRID_SIZE * CELL_SIZE`.

## Code layout

`game.js` splits into three layers so the interesting parts can be tested
without a browser:

- **Pure logic** — `createInitialSnake`, `createInitialGameState`, `moveSnake`,
  `growSnake`, `getNewDirection`, `directionFromKey`, `checkWallCollision`,
  `checkSelfCollision`, `checkFoodCollision`, `isGameOver`, `spawnFood`,
  `nextScore`. No DOM, no timers, no randomness that is not injected —
  `spawnFood` and `createInitialGameState` take a `random` argument that
  defaults to `Math.random`.
- **Painters** — `drawSnake`, `drawFood`, `drawBoard`. Given a 2D context.
- **Wiring** — `startGame(doc, random)` builds the state, listens for keys and
  the restart button, and runs the tick loop. It returns a handle
  (`{ canvas, ctx, state, start, stop, restart }`), and only boots itself when
  a real `document` exists, so importing the module under vitest is
  side-effect free.

## Tests

Unit tests live in `game.test.ts` and cover the pure layer only — canvas
rendering and DOM event handling are verified in a browser instead.

Tests use no real timers, no real randomness and no I/O; food placement is
driven by an injected fake. They are run by the repository's Vitest setup
rather than from this folder.
