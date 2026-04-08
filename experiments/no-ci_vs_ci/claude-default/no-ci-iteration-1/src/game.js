/**
 * Classic Snake Game - Game Logic Module
 *
 * This module exports pure functions for game logic that can be tested independently.
 */

/**
 * Creates the initial snake at the center of the grid
 * @returns {Array<{x: number, y: number}>} Array of snake segments (head is at index 0)
 */
export function createInitialSnake() {
  return [
    { x: 10, y: 10 },
    { x: 9, y: 10 },
    { x: 8, y: 10 },
  ];
}

/**
 * Moves the snake in the given direction
 * @param {Array<{x: number, y: number}>} snake - Current snake segments
 * @param {string} direction - Direction to move ('UP', 'DOWN', 'LEFT', 'RIGHT')
 * @param {boolean} grow - Whether to grow the snake (when food is eaten)
 * @returns {Array<{x: number, y: number}>} New snake segments
 */
export function moveSnake(snake, direction, grow = false) {
  const head = snake[0];
  let newHead;

  // Calculate new head position based on direction
  switch (direction) {
    case "UP":
      newHead = { x: head.x, y: head.y - 1 };
      break;
    case "DOWN":
      newHead = { x: head.x, y: head.y + 1 };
      break;
    case "LEFT":
      newHead = { x: head.x - 1, y: head.y };
      break;
    case "RIGHT":
      newHead = { x: head.x + 1, y: head.y };
      break;
    default:
      newHead = { ...head };
  }

  // Create new snake with new head
  const newSnake = [newHead, ...snake];

  // Remove tail unless growing
  if (!grow) {
    newSnake.pop();
  }

  return newSnake;
}

/**
 * Checks if the snake's head has hit a wall
 * @param {{x: number, y: number}} head - Snake's head position
 * @param {number} gridSize - Size of the grid
 * @returns {boolean} True if collision detected
 */
export function checkWallCollision(head, gridSize) {
  return head.x < 0 || head.x >= gridSize || head.y < 0 || head.y >= gridSize;
}

/**
 * Checks if the snake has collided with itself
 * @param {Array<{x: number, y: number}>} snake - Snake segments
 * @returns {boolean} True if collision detected
 */
