/**
 * Classic Snake Game - Core Logic Module
 * Exports pure functions for testing and game management
 */

/**
 * Creates the initial snake positioned at the center of the grid
 * @returns {Array<{x: number, y: number}>} Array of snake segments
 */
export function createInitialSnake() {
  // Snake starts with 3 segments in the center of a 20x20 grid
  // Grid coordinates: 0-19, so center is around 10
  return [
    { x: 10, y: 10 }, // Head
    { x: 9, y: 10 }, // Body
    { x: 8, y: 10 }, // Tail
  ];
}

/**
 * Moves the snake in the given direction
 * @param {Array<{x: number, y: number}>} snake - Current snake segments
 * @param {{x: number, y: number}} direction - Direction vector
 * @returns {Array<{x: number, y: number}>} New snake position
 */
export function moveSnake(snake, direction) {
  // Create new head position by adding direction to current head
  const head = snake[0];
  const newHead = {
    x: head.x + direction.x,
    y: head.y + direction.y,
  };

  // Create new snake with new head and all segments except the tail
  const newSnake = [newHead, ...snake.slice(0, -1)];

  return newSnake;
}

/**
 * Checks if the snake head collides with walls
 * @param {{x: number, y: number}} head - Snake head position
 * @param {number} gridSize - Size of the grid (default 20)
 * @returns {boolean} True if collision detected
 */
export function checkWallCollision(head, gridSize = 20) {
  return head.x < 0 || head.x >= gridSize || head.y < 0 || head.y >= gridSize;
}

/**
 * Checks if the snake head collides with its own body
 * @param {Array<{x: number, y: number}>} snake - Current snake segments
 * @returns {boolean} True if self-collision detected
 */
export function checkSelfCollision(snake) {
  if (snake.length <= 1) {
    return false;
  }

  const head = snake[0];

  // Check if head position matches any body segment (index 1 onwards)
  for (let i = 1; i < snake.length; i++) {
    if (head.x === snake[i].x && head.y === snake[i].y) {
      return true;
    }
  }

  return false;
}

/**
 * Checks if the snake head collides with food
 * @param {{x: number, y: number}} head - Snake head position
 * @param {{x: number, y: number}} food - Food position
 * @returns {boolean} True if food collision detected
 */
export function checkFoodCollision(head, food) {
  return head.x === food.x && head.y === food.y;
}

/**
 * Spawns food at a random position not occupied by the snake
 * @param {number} gridSize - Size of the grid
 * @param {Array<{x: number, y: number}>} snake - Current snake segments
 * @param {Function} random - Random function (for testing)
 * @returns {{x: number, y: number}} Food position
 */
export function spawnFood(gridSize, snake, random = Math.random) {
  let food;
  let attempts = 0;
  const maxAttempts = 1000; // Prevent infinite loops

  do {
    food = {
      x: Math.floor(random() * gridSize),
      y: Math.floor(random() * gridSize),
    };
    attempts++;

    // Check if food position is not on any snake segment
    const isOnSnake = snake.some(
      (segment) => segment.x === food.x && segment.y === food.y,
    );

    if (!isOnSnake) {
      break;
    }
  } while (attempts < maxAttempts);

  return food;
}

/**
 * Gets the new direction based on current direction and input
 * Prevents 180-degree turns
 * @param {{x: number, y: number}} current - Current direction
 * @param {{x: number, y: number}} input - Input direction
 * @returns {{x: number, y: number}} New valid direction
 */
export function getNewDirection(current, input) {
  // Check if the input direction is opposite to current direction
  // Opposite means: current.x + input.x === 0 AND current.y + input.y === 0
  const isOpposite = current.x + input.x === 0 && current.y + input.y === 0;

  // If opposite direction, keep current direction (prevent 180-degree turn)
  if (isOpposite) {
    return current;
  }

  // Otherwise, allow the new direction
  return input;
}

// Game Constants
const GRID_SIZE = 20;
const CELL_SIZE = 20;

// Game State
let snake = createInitialSnake();
let direction = { x: 1, y: 0 }; // Start moving right
let nextDirection = { x: 1, y: 0 };
let food = null;
let gameLoopId = null;
let isGameRunning = false;
let score = 0;

/**
 * Draws the snake on the canvas
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Array<{x: number, y: number}>} snake - Snake segments
 */
function drawSnake(ctx, snake) {
  ctx.fillStyle = "#00ff00"; // Neon green
  snake.forEach((segment, index) => {
    ctx.fillRect(
      segment.x * CELL_SIZE,
      segment.y * CELL_SIZE,
      CELL_SIZE,
      CELL_SIZE,
    );

    // Add border to segments for retro look
    ctx.strokeStyle = "#1a1a1a";
    ctx.lineWidth = 1;
    ctx.strokeRect(
      segment.x * CELL_SIZE,
      segment.y * CELL_SIZE,
      CELL_SIZE,
      CELL_SIZE,
    );
  });
}

