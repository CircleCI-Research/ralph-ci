# Snake

A classic 20x20 Snake game in plain HTML, CSS and vanilla JavaScript. No build
step, no dependencies — the browser loads `game.js` as an ES module directly.

## Play

The page needs to be served over HTTP rather than opened as a `file://` URL,
because ES modules are blocked on the file protocol. From this folder:

```sh
python3 -m http.server 8000
# then open http://localhost:8000/
```

## Controls

| Key / control      | What it does                              |
| ------------------ | ----------------------------------------- |
| `SPACE`            | Start the game, or restart a finished one |
| `←` `→` `↑` `↓`    | Steer the snake                           |
| **Restart** button | Start a fresh game after a game over      |

The board opens on a title card reading **Press SPACE to start**; nothing moves
until you press it. An arrow key also gets a fresh game going, and it sets the
first direction at the same time.

## Rules

- The snake moves one cell every 120ms and never stops.
- Eating the red food grows the snake by one segment and scores 10 points.
- New food never spawns underneath the snake.
- You cannot turn back into your own neck — a reversal is ignored rather than
  fatal.
- The game ends when the head leaves the board or runs into the body. The snake
  stops on the last cell it legally occupied, and the overlay shows the final
  score with a **Restart** button.

## Files

| File           | What is in it                                                     |
| -------------- | ----------------------------------------------------------------- |
| `index.html`   | Canvas, score line, and the overlay used for both start and death |
| `style.css`    | Retro dark board with a phosphor-green palette                    |
| `game.js`      | Pure game logic plus the DOM/canvas wiring in `startGame()`       |
| `game.test.ts` | Vitest coverage for the logic                                     |

## Design

`game.js` keeps the game as a plain state value — snake, direction, pending
direction, food, score, `started`, `gameOver` — and moves it forward with pure
functions (`step`, `applyInput`, `startState`, `restartState`). `overlayState`
turns that state into what the overlay should show, so the three phases (idle,
in play, over) are decided in testable code rather than in event handlers.
`startGame()` is the only part that touches the document: it draws, listens for
keys and the Restart button, and owns the `setInterval` loop.

## Tests

Tests run from the repository root, not from this folder:

```sh
pnpm test:run
```
