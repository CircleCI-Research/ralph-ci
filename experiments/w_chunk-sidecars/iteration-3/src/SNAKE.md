# SNAKE 🐍🕹️

Classic Snake game built as part of the RalphCI multi-agent chunk-sidecar
experiment (iteration-3).

## How to play

Open `index.html` in a modern browser. Use the arrow keys to steer the snake
around a 20x20 grid. Eat the food to grow and rack up points. The game ends if
the snake runs into a wall or itself — press the restart button to play again.

## Source layout

- `index.html` — page markup, canvas, score display, game-over overlay
- `style.css` — retro-style visual design
- `game.js` — pure game-logic functions plus the DOM/canvas wiring
- `game.test.ts` — Vitest unit tests for the pure game-logic exports
