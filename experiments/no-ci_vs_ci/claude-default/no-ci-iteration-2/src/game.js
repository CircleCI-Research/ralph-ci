// Game configuration
const GRID_SIZE = 20;
const CELL_SIZE = 20;

/**
 * Creates the initial snake at the center of the grid
 * @returns {Array<{x: number, y: number}>} Array of snake segments
 */
export function createInitialSnake() {
  const centerX = Math.floor(GRID_SIZE / 2);
  const centerY = Math.floor(GRID_SIZE / 2);

  return [
    { x: centerX, y: centerY },
    { x: centerX - 1, y: centerY },
    { x: centerX - 2, y: centerY },
  ];
}

/**
 * Moves the snake in the specified direction
 * @param {Array<{x: number, y: number}>} snake - Current snake segments
 * @param {{x: number, y: number}} direction - Direction vector (e.g., {x: 1, y: 0} for right)
 * @returns {Array<{x: number, y: number}>} New snake with moved head and removed tail
 */
export function moveSnake(snake, direction) {
  const head = snake[0];
  const newHead = {
    x: head.x + direction.x,
    y: head.y + direction.y,
  };

  // Create new snake array with new head, keeping all but the last segment
  return [newHead, ...snake.slice(0, -1)];
}

/**
 * Checks if the snake head has collided with a wall
 * @param {{x: number, y: number}} head - Snake head position
 * @param {number} gridSize - Size of the grid (20x20 means gridSize = 20)
 * @returns {boolean} True if collision detected, false otherwise
 */
export function checkWallCollision(head, gridSize) {
  return head.x < 0 || head.x >= gridSize || head.y < 0 || head.y >= gridSize;
}

/**
 * Checks if the snake head has collided with its own body
 * @param {Array<{x: number, y: number}>} snake - Snake segments
 * @returns {boolean} True if head collides with body, false otherwise
 */
export function checkSelfCollision(snake) {
  const head = snake[0];

  // Check if head position matches any body segment (skip head itself at index 0)
  for (let i = 1; i < snake.length; i++) {
    if (head.x === snake[i].x && head.y === snake[i].y) {
      return true;
    }
  }

  return false;
}

/**
 * Checks if the snake head has collided with food
 * @param {{x: number, y: number}} head - Snake head position
 * @param {{x: number, y: number}} food - Food position
 * @returns {boolean} True if head is at food position, false otherwise
 */
export function checkFoodCollision(head, food) {
  return head.x === food.x && head.y === food.y;
}

/**
 * Spawns food at a random position not on the snake
 * @param {number} gridSize - Size of the grid
 * @param {Array<{x: number, y: number}>} snake - Snake segments
 * @param {Function} random - Random function (defaults to Math.random)
 * @returns {{x: number, y: number}} Food position
 */
