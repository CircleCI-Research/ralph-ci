# Classic Snake Game

A retro-styled Snake game built with vanilla JavaScript, HTML5 Canvas, and CSS.

## How to Play

### Starting the Game

1. Open `index.html` in a web browser
2. Press **SPACE** to start the game

### Controls

- **Arrow Up** - Move snake up
- **Arrow Down** - Move snake down
- **Arrow Left** - Move snake left
- **Arrow Right** - Move snake right
- **SPACE** - Start the game (when on start screen)

### Game Rules

1. **Objective**: Eat the red food to grow your snake and increase your score
2. **Movement**: The snake moves continuously in the current direction
3. **Growing**: Each time you eat food, your snake grows by one segment and you gain 1 point
4. **Game Over**: The game ends if you:
   - Hit the wall (edge of the grid)
   - Run into your own body
5. **Restart**: Click the "Restart Game" button after game over to play again

### Tips

- Plan your path ahead - the snake moves continuously
- Be careful when you grow longer - it's easier to hit yourself
- You cannot reverse direction (e.g., if moving right, you can't immediately go left)
- Try to eat food in a systematic pattern to avoid trapping yourself

## Technical Details

### Grid

- **Size**: 20x20 cells
- **Cell Size**: 20 pixels
- **Total Canvas**: 400x400 pixels

### Game Speed

- The snake moves every 150 milliseconds (approximately 6.7 moves per second)

### Colors

- **Snake**: Green (#00ff00)
- **Food**: Red (#ff0000)
- **Background**: Black (#000000)

## Development

### Running Tests

```bash
# Run all tests once
pnpm test:run

# Run tests in watch mode (for development)
pnpm test
```

### Project Structure

```
src/
├── index.html      # Main HTML file
├── style.css       # Retro styling
├── game.js         # Game logic (ES module)
├── game.test.ts    # Unit tests
└── README.md       # This file
```

### Game Logic Functions

The game uses pure functions for testability:

- `createInitialSnake()` - Creates starting snake position
- `moveSnake(snake, direction)` - Calculates new snake position
- `getNewDirection(current, input)` - Prevents 180-degree turns
- `checkWallCollision(head, gridSize)` - Detects wall collisions
- `checkSelfCollision(snake)` - Detects self collisions
- `checkFoodCollision(head, food)` - Detects food collisions
- `spawnFood(gridSize, snake, random)` - Generates new food position

## Credits

Built with Test-Driven Development (TDD) using Vitest for unit testing.
