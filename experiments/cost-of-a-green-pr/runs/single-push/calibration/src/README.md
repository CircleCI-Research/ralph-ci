# Classic Snake

A grid-based Snake game in vanilla JavaScript, rendered with HTML5 Canvas.
No build step, no dependencies — the page loads `game.js` as an ES module.

## How to play

1. Open the game (see [Running it](#running-it) below).
2. Press **SPACE** to start. Any arrow key starts it too.
3. Steer with the **arrow keys**. The snake moves on its own and never stops.
4. Eat the red food to grow one segment and bank **10 points**.
5. You die if the head leaves the board or runs into the snake's own body.
6. On the game-over screen, hit **Restart Game** or press **SPACE** to play
   again from a fresh board and a zero score.

The snake cannot turn back through its own neck: a 180° input is ignored, so
pressing Left while travelling right keeps you going right.

## Running it

The game is an ES module, and browsers refuse module imports over `file://`.
Serve the folder over HTTP instead — any static server works:

```sh
# from this src/ directory
python3 -m http.server 8000
# then open http://localhost:8000/
```

## Files

| File           | What it holds                                                        |
| -------------- | -------------------------------------------------------------------- |
| `index.html`   | Page shell: canvas, score, start overlay, game-over overlay          |
| `style.css`    | Retro CRT styling — dark board, neon-green chrome, overlays          |
| `game.js`      | Pure game logic (exported, tested) plus the `startGame()` DOM wiring |
| `game.test.ts` | Vitest unit tests for every pure function in `game.js`               |

## Game rules, in numbers

| Setting          | Value                       |
| ---------------- | --------------------------- |
| Board            | 20 × 20 cells, 20px each    |
| Starting length  | 3 segments, centre of board |
| Starting heading | Right                       |
| Tick             | 150 ms                      |
| Points per food  | 10                          |

## Design notes

`game.js` splits cleanly in two. Everything above `startGame()` is pure — it
takes plain objects and returns new ones, touching neither the DOM nor a timer
— which is what `game.test.ts` exercises:

- `createInitialSnake()` / `createInitialState()` — the opening position. The
  first load and the restart button both read the board out of
  `createInitialState()`, so starting and restarting cannot drift apart.
- `moveSnake()` — pushes a new head, drops the tail. Growth is the caller's
  job: it re-appends the tail it saved when food was eaten.
- `getNewDirection()` — rejects 180° turns.
- `checkWallCollision()` / `checkSelfCollision()` / `checkFoodCollision()`.
- `getNextScore()` — one place for the scoring rule.
- `spawnFood()` — random free cell, with the retry loop capped at
  `gridSize * gridSize` attempts and a deterministic scan behind it, so a
  nearly-full board can never spin forever. Returns `null` only when the snake
  covers every cell.

`startGame()` owns the parts that need a browser: the canvas draws, the keydown
handler, the restart button, and the single `setInterval` that drives the loop.
It is deliberately not unit tested — everything it depends on is.

## Tests

Tests live in `game.test.ts` and run under Vitest from the repository root.
They use no real timers, no real randomness (`spawnFood` and
`createInitialState` take an injectable `random`) and no I/O, so every spec
finishes in well under 100 ms.
