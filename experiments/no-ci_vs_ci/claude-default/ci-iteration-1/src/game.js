/**
 * Classic Snake Game - Core Logic Module
 * Pure functions exported for testing
 */

/**
 * Creates the initial snake at the center of the grid
 * @returns {Array<{x: number, y: number}>} Array of snake segments
 */
export function createInitialSnake() {
  // Start with a 3-segment snake in the middle of a 20x20 grid
  // Snake starts moving right
  return [
    { x: 10, y: 10 }, // head
    { x: 9, y: 10 }, // body
    { x: 8, y: 10 }, // tail
  ];
}

/**
 * Moves the snake in the given direction
 * @param {Array<{x: number, y: number}>} snake - Current snake segments
 * @param {string} direction - Direction to move ('UP', 'DOWN', 'LEFT', 'RIGHT')
 * @param {boolean} shouldGrow - Whether the snake should grow this turn
 * @returns {Array<{x: number, y: number}>} New snake segments
 */
export function moveSnake(snake, direction, shouldGrow = false) {
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
      newHead = { x: head.x, y: head.y };
  }

  // Create new snake with new head
  const newSnake = [newHead, ...snake];

  // If not growing, remove the tail
  if (!shouldGrow) {
    newSnake.pop();
  }

  return newSnake;
}

/**
 * Checks if the snake head has hit a wall
 * @param {{x: number, y: number}} head - Snake head position
 * @param {number} gridSize - Size of the grid
 * @returns {boolean} True if collision detected
 */
export function checkWallCollision(head, gridSize) {
  return head.x < 0 || head.x >= gridSize || head.y < 0 || head.y >= gridSize;
}

/**
 * Checks if the snake head has collided with its own body
 * @param {Array<{x: number, y: number}>} snake - Snake segments
 * @returns {boolean} True if self-collision detected
 */
