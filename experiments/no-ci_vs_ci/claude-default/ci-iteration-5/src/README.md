# Classic Snake Game

A retro-styled Snake game built with vanilla JavaScript, HTML5 Canvas, and CSS.

## How to Play

1. **Open the game**: Open `index.html` in your web browser
2. **Start playing**: Press the **SPACE** key to begin
3. **Control the snake**: Use the **arrow keys** to change direction
   - ⬆️ Up Arrow: Move up
   - ⬇️ Down Arrow: Move down
   - ⬅️ Left Arrow: Move left
   - ➡️ Right Arrow: Move right
4. **Eat food**: Guide the green snake to the red food
5. **Grow and score**: Each food eaten makes the snake longer and adds 10 points
6. **Avoid collisions**: Don't hit the walls or yourself!
7. **Restart**: When game over, click the "Restart Game" button to play again

## Game Rules

- The snake moves continuously in the current direction
- You cannot make 180-degree turns (e.g., if moving right, you cannot immediately go left)
- The game ends when the snake hits a wall or collides with itself
- Your score increases by 10 points for each food eaten
- The snake grows by one segment each time it eats food

## Technical Details

- **Grid**: 20x20 cells
- **Cell size**: 20x20 pixels
- **Canvas size**: 400x400 pixels
- **Initial speed**: 150ms per frame
- **Starting length**: 3 segments

## Development

This game uses Test-Driven Development (TDD) with comprehensive unit tests:

- **Test file**: `game.test.ts`
- **Run tests**: `pnpm test:run`
- **Test coverage**: All game logic functions are tested (28 tests)

### Tested Functions

- `createInitialSnake()` - Snake initialization
- `moveSnake()` - Snake movement with optional growth
- `checkWallCollision()` - Wall collision detection
- `checkSelfCollision()` - Self-collision detection
- `checkFoodCollision()` - Food collision detection
- `spawnFood()` - Random food spawning (deterministic for tests)
- `getNewDirection()` - Direction changes with 180-degree turn prevention

## Architecture

The game is built with a modular architecture for testability:

- **game.js**: Core game logic exported as pure functions + browser integration
- **index.html**: HTML structure with canvas, score display, and game over overlay
- **style.css**: Retro-styled CSS with neon green aesthetic and glow effects
- **game.test.ts**: Comprehensive unit tests using Vitest

All game logic functions are exported and tested independently, ensuring reliability and maintainability.

## Credits

Built as part of a CI-integrated development workflow using RalphCI with CircleCI.
