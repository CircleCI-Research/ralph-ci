# Classic Snake Game

A retro-style Snake game built with vanilla JavaScript, HTML5 Canvas, and CSS.

## How to Play

1. **Open the game**: Open `index.html` in a web browser
2. **Start playing**: Press the **SPACE** key to start the game
3. **Control the snake**: Use the **Arrow Keys** to change direction
   - ⬆️ Arrow Up - Move up
   - ⬇️ Arrow Down - Move down
   - ⬅️ Arrow Left - Move left
   - ➡️ Arrow Right - Move right
4. **Eat food**: Guide the snake to the red squares to eat food
5. **Grow**: Each food eaten makes the snake grow longer and adds 10 points to your score
6. **Avoid collisions**: Don't hit the walls or your own body!
7. **Game Over**: When you collide, your final score will be displayed
8. **Restart**: Click the "Restart Game" button to play again

## Game Features

- 20x20 grid playing field
- Continuous snake movement
- Score tracking (10 points per food)
- Collision detection (walls and self)
- Random food spawning (never on snake)
- Retro green-on-black aesthetic
- 180-degree turn prevention (can't reverse directly into yourself)
- Game over screen with final score

## Technical Details

- **Grid Size**: 20x20 cells
- **Canvas Size**: 400x400 pixels (20px per cell)
- **Move Speed**: 150ms between moves
- **Starting Position**: Center of grid (10, 10)
- **Starting Length**: 3 segments
- **Starting Direction**: Right

## Development

This game uses Test-Driven Development (TDD) with Vitest for unit testing.

### Running Tests

```bash
# Run tests once
pnpm test:run

# Run tests in watch mode
pnpm test
```

### Project Structure

- `index.html` - Main HTML file
- `style.css` - Retro styling
- `game.js` - Game logic (ES module with exports)
- `game.test.ts` - Unit tests for game logic

### Tested Functions

All core game logic is unit tested:

- `createInitialSnake()` - Snake initialization
- `moveSnake()` - Snake movement calculations
- `checkWallCollision()` - Wall collision detection
- `checkSelfCollision()` - Self-collision detection
- `checkFoodCollision()` - Food collision detection
- `spawnFood()` - Random food placement
- `getNewDirection()` - Direction change validation

## License

Educational project - feel free to use and modify!
