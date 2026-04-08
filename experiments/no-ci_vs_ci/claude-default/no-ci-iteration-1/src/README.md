# Classic Snake Game

A retro-style implementation of the classic Snake game using HTML5 Canvas and vanilla JavaScript.

## How to Play

1. **Start the Game**
   - Open `index.html` in a web browser
   - Press **SPACE** to start the game

2. **Controls**
   - **Arrow Keys**: Control snake direction
     - ↑ (Up Arrow): Move up
     - ↓ (Down Arrow): Move down
     - ← (Left Arrow): Move left
     - → (Right Arrow): Move right
   - **SPACE**: Start or restart the game

3. **Gameplay**
   - Guide the snake to eat the red food
   - The snake grows longer each time it eats
   - Your score increases by 10 points per food eaten
   - Avoid hitting the walls or yourself!

4. **Game Over**
   - The game ends when the snake hits a wall or itself
   - Your final score will be displayed
   - Press **SPACE** or click **Restart Game** to play again

## Game Features

- **Grid-based gameplay**: 20x20 cell grid
- **Smooth movement**: Snake moves continuously in the current direction
- **Score tracking**: Points awarded for each food eaten
- **Collision detection**: Wall and self-collision
- **Restart functionality**: Quick restart for replay
- **Retro aesthetic**: Classic green-on-black terminal style

## Technical Details

- **No dependencies**: Pure vanilla JavaScript (ES modules)
- **HTML5 Canvas**: For game rendering
- **Test-driven development**: Comprehensive unit tests using Vitest
- **Modular design**: Game logic separated into testable functions

## Running Tests

```bash
pnpm test:run
```

All game logic functions are unit tested to ensure correct behavior.

## Game Logic Functions

The game is built with pure, testable functions:

- `createInitialSnake()` - Creates snake at starting position
- `moveSnake()` - Calculates new snake position
- `checkWallCollision()` - Detects wall collisions
- `checkSelfCollision()` - Detects self collisions
- `checkFoodCollision()` - Detects food eating
- `spawnFood()` - Spawns food at random valid position
- `getNewDirection()` - Prevents 180-degree turns

## Game Rules

1. The snake cannot turn 180 degrees (e.g., can't go directly from RIGHT to LEFT)
2. The snake grows by one segment when eating food
3. Food spawns randomly but never on the snake's body
4. The game speed is constant at 150ms per frame

Enjoy the game!
