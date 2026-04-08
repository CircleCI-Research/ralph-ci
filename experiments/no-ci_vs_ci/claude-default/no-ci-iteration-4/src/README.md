# Classic Snake Game

A retro-style Snake game built with HTML5 Canvas and vanilla JavaScript.

## How to Play

1. **Start the Game**: Press `SPACE` to begin
2. **Control the Snake**: Use arrow keys to change direction
   - ⬆️ Arrow Up - Move up
   - ⬇️ Arrow Down - Move down
   - ⬅️ Arrow Left - Move left
   - ➡️ Arrow Right - Move right
3. **Objective**: Eat the pink food to grow your snake and increase your score
4. **Game Over**: The game ends if you hit a wall or collide with your own body
5. **Restart**: Click the "Restart Game" button or press `SPACE` to play again

## Game Rules

- The snake moves continuously in the current direction
- You cannot reverse direction (e.g., cannot go left if moving right)
- Each food eaten increases your score by 1 and makes the snake grow longer
- The game speed remains constant at 100ms per move

## Technical Details

- **Grid Size**: 20x20 cells
- **Canvas Size**: 400x400 pixels (20px per cell)
- **Game Speed**: 100ms per frame
- **Built With**: HTML5 Canvas, Vanilla JavaScript (ES Modules), CSS3

## Development

This game uses test-driven development (TDD) with Vitest for unit testing.

### Running Tests

```bash
pnpm test:run
```

### Running the Game

Simply open `index.html` in a web browser. No build step required!

## Features

- ✅ Smooth snake movement with arrow key controls
- ✅ Food spawning that avoids the snake's body
- ✅ Collision detection (walls and self-collision)
- ✅ Score tracking
- ✅ Game over screen with final score
- ✅ Restart functionality
- ✅ Retro aesthetic with neon colors
- ✅ Fully tested game logic

## Project Structure

```
src/
├── index.html      # Main HTML file
├── style.css       # Retro styling
├── game.js         # Game logic (ES module)
├── game.test.ts    # Unit tests
└── README.md       # This file
```

## Game Logic Functions

The game exports the following pure functions for testing:

- `createInitialSnake(gridSize)` - Creates initial snake at grid center
- `moveSnake(snake, direction, grow)` - Moves snake in direction
- `checkWallCollision(head, gridSize)` - Checks if head hit wall
- `checkSelfCollision(snake)` - Checks if head hit body
- `checkFoodCollision(head, food)` - Checks if head on food
- `spawnFood(gridSize, snake, random)` - Spawns food at random valid position
- `getNewDirection(current, input)` - Prevents 180-degree turns
- `startGame()` - Initializes and starts the game

Enjoy playing! 🐍
