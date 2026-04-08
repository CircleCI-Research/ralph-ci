# Project Plan: Classic Snake Game (CI-Validated)

## Project Overview

Build a classic Snake game using HTML, CSS, and vanilla JavaScript. The game should be playable in a web browser with arrow key controls.

**CI Integration**: This project uses RalphCI with CircleCI integration enabled. All game logic must be testable, and tests must pass in CI before tasks are considered complete.

## Requirements

- Grid-based game board (20x20 cells)
- Snake that moves continuously in the current direction
- Food that spawns randomly on the grid
- Snake grows when eating food
- Score tracking
- Game over when snake hits wall or itself
- Restart functionality
- Clean, retro-style visual design
- **Unit tests for all game logic functions** (CI requirement)

## Technical Stack

- HTML5 Canvas for rendering
- Vanilla JavaScript ES Modules (for testability)
- CSS for styling the container/UI
- Vitest for unit testing (runs in CI)

## Testing Strategy

**Test-First Development**: Unit tests are created BEFORE implementation. This ensures:

1. CI can validate changes from the first commit
2. Game logic is written in a testable, modular way
3. Each task's completion is verifiable in CI

**Test Location**: Tests live in `features/snake-game-4/src/game.test.ts`

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
features/snake-game-4/
├── activity.md       # Activity log
├── plan.md           # This file
├── tasks.json        # Task list
├── prompt.md         # Agent instructions
├── ralphci.json      # Configuration (CI enabled)
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

## CI Configuration

The `ralphci.json` has CI enabled with smart push:

- Agent queries CircleCI status at start of each iteration
- Pushes only when local tests pass
- Won't complete until CI is green

## Additional Context

This is a demonstration of RalphCI with full CI integration. The AI coding agent will:

1. Write failing tests first (TDD style)
2. Implement code to make tests pass
3. Push to trigger CI verification
4. Iterate until both local and CI tests are green
