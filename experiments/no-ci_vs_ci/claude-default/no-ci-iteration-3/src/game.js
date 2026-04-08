// Game constants
const GRID_SIZE = 20;
const CELL_SIZE = 20;

/**
 * Creates the initial snake at the center of the grid, facing right
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
 * Move snake in given direction
 * @param {Array<{x: number, y: number}>} snake - Current snake segments
 * @param {{dx: number, dy: number}} direction - Direction to move
 * @returns {Array<{x: number, y: number}>} New snake segments
 */
export function moveSnake(snake, direction) {
  const head = snake[0];
  const newHead = {
    x: head.x + direction.dx,
    y: head.y + direction.dy,
  };

  // Create new snake array with new head and all segments except the last one
  return [newHead, ...snake.slice(0, -1)];
}

/**
 * Check if head collides with wall
 * @param {{x: number, y: number}} head - Snake head position
 * @param {number} gridSize - Size of the grid
 * @returns {boolean} True if collision detected
 */
export function checkWallCollision(head, gridSize) {
  return head.x < 0 || head.x >= gridSize || head.y < 0 || head.y >= gridSize;
}

/**
 * Check if head collides with snake body
 * @param {Array<{x: number, y: number}>} snake - Snake segments
 * @returns {boolean} True if collision detected
 */
export function checkSelfCollision(snake) {
  const head = snake[0];
  // Check if head position matches any body segment (skip index 0 which is the head itself)
  for (let i = 1; i < snake.length; i++) {
    if (head.x === snake[i].x && head.y === snake[i].y) {
      return true;
    }
  }
  return false;
}

/**
 * Check if head collides with food
 * @param {{x: number, y: number}} head - Snake head position
 * @param {{x: number, y: number}} food - Food position
 * @returns {boolean} True if collision detected
 */
export function checkFoodCollision(head, food) {
  return head.x === food.x && head.y === food.y;
}

/**
 * Spawn food at random position not on snake
 * @param {number} gridSize - Size of the grid
 * @param {Array<{x: number, y: number}>} snake - Snake segments
 * @param {Function} random - Random function for testing (defaults to Math.random)
 * @returns {{x: number, y: number}} Food position
 */
