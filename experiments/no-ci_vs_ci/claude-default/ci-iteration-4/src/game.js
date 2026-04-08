/**
 * Classic Snake Game - Core Logic Module
 * All game logic functions are exported for testing
 */

const GRID_SIZE = 20;
const CELL_SIZE = 20;

/**
 * Creates the initial snake at the starting position
 * @returns {Array<{x: number, y: number}>} Snake as array of segments
 */
export function createInitialSnake() {
  // Start snake in the middle of the grid with 3 segments
  const centerX = Math.floor(GRID_SIZE / 2);
  const centerY = Math.floor(GRID_SIZE / 2);

  return [
    { x: centerX, y: centerY }, // Head
    { x: centerX - 1, y: centerY }, // Body segment 1
    { x: centerX - 2, y: centerY }, // Tail
  ];
}

/**
 * Moves the snake in the given direction
 * @param {Array<{x: number, y: number}>} snake - Current snake
 * @param {string} direction - Direction: 'up', 'down', 'left', 'right'
 * @returns {Array<{x: number, y: number}>} New snake position
 */
export function moveSnake(snake, direction) {
  const head = snake[0];
  let newHead;

  switch (direction) {
    case "up":
      newHead = { x: head.x, y: head.y - 1 };
      break;
    case "down":
      newHead = { x: head.x, y: head.y + 1 };
      break;
    case "left":
      newHead = { x: head.x - 1, y: head.y };
      break;
    case "right":
      newHead = { x: head.x + 1, y: head.y };
      break;
    default:
      newHead = head;
  }

  // Add new head and remove tail (snake moves forward)
  return [newHead, ...snake.slice(0, -1)];
}

/**
 * Checks if snake head collides with walls
 * @param {{x: number, y: number}} head - Snake head position
 * @param {number} gridSize - Size of the grid
 * @returns {boolean} True if collision detected
 */
export function checkWallCollision(head, gridSize) {
  return head.x < 0 || head.x >= gridSize || head.y < 0 || head.y >= gridSize;
}

/**
 * Checks if snake head collides with its own body
 * @param {Array<{x: number, y: number}>} snake - Current snake
 * @returns {boolean} True if collision detected
 */
export function checkSelfCollision(snake) {
  const head = snake[0];
  // Check if head position matches any body segment (skip head itself)
  return snake
    .slice(1)
    .some((segment) => segment.x === head.x && segment.y === head.y);
}

/**
 * Checks if snake head collides with food
 * @param {{x: number, y: number}} head - Snake head position
 * @param {{x: number, y: number}} food - Food position
 * @returns {boolean} True if collision detected
 */
export function checkFoodCollision(head, food) {
  return head.x === food.x && head.y === food.y;
}

/**
 * Spawns food at a random position not occupied by snake
 * @param {number} gridSize - Size of the grid
 * @param {Array<{x: number, y: number}>} snake - Current snake
 * @param {Function} random - Random function (for testing, defaults to Math.random)
 * @returns {{x: number, y: number}} Food position
 */
export function spawnFood(gridSize, snake, random = Math.random) {
  let food;
  let attempts = 0;
  const maxAttempts = 100;

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
 * Gets new direction based on current direction and input
 * Prevents 180-degree turns
 * @param {string} current - Current direction
 * @param {string} input - Input direction
 * @returns {string} New direction
 */
export function getNewDirection(current, input) {
  const opposites = {
    up: "down",
    down: "up",
    left: "right",
    right: "left",
  };

  // Prevent 180-degree turns
  if (opposites[current] === input) {
    return current;
  }

  return input;
}

// Game state
let snake = createInitialSnake();
let direction = "right";
let food = spawnFood(GRID_SIZE, snake);
let score = 0;
let gameOver = false;
let gameStarted = false;
let gameLoop = null;

// DOM elements (initialized when DOM is ready)
let canvas, ctx, scoreElement, finalScoreElement, gameOverScreen, restartButton;

/**
 * Initialize the game (called when DOM is ready)
 */
export function startGame() {
  // Get DOM elements
  canvas = document.getElementById("gameCanvas");
  ctx = canvas.getContext("2d");
  scoreElement = document.getElementById("score");
  finalScoreElement = document.getElementById("finalScore");
  gameOverScreen = document.getElementById("gameOverScreen");
  restartButton = document.getElementById("restartButton");

  // Set canvas size
  canvas.width = GRID_SIZE * CELL_SIZE;
  canvas.height = GRID_SIZE * CELL_SIZE;

  // Setup event listeners
  document.addEventListener("keydown", handleKeyPress);
  restartButton.addEventListener("click", resetGame);

  // Initial render
  render();
}

/**
 * Handle keyboard input
 */
function handleKeyPress(event) {
  // Start game on space
  if (event.code === "Space" && !gameStarted) {
    gameStarted = true;
    startGameLoop();
    return;
  }

  // Direction controls
  const directionMap = {
    ArrowUp: "up",
    ArrowDown: "down",
    ArrowLeft: "left",
    ArrowRight: "right",
  };

  if (directionMap[event.code]) {
    event.preventDefault();
    direction = getNewDirection(direction, directionMap[event.code]);
  }
}

/**
 * Start the game loop
 */
function startGameLoop() {
  if (gameLoop) return;

  gameLoop = setInterval(() => {
    if (gameOver) {
      stopGameLoop();
      return;
    }

    update();
    render();
  }, 150); // ~6-7 moves per second
}

/**
 * Stop the game loop
 */
function stopGameLoop() {
  if (gameLoop) {
    clearInterval(gameLoop);
    gameLoop = null;
  }
}

/**
 * Update game state
 */
function update() {
  // Move snake
  snake = moveSnake(snake, direction);
  const head = snake[0];

  // Check collisions
  if (checkWallCollision(head, GRID_SIZE) || checkSelfCollision(snake)) {
    gameOver = true;
    showGameOver();
    return;
  }

  // Check food collision
  if (checkFoodCollision(head, food)) {
    score += 10;
    scoreElement.textContent = score;

    // Grow snake (don't remove tail on next move)
    snake.push({ ...snake[snake.length - 1] });

    // Spawn new food
    food = spawnFood(GRID_SIZE, snake);
  }
}

/**
 * Render the game
 */
function render() {
  // Clear canvas
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw snake
  ctx.fillStyle = "#0f0";
  snake.forEach((segment, index) => {
    ctx.fillRect(
      segment.x * CELL_SIZE,
      segment.y * CELL_SIZE,
      CELL_SIZE - 1,
      CELL_SIZE - 1,
    );

    // Draw head differently
    if (index === 0) {
      ctx.fillStyle = "#0a0";
      ctx.fillRect(
        segment.x * CELL_SIZE + 2,
        segment.y * CELL_SIZE + 2,
        CELL_SIZE - 5,
        CELL_SIZE - 5,
      );
      ctx.fillStyle = "#0f0";
    }
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

/**
 * Show game over screen
 */
function showGameOver() {
  stopGameLoop();
  finalScoreElement.textContent = score;
  gameOverScreen.classList.remove("hidden");
}

/**
 * Reset the game
 */
function resetGame() {
  snake = createInitialSnake();
  direction = "right";
  food = spawnFood(GRID_SIZE, snake);
  score = 0;
  gameOver = false;
  gameStarted = false;

  scoreElement.textContent = score;
  gameOverScreen.classList.add("hidden");

  render();
}

// Start the game when DOM is ready
if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startGame);
  } else {
    startGame();
  }
}