export function checkSelfCollision(snake) {
  if (snake.length < 2) {
    return false;
  }

  // Check for any duplicate positions in the snake
  for (let i = 0; i < snake.length; i++) {
    for (let j = i + 1; j < snake.length; j++) {
      if (snake[i].x === snake[j].x && snake[i].y === snake[j].y) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Checks if the snake's head has reached the food
 * @param {{x: number, y: number}} head - Snake's head position
 * @param {{x: number, y: number}} food - Food position
 * @returns {boolean} True if food is eaten
 */
export function checkFoodCollision(head, food) {
  return head.x === food.x && head.y === food.y;
}

/**
 * Spawns food at a random location not occupied by the snake
 * @param {number} gridSize - Size of the grid
 * @param {Array<{x: number, y: number}>} snake - Current snake segments
 * @param {Function} random - Random function (for testing: () => number between 0-1)
 * @returns {{x: number, y: number}} Food position
 */
export function spawnFood(gridSize, snake, random = Math.random) {
  let food;
  let attempts = 0;
  const maxAttempts = gridSize * gridSize;

  do {
    // Generate position with offset based on attempts for deterministic random functions
    const baseX = Math.floor(random() * gridSize);
    const baseY = Math.floor(random() * gridSize);

    food = {
      x: (baseX + attempts) % gridSize,
      y: (baseY + Math.floor(attempts / gridSize)) % gridSize,
    };
    attempts++;
  } while (
    attempts < maxAttempts &&
    snake.some((segment) => segment.x === food.x && segment.y === food.y)
  );

  return food;
}

/**
 * Gets the new direction based on current direction and input
 * Prevents 180-degree turns
 * @param {string} current - Current direction
 * @param {string} input - Input direction
 * @returns {string} New direction
 */
export function getNewDirection(current, input) {
  // Define opposite directions to prevent 180-degree turns
  const opposites = {
    UP: "DOWN",
    DOWN: "UP",
    LEFT: "RIGHT",
    RIGHT: "LEFT",
  };

  // If input direction is opposite to current, maintain current direction
  if (opposites[current] === input) {
    return current;
  }

  // Otherwise, allow the new direction
  return input;
}

// Game state and DOM interaction (not tested)
const GRID_SIZE = 20;
const CELL_SIZE = 20;
const GAME_SPEED = 150; // milliseconds per frame

let gameState = {
  snake: null,
  food: null,
  direction: "RIGHT",
  nextDirection: "RIGHT",
  score: 0,
  gameOver: false,
  gameStarted: false,
  gameLoop: null,
};

let canvas,
  ctx,
  scoreElement,
  overlayElement,
  overlayMessage,
  restartButton,
  restartHint;

/**
 * Initialize the game canvas and UI elements
 */
function initGame() {
  canvas = document.getElementById("gameCanvas");
  ctx = canvas.getContext("2d");
  scoreElement = document.getElementById("score");
  overlayElement = document.getElementById("gameOverlay");
  overlayMessage = document.getElementById("overlayMessage");
  restartButton = document.getElementById("restartButton");
  restartHint = document.getElementById("restartHint");

  // Show initial overlay
  overlayElement.classList.remove("hidden");
  overlayMessage.textContent = "Press SPACE to Start";
  restartButton.classList.add("hidden");
  restartHint.classList.add("hidden");

  // Set up keyboard controls
  document.addEventListener("keydown", handleKeyPress);

  // Set up restart button
  restartButton.addEventListener("click", restartGame);
}

/**
 * Handle keyboard input
 */
function handleKeyPress(event) {
  // Start or restart game with SPACE
  if (event.code === "Space" && !gameState.gameStarted) {
    event.preventDefault();
    restartGame();
    return;
  }

  // Arrow key controls
  if (!gameState.gameStarted || gameState.gameOver) {
    return;
  }

  switch (event.code) {
    case "ArrowUp":
      event.preventDefault();
      gameState.nextDirection = getNewDirection(gameState.direction, "UP");
      break;
    case "ArrowDown":
      event.preventDefault();
      gameState.nextDirection = getNewDirection(gameState.direction, "DOWN");
      break;
    case "ArrowLeft":
      event.preventDefault();
      gameState.nextDirection = getNewDirection(gameState.direction, "LEFT");
      break;
    case "ArrowRight":
      event.preventDefault();
      gameState.nextDirection = getNewDirection(gameState.direction, "RIGHT");
      break;
  }
}

/**
 * Start the game loop
 */
function startGameLoop() {
  // Initialize game state
  gameState.snake = createInitialSnake();
  gameState.food = spawnFood(GRID_SIZE, gameState.snake);
  gameState.direction = "RIGHT";
  gameState.nextDirection = "RIGHT";
  gameState.score = 0;
  gameState.gameOver = false;
  gameState.gameStarted = true;

  // Hide overlay
  overlayElement.classList.add("hidden");

  // Update score display
  scoreElement.textContent = "0";

  // Start game loop
  if (gameState.gameLoop) {
    clearInterval(gameState.gameLoop);
  }
  gameState.gameLoop = setInterval(gameUpdate, GAME_SPEED);
}

/**
 * Main game update function (called every frame)
 */
function gameUpdate() {
  // Update direction
  gameState.direction = gameState.nextDirection;

  // Check if food will be eaten
  const head = gameState.snake[0];
  const willEatFood = checkFoodCollision(head, gameState.food);

  // Move snake (grow if eating food)
  gameState.snake = moveSnake(
    gameState.snake,
    gameState.direction,
    willEatFood,
  );

  // Get new head after movement
  const newHead = gameState.snake[0];

  // Check for collisions
  // Wall collision
  if (checkWallCollision(newHead, GRID_SIZE)) {
    endGame();
    return;
  }

  // Self collision
  if (checkSelfCollision(gameState.snake)) {
    endGame();
    return;
  }

  // If food was eaten, update score and spawn new food
  if (willEatFood) {
    gameState.score += 10;
    scoreElement.textContent = gameState.score.toString();
    gameState.food = spawnFood(GRID_SIZE, gameState.snake);
  }

  // Render
  render();
}

/**
 * Render the game on canvas
 */
function render() {
  // Clear canvas
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw snake
  ctx.fillStyle = "#00ff00";
  gameState.snake.forEach((segment, index) => {
    ctx.fillRect(
      segment.x * CELL_SIZE,
      segment.y * CELL_SIZE,
      CELL_SIZE - 1,
      CELL_SIZE - 1,
    );
  });

  // Draw food
  ctx.fillStyle = "#ff0000";
  ctx.fillRect(
    gameState.food.x * CELL_SIZE,
    gameState.food.y * CELL_SIZE,
    CELL_SIZE - 1,
    CELL_SIZE - 1,
  );
}

/**
 * End the game
 */
function endGame() {
  gameState.gameOver = true;
  gameState.gameStarted = false;

  // Stop game loop
  if (gameState.gameLoop) {
    clearInterval(gameState.gameLoop);
    gameState.gameLoop = null;
  }

  // Show game over overlay with restart options
  overlayMessage.textContent = `Game Over! Score: ${gameState.score}`;
  overlayElement.classList.remove("hidden");
  restartButton.classList.remove("hidden");
  restartHint.classList.remove("hidden");
}

/**
 * Restart the game
 */
function restartGame() {
  // Hide restart button and hint
  restartButton.classList.add("hidden");
  restartHint.classList.add("hidden");
  // Start new game
  startGameLoop();
}

/**
 * Starts the game (DOM interaction - not unit tested)
 */
export function startGame() {
  if (typeof document !== "undefined") {
    // Initialize when DOM is ready
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", initGame);
    } else {
      initGame();
    }
  }
}

// Auto-start the game when module loads
startGame();