export function spawnFood(gridSize, snake, random = Math.random) {
  let food;
  let attempts = 0;
  const maxAttempts = gridSize * gridSize; // Prevent infinite loops

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
 * Get new direction preventing 180-degree turns
 * @param {{dx: number, dy: number}} current - Current direction
 * @param {{dx: number, dy: number}} input - Input direction
 * @returns {{dx: number, dy: number}} New valid direction
 */
export function getNewDirection(current, input) {
  // Check if the input direction is opposite to current direction
  // If dx values are opposite (e.g., 1 and -1) or dy values are opposite
  const isOpposite =
    (current.dx === -input.dx && current.dx !== 0) ||
    (current.dy === -input.dy && current.dy !== 0);

  // If input would cause 180-degree turn, keep current direction
  return isOpposite ? current : input;
}

// DOM-based game initialization (not tested)
export function startGame() {
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");
  const scoreElement = document.getElementById("score");

  let snake = createInitialSnake();
  let direction = { dx: 1, dy: 0 }; // Start moving right
  let nextDirection = { dx: 1, dy: 0 };
  let food = spawnFood(GRID_SIZE, snake);
  let score = 0;
  let gameRunning = false;
  let animationId = null;
  let lastMoveTime = 0;
  const moveInterval = 150; // milliseconds between moves

  // Draw the grid and snake
  function draw() {
    // Clear canvas
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid lines (subtle)
    ctx.strokeStyle = "#222";
    ctx.lineWidth = 1;
    for (let i = 0; i <= GRID_SIZE; i++) {
      // Vertical lines
      ctx.beginPath();
      ctx.moveTo(i * CELL_SIZE, 0);
      ctx.lineTo(i * CELL_SIZE, canvas.height);
      ctx.stroke();

      // Horizontal lines
      ctx.beginPath();
      ctx.moveTo(0, i * CELL_SIZE);
      ctx.lineTo(canvas.width, i * CELL_SIZE);
      ctx.stroke();
    }

    // Draw food (red)
    ctx.fillStyle = "#f00";
    ctx.fillRect(
      food.x * CELL_SIZE + 1,
      food.y * CELL_SIZE + 1,
      CELL_SIZE - 2,
      CELL_SIZE - 2,
    );

    // Draw snake
    snake.forEach((segment, index) => {
      // Head is brighter green
      if (index === 0) {
        ctx.fillStyle = "#0f0"; // Bright green for head
      } else {
        ctx.fillStyle = "#0a0"; // Darker green for body
      }

      ctx.fillRect(
        segment.x * CELL_SIZE + 1,
        segment.y * CELL_SIZE + 1,
        CELL_SIZE - 2,
        CELL_SIZE - 2,
      );
    });
  }

  // Game loop
  function gameLoop(timestamp) {
    if (!gameRunning) return;

    // Check if enough time has passed since last move
    if (timestamp - lastMoveTime >= moveInterval) {
      // Update direction from queued input
      direction = getNewDirection(direction, nextDirection);

      // Move snake
      snake = moveSnake(snake, direction);

      const head = snake[0];

      // Check for wall collision
      if (checkWallCollision(head, GRID_SIZE)) {
        gameRunning = false;
        handleGameOver();
        return;
      }

      // Check for self collision
      if (checkSelfCollision(snake)) {
        gameRunning = false;
        handleGameOver();
        return;
      }

      // Check for food collision
      if (checkFoodCollision(head, food)) {
        // Grow snake by adding the tail segment back
        const tail = snake[snake.length - 1];
        snake = [...snake, tail];

        // Increase score
        score += 10;
        scoreElement.textContent = score;

        // Spawn new food
        food = spawnFood(GRID_SIZE, snake);
      }

      // Redraw
      draw();

      lastMoveTime = timestamp;
    }

    animationId = requestAnimationFrame(gameLoop);
  }

  // Handle game over
  function handleGameOver() {
    const gameOverElement = document.getElementById("gameOver");
    const finalScoreElement = document.getElementById("finalScore");

    finalScoreElement.textContent = score;
    gameOverElement.style.display = "block";

    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
  }

  // Restart game
  function restartGame() {
    snake = createInitialSnake();
    direction = { dx: 1, dy: 0 };
    nextDirection = { dx: 1, dy: 0 };
    food = spawnFood(GRID_SIZE, snake);
    score = 0;
    scoreElement.textContent = score;
    gameRunning = true;
    lastMoveTime = performance.now();

    const gameOverElement = document.getElementById("gameOver");
    gameOverElement.style.display = "none";

    draw();
    animationId = requestAnimationFrame(gameLoop);
  }

  // Handle keyboard input
  function handleKeyPress(event) {
    // Start game on space
    if (event.code === "Space" && !gameRunning) {
      gameRunning = true;
      lastMoveTime = performance.now();
      animationId = requestAnimationFrame(gameLoop);
      return;
    }

    // Handle arrow keys for direction
    switch (event.key) {
      case "ArrowUp":
        nextDirection = { dx: 0, dy: -1 };
        event.preventDefault();
        break;
      case "ArrowDown":
        nextDirection = { dx: 0, dy: 1 };
        event.preventDefault();
        break;
      case "ArrowLeft":
        nextDirection = { dx: -1, dy: 0 };
        event.preventDefault();
        break;
      case "ArrowRight":
        nextDirection = { dx: 1, dy: 0 };
        event.preventDefault();
        break;
    }
  }

  // Set up event listeners
  document.addEventListener("keydown", handleKeyPress);

  const restartButton = document.getElementById("restartBtn");
  if (restartButton) {
    restartButton.addEventListener("click", restartGame);
  }

  // Initial draw
  draw();
}

// Auto-start the game when the DOM is ready
if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startGame);
  } else {
    startGame();
  }
}
