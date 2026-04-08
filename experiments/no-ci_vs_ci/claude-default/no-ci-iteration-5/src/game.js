/**
 * Snake Game Logic
 * Pure functions for testability
 */

/**
 * Creates the initial snake with 3 segments starting at the center
 * @returns {Array<{x: number, y: number}>} Array of snake segments (head first)
 */
export function createInitialSnake() {
  // Snake starts at center of 20x20 grid (position 10,10)
  // with 3 segments moving right
  return [
    { x: 10, y: 10 }, // head
    { x: 9, y: 10 }, // body
    { x: 8, y: 10 }, // tail
  ];
}

/**
 * Moves the snake in the current direction
 * @param {Array<{x: number, y: number}>} snake - Current snake
 * @param {{x: number, y: number}} direction - Movement direction
 * @param {boolean} grow - Whether to grow (ate food)
 * @returns {Array<{x: number, y: number}>} New snake position
 */
export function moveSnake(snake, direction, grow = false) {
  // Calculate new head position by adding direction to current head
  const head = snake[0];
  const newHead = {
    x: head.x + direction.x,
    y: head.y + direction.y,
  };

  // Create new snake with new head at front
  const newSnake = [newHead, ...snake];

  // If not growing, remove the tail
  if (!grow) {
    newSnake.pop();
  }

  return newSnake;
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
 * Checks if snake head collides with its body
 * @param {Array<{x: number, y: number}>} snake - Current snake
 * @returns {boolean} True if collision detected
 */
export function checkSelfCollision(snake) {
  const head = snake[0];
  // Check if head position matches any body segment (skip the head itself)
  for (let i = 1; i < snake.length; i++) {
    if (head.x === snake[i].x && head.y === snake[i].y) {
      return true;
    }
  }
  return false;
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
 * Spawns food at random empty position
 * @param {number} gridSize - Size of the grid
 * @param {Array<{x: number, y: number}>} snake - Current snake
 * @param {Function} random - Random function (for testing)
 * @returns {{x: number, y: number}} Food position
 */
export function spawnFood(gridSize, snake, random = Math.random) {
  // Build list of all empty positions
  const emptyPositions = [];

  for (let x = 0; x < gridSize; x++) {
    for (let y = 0; y < gridSize; y++) {
      const onSnake = snake.some(
        (segment) => segment.x === x && segment.y === y,
      );

      if (!onSnake) {
        emptyPositions.push({ x, y });
      }
    }
  }

  // If no empty positions (shouldn't happen), return a default
  if (emptyPositions.length === 0) {
    return { x: 0, y: 0 };
  }

  // Select random empty position
  const index = Math.floor(random() * emptyPositions.length);
  return emptyPositions[index];
}

/**
 * Gets new direction based on input (prevents 180-degree turns)
 * @param {{x: number, y: number}} current - Current direction
 * @param {{x: number, y: number}} input - Input direction
 * @returns {{x: number, y: number}} Valid new direction
 */
export function getNewDirection(current, input) {
  // Prevent 180-degree turns by checking if input is opposite to current
  // Opposite means: current.x + input.x === 0 AND current.y + input.y === 0
  const isOpposite = current.x + input.x === 0 && current.y + input.y === 0;

  // If trying to go opposite direction, keep current direction
  if (isOpposite) {
    return current;
  }

  // Otherwise, accept the new direction
  return input;
}

// ========================================
// Game Rendering and Loop (DOM-dependent)
// ========================================

// Only run if in browser environment
if (typeof document !== "undefined") {
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");
  const scoreDisplay = document.getElementById("score");

  // Game constants
  const GRID_SIZE = 20;
  const CELL_SIZE = canvas.width / GRID_SIZE;
  const GAME_SPEED = 100; // milliseconds per frame

  // Game state
  let snake = createInitialSnake();
  let direction = { x: 1, y: 0 }; // start moving right
  let nextDirection = { x: 1, y: 0 };
  let food = spawnFood(GRID_SIZE, snake);
  let gameLoopId = null;
  let gameStarted = false;
  let score = 0;

  /**
   * Draws the snake on the canvas
   */
  function drawSnake() {
    ctx.fillStyle = "#00ff00"; // retro green
    snake.forEach((segment, index) => {
      ctx.fillRect(
        segment.x * CELL_SIZE,
        segment.y * CELL_SIZE,
        CELL_SIZE,
        CELL_SIZE,
      );

      // Add slight border between segments
      ctx.strokeStyle = "#0a0a0a";
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
   * Clears the entire canvas
   */
  function clearCanvas() {
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  /**
   * Draws the food on the canvas
   */
  function drawFood() {
    ctx.fillStyle = "#ff0000"; // red for food
    ctx.fillRect(food.x * CELL_SIZE, food.y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
  }

  /**
   * Main game loop
   */
  function gameLoop() {
    // Update direction (applying queued input)
    direction = getNewDirection(direction, nextDirection);

    // Check if snake will eat food after moving
    const newHead = {
      x: snake[0].x + direction.x,
      y: snake[0].y + direction.y,
    };
    const willEatFood = checkFoodCollision(newHead, food);

    // Move snake (grow if eating food)
    snake = moveSnake(snake, direction, willEatFood);

    // Check for collisions after moving
    const head = snake[0];
    if (checkWallCollision(head, GRID_SIZE) || checkSelfCollision(snake)) {
      gameOver();
      return;
    }

    // If food was eaten, spawn new food and update score
    if (willEatFood) {
      food = spawnFood(GRID_SIZE, snake);
      score += 10;
      scoreDisplay.textContent = score;
    }

    // Render
    clearCanvas();
    drawSnake();
    drawFood();
  }

  /**
   * Handles game over
   */
  function gameOver() {
    // Stop game loop
    clearInterval(gameLoopId);
    gameLoopId = null;
    gameStarted = false;

    // Show game over screen
    const gameOverDiv = document.getElementById("gameOver");
    const finalScoreDisplay = document.getElementById("finalScore");
    finalScoreDisplay.textContent = score;
    gameOverDiv.classList.remove("hidden");
  }

  /**
   * Starts the game
   */
  function startGame() {
    if (gameStarted) return;

    gameStarted = true;
    snake = createInitialSnake();
    direction = { x: 1, y: 0 };
    nextDirection = { x: 1, y: 0 };
    food = spawnFood(GRID_SIZE, snake);
    score = 0;
    scoreDisplay.textContent = score;

    // Hide game over screen if visible
    const gameOverDiv = document.getElementById("gameOver");
    gameOverDiv.classList.add("hidden");

    // Hide start prompt
    const startPrompt = document.getElementById("startPrompt");
    startPrompt.classList.add("hidden");

    // Start game loop
    gameLoopId = setInterval(gameLoop, GAME_SPEED);
  }

  /**
   * Handles keyboard input
   */
  function handleKeyPress(event) {
    const key = event.key;

    // Start game with SPACE
    if (key === " " && !gameStarted) {
      event.preventDefault();
      startGame();
      return;
    }

    // Handle arrow keys
    if (!gameStarted) return;

    let newDirection = null;

    switch (key) {
      case "ArrowUp":
        newDirection = { x: 0, y: -1 };
        break;
      case "ArrowDown":
        newDirection = { x: 0, y: 1 };
        break;
      case "ArrowLeft":
        newDirection = { x: -1, y: 0 };
        break;
      case "ArrowRight":
        newDirection = { x: 1, y: 0 };
        break;
    }

    if (newDirection) {
      event.preventDefault();
      nextDirection = newDirection;
    }
  }

  // Add event listener for keyboard input
  document.addEventListener("keydown", handleKeyPress);

  // Add event listener for restart button
  const restartBtn = document.getElementById("restartBtn");
  restartBtn.addEventListener("click", () => {
    startGame();
  });

  // Initial render (show starting snake and food)
  clearCanvas();
  drawSnake();
  drawFood();
}
