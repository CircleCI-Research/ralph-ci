# Classic Snake Game

A retro-style snake game built with vanilla JavaScript, HTML5 Canvas, and CSS.

## How to Play

1. **Open the game**: Open `index.html` in your web browser
2. **Start**: Press **SPACE** to start the game
3. **Control the snake**: Use **Arrow Keys** to change direction
   - ↑ Up Arrow - Move up
   - ↓ Down Arrow - Move down
   - ← Left Arrow - Move left
   - → Right Arrow - Move right
4. **Objective**: Eat the red food to grow your snake and increase your score
5. **Avoid**: Don't hit the walls or your own body!

## Game Rules

- The snake moves continuously in the current direction
- Each piece of food eaten adds 10 points to your score
- The snake grows by one segment each time it eats food
- The game ends if the snake hits a wall or runs into itself
- After game over, click **Restart Game** or press **SPACE** to play again

## Features

- Classic snake gameplay mechanics
- Score tracking
- Retro green aesthetic with glowing effects
- Smooth 100ms tick rate
- Restart functionality
- Responsive keyboard controls

## Technical Details

- **Grid Size**: 20x20 cells
- **Canvas Size**: 400x400 pixels
- **Cell Size**: 20x20 pixels
- **Game Speed**: 100ms per frame
- **Starting Length**: 3 segments

## Development

This game includes comprehensive unit tests for all game logic functions:

- Snake initialization
- Movement and direction handling
- Collision detection (walls and self)
- Food spawning and collision
- Score tracking

Run tests with: `pnpm test:run`

## Credits

Built as a test-driven development exercise using Vitest for testing.
