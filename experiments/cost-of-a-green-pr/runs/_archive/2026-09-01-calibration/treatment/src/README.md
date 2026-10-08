# Classic Snake

A grid-based Snake game in vanilla JavaScript, rendered on an HTML5 canvas. No
build step, no dependencies — open the page and play.

## How to play

1. Serve this folder and open `index.html` in a browser (see [Running it](#running-it)).
2. Press **SPACE** to start.
3. Steer with the **arrow keys**.
4. Eat the red pellets to grow and score.
5. Hitting a wall or your own body ends the round.
6. On the game over screen, press **SPACE** or click **Restart Game** to play again.

The snake moves on its own once started — one cell every 150ms — and never
stops. You cannot turn back on yourself: a 180-degree input is ignored, so a
mis-timed key press will not fold the snake into its own neck.

## Rules

|                |                                                       |
| -------------- | ----------------------------------------------------- |
| Board          | 20 x 20 cells, drawn at 20px per cell (400 x 400)     |
| Starting snake | 3 segments, centered, heading right                   |
| Scoring        | 1 point per pellet; the snake grows by one segment    |
| Game over      | The head leaves the board, or lands on a body segment |

Entering the cell your tail is vacating on the same tick is legal — the tail
moves out before the head moves in.

## Running it

The page loads `game.js` as an ES module, and browsers block module imports over
`file:` URLs, so it needs to be served over HTTP:

```sh
python3 -m http.server 8000    # from this src/ directory
# then open http://localhost:8000/index.html
```

Any static file server works.

## Files

| File            | What it holds                                                       |
| --------------- | ------------------------------------------------------------------- |
| `index.html`    | Page structure: canvas, score readout, start and game over overlays |
| `style.css`     | Retro CRT styling — neon green on near-black, centered layout       |
| `game.js`       | Game logic (exported pure functions) plus the DOM/canvas wiring     |
| `game.test.ts`  | Unit tests for the game logic                                       |
| `style.test.ts` | Tests asserting the stylesheet contract `index.html` relies on      |

## Design

`game.js` splits into two halves.

The top half is pure and exported: `createInitialSnake`, `moveSnake`,
`getNewDirection`, the collision checks, `spawnFood`, `createGameState`,
`resetState`, and `tick`. None of it touches the DOM, timers, or `Math.random`
directly — `spawnFood` and `createGameState` take the random source as an
argument — so every rule of the game is testable without a browser.

The bottom half is `startGame()`, which owns the canvas context, the
`setInterval` loop, and the keyboard and button listeners. It is guarded by a
`typeof document !== "undefined"` check so importing the module under Node during
a test run never reaches for the DOM. Rendering and event handling are
deliberately not unit tested (see `plan.md`).

`resetState` writes a fresh round onto the _existing_ state object rather than
returning a new one, because `startGame()` closes over that object — swapping the
reference would leave the loop and the listeners driving the dead round.

## Tests

Tests run from the repository root with `pnpm test:run` (Vitest).
