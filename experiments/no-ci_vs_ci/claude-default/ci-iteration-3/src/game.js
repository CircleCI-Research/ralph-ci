/**
 * Game configuration constants
 */
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
    { x: centerX, y: centerY }, // head
    { x: centerX - 1, y: centerY }, // body
    { x: centerX - 2, y: centerY }, // tail
  ];
}

/**
 * Placeholder functions to be implemented in future tasks
 */
export function moveSnake(snake, direction) {
  const head = snake[0];
  let newHead;

  // Calculate new head position based on direction
  switch (direction) {
    case "right":
      newHead = { x: head.x + 1, y: head.y };
      break;
    case "left":
      newHead = { x: head.x - 1, y: head.y };
      break;
    case "up":
      newHead = { x: head.x, y: head.y - 1 };
      break;
    case "down":
      newHead = { x: head.x, y: head.y + 1 };
      break;
    default:
      newHead = { x: head.x, y: head.y };
  }

  // Create new snake with new head and remove tail
  const newSnake = [newHead, ...snake.slice(0, -1)];
  return newSnake;
}

export function checkWallCollision(head, gridSize) {
  return head.x < 0 || head.x >= gridSize || head.y < 0 || head.y >= gridSize;
}

export function checkSelfCollision(snake) {
  const head = snake[0];
  // Check if head collides with any body segment (skip the head itself)
  for (let i = 1; i < snake.length; i++) {
    if (head.x === snake[i].x && head.y === snake[i].y) {
      return true;
    }
  }
  return false;
}

export function checkFoodCollision(head, food) {
  return head.x === food.x && head.y === food.y;
}

export function spawnFood(gridSize, snake, random = Math.random) {
  let food;
  let attempts = 0;
  const maxAttempts = 1000;

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

export function getNewDirection(current, input) {
  // Prevent 180-degree turns
  const opposites = {
    right: "left",
    left: "right",
    up: "down",
    down: "up",
  };

  // If trying to go in opposite direction, keep current direction
  if (opposites[current] === input) {
    return current;
  }

  return input;
}

/**
 * Game rendering and control (DOM/Canvas - not unit tested)
 */

// Only run game code if we're in a browser environment
if (typeof document !== "undefined") {
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");

  let snake = createInitialSnake();
  let direction = "right";
  let nextDirection = "right";
  let gameRunning = false;
  let gameLoopId = null;
  let food = spawnFood(GRID_SIZE, snake);
  let score = 0;

  // Draw a single cell
  function drawCell(x, y, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
  }

  // Draw the snake
  function drawSnake() {
    snake.forEach((segment, index) => {
      // Head is brighter green, body is darker
      const color = index === 0 ? "#00ff00" : "#00cc00";
      drawCell(segment.x, segment.y, color);
    });
  }

  // Draw food
  function drawFood() {
    drawCell(food.x, food.y, "#ff0000");
  }

  // Update score display
  function updateScore() {
    const scoreElement = document.getElementById("score");
    if (scoreElement) {
      scoreElement.textContent = score;
    }
  }

  // Clear the canvas
  function clearCanvas() {
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // Game loop
  function gameLoop() {
    if (!gameRunning) return;

    // Update direction (use queued direction)
    direction = getNewDirection(direction, nextDirection);

    // Move snake
    const head = snake[0];
    const nextHead = {
      x: head.x + (direction === "right" ? 1 : direction === "left" ? -1 : 0),
      y: head.y + (direction === "down" ? 1 : direction === "up" ? -1 : 0),
    };

    // Check if snake will eat food
    const willEatFood = checkFoodCollision(nextHead, food);

    // Move snake (grow if eating food)
    if (willEatFood) {
      // Add new head without removing tail (snake grows)
      snake = [nextHead, ...snake];
      score += 10;
      updateScore();
      // Spawn new food
      food = spawnFood(GRID_SIZE, snake);
    } else {
      // Normal move
      snake = moveSnake(snake, direction);
    }

    // Check collisions
    const newHead = snake[0];
    if (checkWallCollision(newHead, GRID_SIZE) || checkSelfCollision(snake)) {
      gameRunning = false;
      showGameOver();
      return;
    }

    // Render
    clearCanvas();
    drawSnake();
    drawFood();

    // Continue game loop
    gameLoopId = setTimeout(gameLoop, 150);
  }

  // Show game over overlay
  function showGameOver() {
    const overlay = document.getElementById("gameOverOverlay");
    const finalScoreElement = document.getElementById("finalScore");
    if (finalScoreElement) {
      finalScoreElement.textContent = score;
    }
    overlay.classList.remove("hidden");
  }

  // Start the game
  function startGame() {
    snake = createInitialSnake();
    direction = "right";
    nextDirection = "right";
    gameRunning = true;
    food = spawnFood(GRID_SIZE, snake);
    score = 0;
    updateScore();

    const overlay = document.getElementById("gameOverOverlay");
    overlay.classList.add("hidden");

    clearCanvas();
    drawSnake();
    drawFood();
    gameLoop();
  }

  // Keyboard controls
  document.addEventListener("keydown", (e) => {
    // Start game with space bar
    if (e.key === " " && !gameRunning) {
      e.preventDefault();
      startGame();
      return;
    }

    // Arrow key controls
    if (!gameRunning) return;

    switch (e.key) {
      case "ArrowUp":
        e.preventDefault();
        nextDirection = "up";
        break;
      case "ArrowDown":
        e.preventDefault();
        nextDirection = "down";
        break;
      case "ArrowLeft":
        e.preventDefault();
        nextDirection = "left";
        break;
      case "ArrowRight":
        e.preventDefault();
        nextDirection = "right";
        break;
    }
  });

  // Restart button
  const restartButton = document.getElementById("restartButton");
  if (restartButton) {
    restartButton.addEventListener("click", () => {
      startGame();
    });
  }

  // Initial render
  clearCanvas();
  drawSnake();
  drawFood();
  updateScore();
}
