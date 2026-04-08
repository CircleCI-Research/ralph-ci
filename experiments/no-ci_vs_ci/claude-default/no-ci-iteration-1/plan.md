# Project Plan: Classic Snake Game (Local-Only)

## Project Overview

Build a classic Snake game using HTML, CSS, and vanilla JavaScript. The game should be playable in a web browser with arrow key controls.

All game logic must be testable, and tests must pass locally before tasks are considered complete.

## Requirements

- Grid-based game board (20x20 cells)
- Snake that moves continuously in the current direction
- Food that spawns randomly on the grid
- Snake grows when eating food
- Score tracking
- Game over when snake hits wall or itself
- Restart functionality
- Clean, retro-style visual design
- **Unit tests for all game logic functions**

## Technical Stack

- HTML5 Canvas for rendering
- Vanilla JavaScript ES Modules (for testability)
- CSS for styling the container/UI
- Vitest for unit testing

## Testing Strategy

**Test-First Development**: Unit tests are created BEFORE implementation. This ensures:

1. Game logic is written in a testable, modular way
2. Each task's completion is verifiable locally via `pnpm test:run`

**Test Location**: Tests live in `experiments/no-ci_vs_ci/claude-default/no-ci-iteration-1/src/game.test.ts`

**What to Test**:

- Pure game logic functions (no DOM dependencies)
- Snake movement calculations
- Collision detection algorithms
- Food spawning logic (with seeded random)
- Score calculations

**What NOT to Test** (in this scope):

- Canvas rendering
- DOM event handlers
- Visual styling

## File Structure

All source files should be created in the `src/` folder:

```
experiments/no-ci_vs_ci/claude-default/no-ci-iteration-1/
├── activity.md       # Activity log
├── plan.md           # This file
├── tasks.json        # Task list
├── prompt.md         # Agent instructions
├── ralphci.json      # Configuration (CI disabled)
└── src/              # Source code output
    ├── index.html    # Main HTML file
    ├── style.css     # Styling
    ├── game.js       # Game logic (ES module with exports)
    ├── game.test.ts  # Unit tests for game logic
    └── README.md     # How to play
```

## Game Logic Module Design

The `game.js` file should export pure functions for testability:

```javascript
// Example exports that can be tested
export function createInitialSnake() { ... }
export function moveSnake(snake, direction) { ... }
export function checkWallCollision(head, gridSize) { ... }
export function checkSelfCollision(snake) { ... }
export function checkFoodCollision(head, food) { ... }
export function spawnFood(gridSize, snake, random) { ... }
export function getNewDirection(current, input) { ... }
```

The module also has a `startGame()` function that wires up DOM/canvas (not tested).

## Additional Context

This is a local-only experiment run. The AI coding agent will:

1. Write failing tests first (TDD style)
2. Implement code to make tests pass
3. Iterate until all local tests are green
