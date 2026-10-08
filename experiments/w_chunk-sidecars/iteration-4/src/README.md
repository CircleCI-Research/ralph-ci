# Snake

A classic Snake game built with HTML5 Canvas and vanilla JavaScript ES modules.

## How to play

1. Open `index.html` in a modern web browser (any browser with ES module support).
2. The board shows the snake (green) and a single food cell (red).
3. Press **SPACE** to start the game.
4. Use the **arrow keys** to steer the snake.
5. Eat the red food to grow your snake and increase your score by 1.
6. Avoid running into the walls or your own tail.
7. When the snake dies, the **Game Over** overlay shows your final score.
   Click **Restart** or press **SPACE** to play again.

## Controls

| Key                                                  | Action                                     |
| ---------------------------------------------------- | ------------------------------------------ |
| `ArrowUp` / `ArrowDown` / `ArrowLeft` / `ArrowRight` | Change direction (no 180° reversals)       |
| `Space`                                              | Start a new game / restart after game over |
| Restart button                                       | Restart after game over                    |

## Project layout

```
src/
├── index.html      # Markup, canvas, HUD, overlays
├── style.css       # Retro neon styling
├── game.js         # Pure game logic + DOM bootstrap (ES module)
├── game.test.ts    # Vitest unit tests for the pure logic
└── README.md       # This file
```

## Game mechanics

- **Grid**: 20 x 20 cells, each 20px (canvas is 400 x 400px).
- **Tick rate**: 150ms per step.
- **Starting snake**: three segments laid out horizontally, head at `(10, 10)`,
  moving right.
- **Food**: spawned on a random unoccupied cell; respawned on every meal.
- **Collisions**: the game ends if the snake's head leaves the grid or
  overlaps any of its own body segments.
- **Direction input**: the most recent arrow key press is applied at the
  next tick; 180-degree reversals into the snake's own neck are ignored.

## Development

Tests live in `game.test.ts` and run with [Vitest](https://vitest.dev/):

```sh
pnpm install
pnpm test:run
```

Only the pure logic functions are tested (movement, collisions, food spawning,
direction handling, game-over detection, and initial-state construction). DOM
wiring, canvas rendering, and visual styling are exercised by playing the game
in a browser.
