# Classic Snake Game

A retro-style Snake game built with vanilla JavaScript, HTML5 Canvas, and CSS.

## How to Play

1. **Open the game**: Open `index.html` in a web browser
2. **Start playing**: Press the **SPACEBAR** to start the game
3. **Control the snake**: Use the **arrow keys** to change direction
   - ↑ Arrow Up: Move up
   - ↓ Arrow Down: Move down
   - ← Arrow Left: Move left
   - → Arrow Right: Move right
4. **Objective**: Eat the red food to grow your snake and increase your score
5. **Game Over**: The game ends if you hit a wall or collide with yourself
6. **Restart**: Click the "Restart Game" button or press **SPACEBAR** after game over

## Scoring

- Each piece of food eaten: **+10 points**
- Try to get the highest score possible!

## Game Rules

- The snake moves continuously in the current direction
- You cannot make 180-degree turns (e.g., can't go left if moving right)
- The snake grows longer each time it eats food
- Food spawns randomly on the grid (never on the snake's body)
- The game ends when:
  - The snake hits the wall (grid boundary)
  - The snake collides with its own body

## Technical Details

- **Grid Size**: 20×20 cells
- **Canvas Size**: 400×400 pixels
- **Cell Size**: 20×20 pixels
- **Game Speed**: 150ms per frame
- **Initial Snake Length**: 3 segments
- **Starting Position**: Center of the grid (10, 10)
- **Starting Direction**: Moving right

## Features

- Clean, retro aesthetic with neon green snake and dark background
- Smooth keyboard controls with direction queueing
- Score tracking and display
- Game over overlay with final score
- Restart functionality
- Responsive design

## Development

This game was built using:

- **HTML5 Canvas** for rendering
- **Vanilla JavaScript** (ES Modules) for game logic
- **CSS3** for styling
- **Vitest** for unit testing

All game logic functions are exported and fully tested:

- `createInitialSnake()` - Initializes snake at center
- `moveSnake()` - Calculates new snake position
- `checkWallCollision()` - Detects wall collisions
- `checkSelfCollision()` - Detects self-collisions
- `checkFoodCollision()` - Detects food collisions
- `spawnFood()` - Generates random food position
- `getNewDirection()` - Prevents 180-degree turns

Run tests with: `pnpm test:run`

## Credits

Built as part of a CI-validated development workflow using RalphCI.