export function spawnFood(gridSize, snake, random = Math.random) {
  let food;
  let attempts = 0;
  const maxAttempts = gridSize * gridSize; // Prevent infinite loop

  do {
    food = {
      x: Math.floor(random() * gridSize),
      y: Math.floor(random() * gridSize),
    };
    attempts++;

    // Check if food is on snake
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
 * Gets the new direction, preventing 180-degree turns
 * @param {{x: number, y: number}} current - Current direction
 * @param {{x: number, y: number}} input - Requested new direction
 * @returns {{x: number, y: number}} Valid new direction
 */
export function getNewDirection(current, input) {
  // Check if the new direction is opposite to current direction
  // If moving right (1, 0) and trying to go left (-1, 0), keep current
  // If moving up (0, -1) and trying to go down (0, 1), keep current
  const isOpposite = current.x === -input.x && current.y === -input.y;

  return isOpposite ? current : input;
}

// Game rendering and loop (not tested - DOM dependent)
let canvas,
  ctx,
  snake,
  direction,
  nextDirection,
  food,
  gameLoopId,
  score,
  isGameOver,
  isGameStarted;

/**
 * Draws the snake on the canvas
 */
function drawSnake() {
  ctx.fillStyle = "#00ff00";
  snake.forEach((segment, index) => {
    // Make head slightly brighter
    if (index === 0) {
      ctx.fillStyle = "#00ff00";
    } else {
      ctx.fillStyle = "#00cc00";
    }
    ctx.fillRect(
      segment.x * CELL_SIZE,
      segment.y * CELL_SIZE,
      CELL_SIZE - 1,
      CELL_SIZE - 1,
    );
  });
}

/**
 * Clears the canvas
 */
function clearCanvas() {
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

/**
 * Draws the food on the canvas
 */
function drawFood() {
  ctx.fillStyle = "#ff0000"; // Red color for food
  ctx.fillRect(
    food.x * CELL_SIZE,
    food.y * CELL_SIZE,
    CELL_SIZE - 1,
    CELL_SIZE - 1,
  );
}

/**
 * Main game loop
 */
function gameLoop() {
  // Update direction with queued input
  direction = getNewDirection(direction, nextDirection);

  // Calculate new head position
  const newHead = {
    x: snake[0].x + direction.x,
    y: snake[0].y + direction.y,
  };

  // Check for collisions BEFORE moving
  if (
    checkWallCollision(newHead, GRID_SIZE) ||
    checkSelfCollision([newHead, ...snake])
  ) {
    // Game over!
    isGameOver = true;
    showGameOver();
    return; // Stop the game loop
  }

  // Check for food collision
  if (checkFoodCollision(newHead, food)) {
    // Grow snake by adding new head without removing tail
    snake = [newHead, ...snake];
    // Increase score
    score++;
    updateScoreDisplay();
    // Spawn new food
    food = spawnFood(GRID_SIZE, snake);
  } else {
    // Normal move (add head, remove tail)
    snake = moveSnake(snake, direction);
  }

  // Render
  clearCanvas();
  drawSnake();
  drawFood();

  // Continue loop
  gameLoopId = setTimeout(gameLoop, 150);
}

/**
 * Updates the score display on the page
 */
function updateScoreDisplay() {
  if (typeof document === "undefined") return;
  const scoreElement = document.getElementById("score");
  if (scoreElement) {
    scoreElement.textContent = score;
  }
}

/**
 * Shows the game over screen with final score
 */
function showGameOver() {
  if (typeof document === "undefined") return;

  const gameOverElement = document.getElementById("gameOver");
  const finalScoreElement = document.getElementById("finalScore");

  if (gameOverElement && finalScoreElement) {
    finalScoreElement.textContent = score;
    gameOverElement.style.display = "flex";
  }
}

/**
 * Shows the start message
 */
function showStartMessage() {
  if (typeof document === "undefined") return;

  const startMessage = document.getElementById("startMessage");
  if (startMessage) {
    startMessage.style.display = "flex";
  }
}

/**
 * Hides the start message
 */
function hideStartMessage() {
  if (typeof document === "undefined") return;

  const startMessage = document.getElementById("startMessage");
  if (startMessage) {
    startMessage.style.display = "none";
  }
}

/**
 * Resets game state and restarts the game
 */
function restartGame() {
  // Clear any existing game loop
  if (gameLoopId) {
    clearTimeout(gameLoopId);
    gameLoopId = null;
  }

  // Hide game over overlay
  const gameOverElement = document.getElementById("gameOver");
  if (gameOverElement) {
    gameOverElement.style.display = "none";
  }

  // Reset game state
  snake = createInitialSnake();
  direction = { x: 1, y: 0 };
  nextDirection = { x: 1, y: 0 };
  food = spawnFood(GRID_SIZE, snake);
  score = 0;
  isGameOver = false;
  isGameStarted = false;

  // Update display
  updateScoreDisplay();
  clearCanvas();
  drawSnake();
  drawFood();

  // Show start message
  showStartMessage();
}

/**
 * Handles keyboard input
 */
function handleKeyPress(event) {
  const key = event.key;

  // Start game with SPACE key if not started
  if (key === " " && !isGameStarted && !isGameOver) {
    event.preventDefault();
    isGameStarted = true;
    hideStartMessage();
    gameLoopId = setTimeout(gameLoop, 150);
    return;
  }

  // Arrow key controls (only when game is running)
  if (!isGameStarted || isGameOver) return;

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
  }
}

/**
 * Initializes and starts the game
 */
export function startGame() {
  // Only run in browser environment
  if (typeof document === "undefined") return;

  canvas = document.getElementById("gameCanvas");
  ctx = canvas.getContext("2d");

  // Initialize game state
  snake = createInitialSnake();
  direction = { x: 1, y: 0 }; // Start moving right
  nextDirection = { x: 1, y: 0 };
  food = spawnFood(GRID_SIZE, snake); // Initialize food
  score = 0; // Initialize score
  isGameOver = false; // Initialize game over flag
  isGameStarted = false; // Game starts paused
  updateScoreDisplay(); // Update score display

  // Set up keyboard controls
  document.addEventListener("keydown", handleKeyPress);

  // Set up restart button
  const restartButton = document.getElementById("restartButton");
  if (restartButton) {
    restartButton.addEventListener("click", restartGame);
  }

  // Show initial game state with start message
  clearCanvas();
  drawSnake();
  drawFood();
  showStartMessage();
  // Don't start game loop yet - wait for SPACE key
}

// Auto-start game when module loads in browser
if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startGame);
  } else {
    startGame();
  }
}
