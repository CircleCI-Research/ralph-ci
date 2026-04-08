# Classic Snake Game

A retro-styled implementation of the classic Snake game built with vanilla JavaScript, HTML5 Canvas, and CSS.

## How to Play

1. **Open the game**: Open `index.html` in your web browser
2. **Start the game**: Press the `SPACE` bar to begin
3. **Control the snake**: Use the arrow keys to change direction
   - ⬆️ Up Arrow - Move up
   - ⬇️ Down Arrow - Move down
   - ⬅️ Left Arrow - Move left
   - ➡️ Right Arrow - Move right
4. **Eat food**: Guide the snake to the red food squares
5. **Grow**: Each food eaten makes the snake grow by one segment and adds 10 points
6. **Avoid collisions**: Don't hit the walls or your own body!
7. **Game over**: When you collide, the game ends and shows your final score
8. **Restart**: Click the "Restart Game" button or press `SPACE` to play again

## Game Rules

- The snake moves continuously in the current direction
- You cannot make 180-degree turns (e.g., if moving right, you cannot immediately go left)
- The snake starts with 3 segments and grows by 1 segment each time it eats food
- Food spawns at random positions on the grid (never on the snake's body)
- The game ends when the snake hits a wall or collides with itself

## Scoring

- Each food eaten: **+10 points**
- Your final score is displayed when the game ends

## Technical Details

- **Grid size**: 20x20 cells
- **Cell size**: 20x20 pixels
- **Canvas size**: 400x400 pixels
- **Game speed**: 150ms per move
- **Snake colors**:
  - Head: Bright green (#00ff00)
  - Body: Dark green (#00cc00)
- **Food color**: Red (#ff0000)

## Game Architecture

The game uses a modular ES6 architecture with exported functions for testability:

- `createInitialSnake()` - Initializes a 3-segment snake at the center
- `moveSnake(snake, direction)` - Calculates next snake position
- `checkWallCollision(head, gridSize)` - Detects wall collisions
- `checkSelfCollision(snake)` - Detects self-collisions
- `checkFoodCollision(head, food)` - Detects food collisions
- `spawnFood(gridSize, snake)` - Generates random food positions
- `getNewDirection(current, input)` - Prevents 180-degree turns

All game logic is unit tested with Vitest to ensure correctness.

## Development

This game was built using Test-Driven Development (TDD) principles:

- Unit tests were written first for all core game logic
- Implementation followed to make tests pass
- All tests run in CI to verify correctness

**Run tests**: `pnpm test:run`

## Browser Compatibility

This game uses standard HTML5 Canvas and ES6 modules, compatible with all modern browsers:

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)

## License

Built as a demonstration project for RalphCI - an AI-powered development loop tool.
