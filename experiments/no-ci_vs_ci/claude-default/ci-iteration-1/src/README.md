# Classic Snake Game

A retro-style implementation of the classic Snake game built with HTML5 Canvas and vanilla JavaScript.

## How to Play

1. **Start the Game**: Press `SPACE` to begin
2. **Control the Snake**: Use the arrow keys on your keyboard
   - `↑` Arrow Up: Move up
   - `↓` Arrow Down: Move down
   - `←` Arrow Left: Move left
   - `→` Arrow Right: Move right
3. **Objective**: Eat the red food to grow your snake and increase your score
4. **Avoid**: Don't hit the walls or collide with your own body, or it's game over!
5. **Restart**: Click the "Restart Game" button after game over to play again

## Game Rules

- The snake moves continuously in the current direction
- You cannot make 180-degree turns (e.g., if moving right, you can't immediately go left)
- Each piece of food eaten increases your score by 1
- Each piece of food eaten makes your snake grow by 1 segment
- The game ends when you hit a wall or collide with your own body

## Technical Details

- **Grid Size**: 20x20 cells
- **Game Speed**: 150ms per move
- **Initial Snake Length**: 3 segments
- **Starting Position**: Center of the grid (10, 10)
- **Starting Direction**: Right

## Running the Game

Simply open `index.html` in a modern web browser. No build step or server required!

For development:

```bash
# Run tests
pnpm test:run

# Or run tests in watch mode
pnpm test
```

## File Structure

- `index.html` - Main HTML structure
- `style.css` - Retro-style visual design
- `game.js` - Game logic and rendering (ES module)
- `game.test.ts` - Unit tests for game logic
- `README.md` - This file

## Features

✅ Classic snake gameplay
✅ Score tracking
✅ Game over detection
✅ Restart functionality
✅ Retro visual aesthetic
✅ Keyboard controls
✅ Responsive canvas rendering
✅ Fully tested game logic

Enjoy playing! 🐍