/**
 * Clears the canvas
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 */
function clearCanvas(ctx) {
  ctx.fillStyle = "#1a1a1a"; // Dark background
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
}

/**
 * Draws the food on the canvas
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {{x: number, y: number}} food - Food position
 */
function drawFood(ctx, food) {
  if (!food) return;

  // Draw food with red color for contrast
  ctx.fillStyle = "#ff0000"; // Red
  ctx.fillRect(food.x * CELL_SIZE, food.y * CELL_SIZE, CELL_SIZE, CELL_SIZE);

  // Add border for retro look
  ctx.strokeStyle = "#1a1a1a";
  ctx.lineWidth = 1;
  ctx.strokeRect(food.x * CELL_SIZE, food.y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
}

/**
 * Game loop - runs continuously
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 */
function gameLoop(ctx) {
  // Update direction with the queued next direction
  direction = getNewDirection(direction, nextDirection);

  // Move snake
  snake = moveSnake(snake, direction);

  // Check collisions
  const head = snake[0];
  if (checkWallCollision(head, GRID_SIZE) || checkSelfCollision(snake)) {
    endGame();
    return;
  }

  // Check food collision
  if (food && checkFoodCollision(head, food)) {
    // Grow snake by adding the tail back
    const tail = snake[snake.length - 1];
    snake = [...snake, tail];

    // Update score
    score += 10;
    updateScoreDisplay();

    // Spawn new food
    food = spawnFood(GRID_SIZE, snake);
  }

  // Render
  clearCanvas(ctx);
  drawSnake(ctx, snake);
  drawFood(ctx, food);

  // Continue loop
  if (isGameRunning) {
    gameLoopId = setTimeout(() => gameLoop(ctx), 150); // 150ms per frame (adjust for speed)
  }
}

/**
 * Updates the score display in the UI
 */
function updateScoreDisplay() {
  const scoreElement = document.getElementById("score");
  if (scoreElement) {
    scoreElement.textContent = score;
  }
}

/**
 * Ends the game
 */
function endGame() {
  isGameRunning = false;
  if (gameLoopId) {
    clearTimeout(gameLoopId);
    gameLoopId = null;
  }

  // Update final score display
  const finalScoreElement = document.getElementById("final-score");
  if (finalScoreElement) {
    finalScoreElement.textContent = score;
  }

  // Show game over screen
  const gameOverElement = document.getElementById("game-over");
  if (gameOverElement) {
    gameOverElement.classList.remove("hidden");
  }
}

/**
 * Restarts the game
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 */
function restartGame(ctx) {
  // Reset game state
  snake = createInitialSnake();
  direction = { x: 1, y: 0 };
  nextDirection = { x: 1, y: 0 };
  food = spawnFood(GRID_SIZE, snake);
  score = 0;
  updateScoreDisplay();

  // Hide game over screen
  const gameOverElement = document.getElementById("game-over");
  if (gameOverElement) {
    gameOverElement.classList.add("hidden");
  }

  // Start game
  isGameRunning = true;
  gameLoop(ctx);
}

/**
 * Handles keyboard input
 * @param {KeyboardEvent} event - Keyboard event
 */
function handleKeyPress(event) {
  const key = event.key;

  // Arrow key controls
  if (key === "ArrowUp") {
    nextDirection = { x: 0, y: -1 };
    event.preventDefault();
  } else if (key === "ArrowDown") {
    nextDirection = { x: 0, y: 1 };
    event.preventDefault();
  } else if (key === "ArrowLeft") {
    nextDirection = { x: -1, y: 0 };
    event.preventDefault();
  } else if (key === "ArrowRight") {
    nextDirection = { x: 1, y: 0 };
    event.preventDefault();
  } else if (key === " " && !isGameRunning) {
    // Start game with spacebar
    const canvas = document.getElementById("game-canvas");
    const ctx = canvas.getContext("2d");
    restartGame(ctx);
    event.preventDefault();
  }
}

// DOM-based game initialization (not tested)
export function startGame() {
  // Get canvas element
  const canvas = document.getElementById("game-canvas");
  if (!canvas) {
    console.error("Canvas element not found");
    return;
  }

  const ctx = canvas.getContext("2d");

  // Initialize food
  food = spawnFood(GRID_SIZE, snake);

  // Set up event listeners
  document.addEventListener("keydown", handleKeyPress);

  // Restart button
  const restartButton = document.getElementById("restart-button");
  if (restartButton) {
    restartButton.addEventListener("click", () => {
      restartGame(ctx);
    });
  }

  // Draw initial state
  clearCanvas(ctx);
  drawSnake(ctx, snake);
  drawFood(ctx, food);
}

// Auto-start game when module loads (if in browser)
if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startGame);
  } else {
    startGame();
  }
}