export function checkSelfCollision(snake) {
  if (snake.length < 2) return false;

  const head = snake[0];

  // Check if head position matches any body segment (skip head itself)
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
 * @returns {boolean} True if food collision detected
 */
export function checkFoodCollision(head, food) {
  return head.x === food.x && head.y === food.y;
}

/**
 * Spawns food at a random empty position
 * @param {number} gridSize - Size of the grid
 * @param {Array<{x: number, y: number}>} snake - Snake segments to avoid
 * @param {Function} random - Random function (for testing with deterministic values)
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
  // Prevent 180-degree turns
  const opposites = {
    UP: "DOWN",
    DOWN: "UP",
    LEFT: "RIGHT",
    RIGHT: "LEFT",
  };

  // If input direction is opposite to current, ignore it
  if (opposites[current] === input) {
    return current;
  }

  return input;
}

// Game initialization and DOM wiring (not tested)
// Constants
const GRID_SIZE = 20;
const CELL_SIZE = 20; // 400px / 20 = 20px per cell
const GAME_SPEED = 150; // milliseconds between moves

// Game state
let snake = createInitialSnake();
let direction = "RIGHT";
let nextDirection = "RIGHT";
let food = null;
let score = 0;
let gameLoop = null;
let isGameOver = false;
let isGameStarted = false;

// Get canvas and context (only in browser environment)
let canvas, ctx, scoreElement, startOverlay, gameOverOverlay, finalScoreElement;

if (typeof document !== "undefined") {
  canvas = document.getElementById("gameCanvas");
  ctx = canvas.getContext("2d");
  scoreElement = document.getElementById("score");
  startOverlay = document.getElementById("startOverlay");
  gameOverOverlay = document.getElementById("gameOverOverlay");
  finalScoreElement = document.getElementById("finalScore");
}

/**
 * Draws the snake on the canvas
 */
function drawSnake() {
  ctx.fillStyle = "#00ff00"; // Bright green for retro look

  snake.forEach((segment, index) => {
    ctx.fillRect(
      segment.x * CELL_SIZE,
      segment.y * CELL_SIZE,
      CELL_SIZE,
      CELL_SIZE,
    );

    // Add a small border to each segment for better visibility
    ctx.strokeStyle = "#0d0d0d";
    ctx.strokeRect(
      segment.x * CELL_SIZE,
      segment.y * CELL_SIZE,
      CELL_SIZE,
      CELL_SIZE,
    );
  });
}

/**
 * Draws the food on the canvas
 */
function drawFood() {
  if (!food) return;

  ctx.fillStyle = "#ff0000"; // Red for food (contrasts with green snake)
  ctx.fillRect(food.x * CELL_SIZE, food.y * CELL_SIZE, CELL_SIZE, CELL_SIZE);

  // Add a border for visibility
  ctx.strokeStyle = "#0d0d0d";
  ctx.strokeRect(food.x * CELL_SIZE, food.y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
}

/**
 * Clears the canvas
 */
function clearCanvas() {
  ctx.fillStyle = "#0d0d0d";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

/**
 * Displays the game over screen
 */
function showGameOver() {
  // Update final score display
  finalScoreElement.textContent = score;

  // Show game over overlay
  gameOverOverlay.classList.remove("hidden");
}

/**
 * Main game update function
 */
function update() {
  if (isGameOver) {
    stopGame();
    showGameOver();
    return;
  }

  // Update direction from queued input
  direction = getNewDirection(direction, nextDirection);

  // Check if snake will eat food this turn
  const head = snake[0];
  let newHead;
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
      newHead = { x: head.x, y: head.y };
  }

  const willEatFood = food && checkFoodCollision(newHead, food);

  // Move snake (grow if eating food)
  snake = moveSnake(snake, direction, willEatFood);

  // If ate food, spawn new food and update score
  if (willEatFood) {
    food = spawnFood(GRID_SIZE, snake);
    score++;
    scoreElement.textContent = score;
  }

  // Check collisions after moving
  const currentHead = snake[0];
  if (checkWallCollision(currentHead, GRID_SIZE) || checkSelfCollision(snake)) {
    isGameOver = true;
    return;
  }

  // Render
  clearCanvas();
  drawSnake();
  drawFood();
}

/**
 * Starts the game loop
 */
function startGame() {
  if (isGameStarted) return;

  isGameStarted = true;
  isGameOver = false;
  snake = createInitialSnake();
  direction = "RIGHT";
  nextDirection = "RIGHT";
  food = spawnFood(GRID_SIZE, snake);
  score = 0;
  scoreElement.textContent = score;

  // Hide overlays
  startOverlay.classList.add("hidden");
  gameOverOverlay.classList.add("hidden");

  // Start game loop
  gameLoop = setInterval(update, GAME_SPEED);
}

/**
 * Restarts the game after game over
 */
function restartGame() {
  // Reset game state
  stopGame();
  isGameOver = false;

  // Hide game over overlay
  gameOverOverlay.classList.add("hidden");

  // Start a new game
  startGame();
}

/**
 * Stops the game loop
 */
function stopGame() {
  if (gameLoop) {
    clearInterval(gameLoop);
    gameLoop = null;
  }
  isGameStarted = false;
}

/**
 * Handles keyboard input
 */
function handleKeyPress(event) {
  switch (event.key) {
    case "ArrowUp":
      event.preventDefault();
      nextDirection = "UP";
      break;
    case "ArrowDown":
      event.preventDefault();
      nextDirection = "DOWN";
      break;
    case "ArrowLeft":
      event.preventDefault();
      nextDirection = "LEFT";
      break;
    case "ArrowRight":
      event.preventDefault();
      nextDirection = "RIGHT";
      break;
    case " ":
      event.preventDefault();
      if (!isGameStarted) {
        startGame();
      }
      break;
  }
}

// Initialize game
if (typeof document !== "undefined") {
  // Add event listeners
  document.addEventListener("keydown", handleKeyPress);

  // Add restart button handler
  const restartButton = document.getElementById("restartButton");
  if (restartButton) {
    restartButton.addEventListener("click", restartGame);
  }

  // Initialize food for preview (before game starts)
  food = spawnFood(GRID_SIZE, snake);

  // Initial render
  clearCanvas();
  drawSnake();
  drawFood();
}
