/**
 * Creates the initial snake at the center of the grid
 * @param {number} gridSize - The size of the game grid (e.g., 20 for 20x20)
 * @returns {Array<{x: number, y: number}>} Array of snake segments, head first
 */
export function createInitialSnake(gridSize) {
  const center = Math.floor(gridSize / 2);
  return [
    { x: center, y: center }, // Head
    { x: center - 1, y: center }, // Body segment 1
    { x: center - 2, y: center }, // Body segment 2 (tail)
  ];
}

/**
 * Moves the snake in the given direction
 * @param {Array<{x: number, y: number}>} snake - Current snake segments
 * @param {{x: number, y: number}} direction - Direction to move (e.g., {x: 1, y: 0} for right)
 * @param {boolean} grow - Whether the snake should grow (don't remove tail)
 * @returns {Array<{x: number, y: number}>} New snake segments after moving
 */
export function moveSnake(snake, direction, grow = false) {
  const head = snake[0];
  const newHead = {
    x: head.x + direction.x,
    y: head.y + direction.y,
  };

  const newSnake = [newHead, ...snake];

  if (!grow) {
    newSnake.pop(); // Remove tail
  }

  return newSnake;
}

/**
 * Checks if the snake head has collided with a wall
 * @param {{x: number, y: number}} head - Snake head position
 * @param {number} gridSize - Size of the game grid
 * @returns {boolean} True if collision detected
 */
export function checkWallCollision(head, gridSize) {
  return head.x < 0 || head.x >= gridSize || head.y < 0 || head.y >= gridSize;
}

/**
 * Checks if the snake head has collided with its own body
 * @param {Array<{x: number, y: number}>} snake - Snake segments
 * @returns {boolean} True if self collision detected
 */
export function checkSelfCollision(snake) {
  if (snake.length < 2) return false;

  const head = snake[0];
  // Check if head collides with any body segment (skip index 0 which is the head)
  for (let i = 1; i < snake.length; i++) {
    if (head.x === snake[i].x && head.y === snake[i].y) {
      return true;
    }
  }
  return false;
}

/**
 * Checks if the snake head is on the food
 * @param {{x: number, y: number}} head - Snake head position
 * @param {{x: number, y: number}} food - Food position
 * @returns {boolean} True if head is on food
 */
export function checkFoodCollision(head, food) {
  return head.x === food.x && head.y === food.y;
}

/**
 * Spawns food at a random position not on the snake
 * @param {number} gridSize - Size of the game grid
 * @param {Array<{x: number, y: number}>} snake - Snake segments to avoid
 * @param {Function} random - Random function (for testing)
 * @returns {{x: number, y: number}} Food position
 */
export function spawnFood(gridSize, snake, random = Math.random) {
  // Build a list of all available positions (not on snake)
  const availablePositions = [];

  for (let x = 0; x < gridSize; x++) {
    for (let y = 0; y < gridSize; y++) {
      const isOnSnake = snake.some(
        (segment) => segment.x === x && segment.y === y,
      );
      if (!isOnSnake) {
        availablePositions.push({ x, y });
      }
    }
  }

  // Pick a random position from available ones
  if (availablePositions.length === 0) {
    // Fallback: if snake fills entire grid (shouldn't happen in practice)
    return { x: 0, y: 0 };
  }

  const index = Math.floor(random() * availablePositions.length);
  return availablePositions[index];
}

/**
 * Gets the new direction, preventing 180-degree turns
 * @param {{x: number, y: number}} currentDirection - Current direction
 * @param {{x: number, y: number}} inputDirection - Requested direction from input
 * @returns {{x: number, y: number}} Valid direction (current or input)
 */
export function getNewDirection(currentDirection, inputDirection) {
  // Check if input direction is opposite to current direction
  const isOpposite =
    currentDirection.x + inputDirection.x === 0 &&
    currentDirection.y + inputDirection.y === 0;

  // If opposite, keep current direction; otherwise use input
  return isOpposite ? currentDirection : inputDirection;
}

// Game state and constants
const GRID_SIZE = 20;
const CELL_SIZE = 20;
const GAME_SPEED = 100; // milliseconds per move

let canvas;
let ctx;
let snake;
let direction;
let nextDirection;
let food;
let gameLoopId;
let score;
let scoreElement;
let gameOverScreen;
let finalScoreElement;
let startScreen;

/**
 * Main game loop
 */
