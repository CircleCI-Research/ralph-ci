// Game configuration
const GRID_SIZE = 20;
const CELL_SIZE = 20;
const INITIAL_SPEED = 150; // ms per frame

/**
 * Creates the initial snake at the center of the grid, facing right
 * @returns {Array<{x: number, y: number}>} Array of snake segment positions
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
 * Moves the snake in the given direction
 * @param {Array<{x: number, y: number}>} snake - Current snake positions
 * @param {{x: number, y: number}} direction - Direction vector
 * @param {boolean} grow - Whether to grow the snake
 * @returns {Array<{x: number, y: number}>} New snake positions
 */
export function moveSnake(snake, direction, grow = false) {
  const head = snake[0];
  const newHead = {
    x: head.x + direction.x,
    y: head.y + direction.y,
  };

  const newSnake = [newHead, ...snake];

  if (!grow) {
    newSnake.pop();
  }

  return newSnake;
}

/**
 * Checks if the snake's head has hit a wall
 * @param {{x: number, y: number}} head - Snake head position
 * @param {number} gridSize - Size of the grid
 * @returns {boolean} True if collision detected
 */
export function checkWallCollision(head, gridSize) {
  return head.x < 0 || head.x >= gridSize || head.y < 0 || head.y >= gridSize;
}

/**
 * Checks if the snake has collided with itself
 * @param {Array<{x: number, y: number}>} snake - Snake positions
 * @returns {boolean} True if collision detected
 */
export function checkSelfCollision(snake) {
  const head = snake[0];
  for (let i = 1; i < snake.length; i++) {
    if (head.x === snake[i].x && head.y === snake[i].y) {
      return true;
    }
  }
  return false;
}

/**
 * Checks if the snake's head has collided with food
 * @param {{x: number, y: number}} head - Snake head position
 * @param {{x: number, y: number}} food - Food position
 * @returns {boolean} True if collision detected
 */
export function checkFoodCollision(head, food) {
  return head.x === food.x && head.y === food.y;
}

/**
 * Spawns food at a random empty position
 * @param {number} gridSize - Size of the grid
 * @param {Array<{x: number, y: number}>} snake - Snake positions to avoid
 * @param {function} random - Random function (for testing)
 * @returns {{x: number, y: number}} Food position
 */
export function spawnFood(gridSize, snake, random = Math.random) {
  let food;
  let attempts = 0;
  const maxAttempts = gridSize * gridSize;

  do {
    food = {
      x: Math.floor(random() * gridSize),
      y: Math.floor(random() * gridSize),
    };
    attempts++;
  } while (
    attempts < maxAttempts &&
    snake.some((segment) => segment.x === food.x && segment.y === food.y)
  );

  return food;
}

/**
 * Gets the new direction based on input, preventing 180-degree turns
 * @param {{x: number, y: number}} current - Current direction
 * @param {{x: number, y: number}} input - Input direction
 * @returns {{x: number, y: number}} New direction
 */
export function getNewDirection(current, input) {
  // Prevent 180-degree turns
  if (input.x === -current.x && input.y === -current.y) {
    return current;
  }
  return input;
}

// Game state (only used in browser, not exported for testing)
let snake;
let direction;
let nextDirection;
let food;
let score;
let gameLoop;
let isGameRunning = false;

/**
 * Initializes and starts the game (browser only)
 */
export function startGame() {
  // Only run in browser environment
  if (typeof document === "undefined") return;

  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");
  const scoreElement = document.getElementById("score");
  const finalScoreElement = document.getElementById("finalScore");
  const gameOverElement = document.getElementById("gameOver");
  const restartBtn = document.getElementById("restartBtn");

  function initGame() {
    snake = createInitialSnake();
    direction = { x: 1, y: 0 };
    nextDirection = { x: 1, y: 0 };
    food = spawnFood(GRID_SIZE, snake);
    score = 0;
    isGameRunning = false;

    scoreElement.textContent = score;
    gameOverElement.classList.add("hidden");

    draw();
  }

  function draw() {
    // Clear canvas
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw snake
    ctx.fillStyle = "#0f0";
    snake.forEach((segment) => {
      ctx.fillRect(
        segment.x * CELL_SIZE,
        segment.y * CELL_SIZE,
        CELL_SIZE - 1,
        CELL_SIZE - 1,
      );
    });

    // Draw food
    ctx.fillStyle = "#f00";
    ctx.fillRect(
      food.x * CELL_SIZE,
      food.y * CELL_SIZE,
      CELL_SIZE - 1,
      CELL_SIZE - 1,
    );
  }

  function update() {
    direction = nextDirection;
    const newSnake = moveSnake(snake, direction);
    const head = newSnake[0];

    // Check collisions
    if (checkWallCollision(head, GRID_SIZE) || checkSelfCollision(newSnake)) {
      gameOver();
      return;
    }

    // Check food collision
    if (checkFoodCollision(head, food)) {
      score += 10;
      scoreElement.textContent = score;
      snake = moveSnake(snake, direction, true);
      food = spawnFood(GRID_SIZE, snake);
    } else {
      snake = newSnake;
    }

    draw();
  }

  function gameOver() {
    isGameRunning = false;
    clearInterval(gameLoop);
    finalScoreElement.textContent = score;
    gameOverElement.classList.remove("hidden");
  }

  function startGameLoop() {
    if (isGameRunning) return;
    isGameRunning = true;
    gameLoop = setInterval(update, INITIAL_SPEED);
  }

  // Keyboard controls
  document.addEventListener("keydown", (e) => {
    if (e.key === " " && !isGameRunning) {
      e.preventDefault();
      startGameLoop();
      return;
    }

    if (!isGameRunning) return;

    switch (e.key) {
      case "ArrowUp":
        e.preventDefault();
        nextDirection = getNewDirection(direction, { x: 0, y: -1 });
        break;
      case "ArrowDown":
        e.preventDefault();
        nextDirection = getNewDirection(direction, { x: 0, y: 1 });
        break;
      case "ArrowLeft":
        e.preventDefault();
        nextDirection = getNewDirection(direction, { x: -1, y: 0 });
        break;
      case "ArrowRight":
        e.preventDefault();
        nextDirection = getNewDirection(direction, { x: 1, y: 0 });
        break;
    }
  });

  restartBtn.addEventListener("click", () => {
    initGame();
  });

  // Initialize game
  initGame();
}

// Auto-start when loaded in browser
if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startGame);
  } else {
    startGame();
  }
}
