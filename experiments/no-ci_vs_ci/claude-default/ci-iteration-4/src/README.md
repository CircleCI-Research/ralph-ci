# Classic Snake Game

A retro-styled implementation of the classic Snake game built with vanilla JavaScript, HTML5 Canvas, and CSS.

## How to Play

1. **Start the Game**: Press the `SPACE` key to begin
2. **Control the Snake**: Use the arrow keys to change direction:
   - `↑` - Move Up
   - `↓` - Move Down
   - `←` - Move Left
   - `→` - Move Right
3. **Eat Food**: Guide the snake to the red squares to eat and grow
4. **Avoid Collisions**: Don't hit the walls or your own tail!
5. **Restart**: Click the "Restart Game" button after game over

## Scoring

- Each piece of food eaten adds **10 points** to your score
- The snake grows by one segment each time it eats food
- Try to achieve the highest score possible!

## Game Rules

- The snake moves continuously in the current direction
- You cannot make 180-degree turns (e.g., if moving right, you cannot immediately turn left)
- The game ends when the snake collides with:
  - The grid boundaries (walls)
  - Its own body (self-collision)
- Food spawns randomly on the grid, avoiding the snake's position

## Technical Details

- **Grid Size**: 20x20 cells
- **Cell Size**: 20 pixels
- **Game Speed**: ~150ms per move (6-7 moves per second)
- **Snake Starting Length**: 3 segments
- **Starting Position**: Center of the grid, moving right

## Running the Game

Simply open `index.html` in a modern web browser. No build step or server required!

## Development

This game uses test-driven development with Vitest for unit testing:

```bash
# Run tests
pnpm test:run

# Run linting
pnpm lint
```

All core game logic functions are exported from `game.js` for testability.
