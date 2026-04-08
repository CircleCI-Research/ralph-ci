# Project Plan: Classic Snake Game (Multi-Agent Built)

## Project Overview

Build a classic Snake game using HTML, CSS, and vanilla JavaScript. The game should be playable in a web browser with arrow key controls.

**Multi-Agent Architecture**: This project uses RalphCI's phased agent architecture:

- **Build Agent** — Writes code and tests (this prompt)
- **CI Doctor** — Automatically diagnoses and fixes any CI pipeline failures
- **Review Gate** — Auto-runs `lint:fix` + `test:run` (with 60s timeout) before every push

The Build Agent does NOT need to worry about CI failures or lint formatting — those are handled automatically.

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

**Test Location**: Tests live in `src/game.test.ts` (relative to working directory)

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
<working-directory>/
├── activity.md       # Activity log
├── plan.md           # This file
├── tasks.json        # Task list
├── prompt.md         # Build Agent instructions
├── ralphci.json      # Configuration (CI + Review Gate + CI Doctor)
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

The `ralphci.json` has CI enabled with the full multi-agent architecture:

- **Review Gate** auto-runs `lint:fix` + tests before every push (never hangs — 60s timeout)
- **CI Doctor** diagnoses and fixes any CI failures with full untruncated logs
- **Build Agent** focuses purely on coding and testing — no CI debugging
- Smart push: only pushes when Review Gate passes

## Additional Context

This is a demonstration of RalphCI's multi-agent architecture. The AI coding agent will:

1. Write failing tests first (TDD style)
2. Implement code to make tests pass
3. Review Gate validates lint + tests before push
4. If CI fails, CI Doctor fixes it automatically
5. Iterate until both local and CI tests are green