function gameLoop() {
  // Update direction (with 180-degree turn prevention)
  direction = getNewDirection(direction, nextDirection);

  // Check if snake will eat food
  const willEatFood = checkFoodCollision(
    { x: snake[0].x + direction.x, y: snake[0].y + direction.y },
    food,
  );

  // Move snake (grow if eating food)
  snake = moveSnake(snake, direction, willEatFood);

  // Check for collisions after moving
  const head = snake[0];
  const hasWallCollision = checkWallCollision(head, GRID_SIZE);
  const hasSelfCollision = checkSelfCollision(snake);

  if (hasWallCollision || hasSelfCollision) {
    gameOver();
    return;
  }

  // Spawn new food if eaten
  if (willEatFood) {
    food = spawnFood(GRID_SIZE, snake);
    score++;
    updateScore();
  }

  // Render
  render();
}

/**
 * Renders the game state to canvas
 */
function render() {
  // Clear canvas
  ctx.fillStyle = "#0f3460";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw snake
  ctx.fillStyle = "#00ff88";
  snake.forEach((segment) => {
    ctx.fillRect(
      segment.x * CELL_SIZE,
      segment.y * CELL_SIZE,
      CELL_SIZE - 1,
      CELL_SIZE - 1,
    );
  });

  // Draw food
  ctx.fillStyle = "#ff0066"; // Bright pink/red for food
  ctx.fillRect(
    food.x * CELL_SIZE,
    food.y * CELL_SIZE,
    CELL_SIZE - 1,
    CELL_SIZE - 1,
  );
}

/**
 * Updates the score display
 */
function updateScore() {
  if (scoreElement) {
    scoreElement.textContent = score;
  }
}

/**
 * Handles game over state
 */
function gameOver() {
  // Stop the game loop
  if (gameLoopId) {
    clearInterval(gameLoopId);
    gameLoopId = null;
  }

  // Update final score and show game over screen
  if (finalScoreElement) {
    finalScoreElement.textContent = score;
  }
  if (gameOverScreen) {
    gameOverScreen.classList.remove("hidden");
  }
}

/**
 * Handles keyboard input
 */
function handleKeyPress(event) {
  switch (event.key) {
    case "ArrowUp":
      event.preventDefault();
      nextDirection = { x: 0, y: -1 };
      break;
    case "ArrowDown":
      event.preventDefault();
      nextDirection = { x: 0, y: 1 };
      break;
    case "ArrowLeft":
      event.preventDefault();
      nextDirection = { x: -1, y: 0 };
      break;
    case "ArrowRight":
      event.preventDefault();
      nextDirection = { x: 1, y: 0 };
      break;
    case " ":
      event.preventDefault();
      // Start game on space (if not already running)
      if (!gameLoopId) {
        startGame();
      }
      break;
  }
}

/**
 * Initializes and starts the game
 */
export function startGame() {
  // Guard against running in test environment
  if (typeof document === "undefined") {
    return;
  }

  // Stop any existing game loop
  if (gameLoopId) {
    clearInterval(gameLoopId);
    gameLoopId = null;
  }

  canvas = document.getElementById("gameCanvas");
  ctx = canvas.getContext("2d");

  // Get DOM elements
  scoreElement = document.getElementById("score");
  gameOverScreen = document.getElementById("gameOverScreen");
  finalScoreElement = document.getElementById("finalScore");
  startScreen = document.getElementById("startScreen");

  // Initialize game state
  snake = createInitialSnake(GRID_SIZE);
  direction = { x: 1, y: 0 }; // Start moving right
  nextDirection = { x: 1, y: 0 };
  food = spawnFood(GRID_SIZE, snake);
  score = 0;

  // Hide game over screen and start screen
  if (gameOverScreen) {
    gameOverScreen.classList.add("hidden");
  }
  if (startScreen) {
    startScreen.classList.add("hidden");
  }

  // Update score display
  updateScore();

  // Start game loop
  gameLoopId = setInterval(gameLoop, GAME_SPEED);

  // Initial render
  render();
}

// Initialize keyboard controls and restart button (only in browser)
if (typeof document !== "undefined") {
  // Set up keyboard controls once
  document.addEventListener("keydown", handleKeyPress);

  // Set up restart button
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      const restartButton = document.getElementById("restartButton");
      if (restartButton) {
        restartButton.addEventListener("click", startGame);
      }
      // Show initial canvas (without starting game loop)
      initializeCanvas();
    });
  } else {
    const restartButton = document.getElementById("restartButton");
    if (restartButton) {
      restartButton.addEventListener("click", startGame);
    }
    // Show initial canvas (without starting game loop)
    initializeCanvas();
  }
}

/**
 * Initializes canvas and shows initial state (waiting for player to press SPACE)
 */
function initializeCanvas() {
  if (typeof document === "undefined") {
    return;
  }

  canvas = document.getElementById("gameCanvas");
  ctx = canvas.getContext("2d");

  // Draw empty grid
  ctx.fillStyle = "#0f3460";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}
