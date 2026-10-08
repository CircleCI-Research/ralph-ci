/**
 * Classic Snake Game - Core Logic Module
 * Pure functions exported for testing; DOM glue (startGame) is guarded.
 */

export const GRID_SIZE = 20;
const CELL_SIZE = 20; // canvas is 400x400 = 20 * 20
const TICK_MS = 150;
export const POINTS_PER_FOOD = 1;

const OPPOSITES = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
};

const VALID_DIRECTIONS = ["up", "down", "left", "right"];

/**
 * Creates the initial snake at the center of a 20x20 grid.
 * The snake starts as 3 segments in a horizontal line, head facing right.
 * @returns {Array<{x: number, y: number}>} Array of snake segments (head first).
 */
export function createInitialSnake() {
  return [
    { x: 10, y: 10 },
    { x: 9, y: 10 },
    { x: 8, y: 10 },
  ];
}

/**
 * Moves the snake one cell in the given direction.
 * When `grow` is false (default) the tail is dropped, preserving length.
 * When `grow` is true the tail is preserved, extending length by 1.
 * @param {Array<{x: number, y: number}>} snake
 * @param {"up"|"down"|"left"|"right"} direction
 * @param {boolean} [grow]
 * @returns {Array<{x: number, y: number}>}
 */
export function moveSnake(snake, direction, grow = false) {
  const head = snake[0];
  const newHead = { x: head.x, y: head.y };
  switch (direction) {
    case "up":
      newHead.y -= 1;
      break;
    case "down":
      newHead.y += 1;
      break;
    case "left":
      newHead.x -= 1;
      break;
    case "right":
      newHead.x += 1;
      break;
    default:
      throw new Error(`Unknown direction: ${direction}`);
  }
  const remaining = grow ? snake : snake.slice(0, -1);
  return [newHead, ...remaining.map((seg) => ({ x: seg.x, y: seg.y }))];
}

/**
 * Returns true when the head is outside the [0, gridSize) bounds.
 * @param {{x: number, y: number}} head
 * @param {number} gridSize
 * @returns {boolean}
 */
export function checkWallCollision(head, gridSize) {
  return head.x < 0 || head.x >= gridSize || head.y < 0 || head.y >= gridSize;
}

/**
 * Returns true when the snake's head occupies the same cell as any body segment.
 * @param {Array<{x: number, y: number}>} snake
 * @returns {boolean}
 */
export function checkSelfCollision(snake) {
  if (snake.length < 2) return false;
  const head = snake[0];
  for (let i = 1; i < snake.length; i += 1) {
    if (snake[i].x === head.x && snake[i].y === head.y) return true;
  }
  return false;
}

/**
 * Resolves the next direction given the current direction and an input direction.
 * Rejects 180-degree turns (e.g. moving right then pressing left) by keeping
 * the current direction. Unknown inputs are ignored.
 * @param {"up"|"down"|"left"|"right"} current
 * @param {string} input
 * @returns {"up"|"down"|"left"|"right"}
 */
export function getNewDirection(current, input) {
  if (!VALID_DIRECTIONS.includes(input)) return current;
  if (input === OPPOSITES[current]) return current;
  return input;
}

/**
 * Returns true when the head occupies the same cell as the food.
 * Null food (e.g. when the grid is fully occupied) never collides.
 * @param {{x: number, y: number}} head
 * @param {{x: number, y: number} | null} food
 * @returns {boolean}
 */
export function checkFoodCollision(head, food) {
  if (!food) return false;
  return head.x === food.x && head.y === food.y;
}

/**
 * Returns true when the snake state represents a game-over condition:
 * either the head is outside the grid, or the head shares a cell with a
 * body segment. The head is checked against `gridSize` first so this is
 * safe to call with an out-of-bounds head (checkSelfCollision wouldn't be).
 * @param {Array<{x: number, y: number}>} snake
 * @param {number} gridSize
 * @returns {boolean}
 */
export function isGameOver(snake, gridSize) {
  if (checkWallCollision(snake[0], gridSize)) return true;
  return checkSelfCollision(snake);
}

/**
 * Spawns a food cell at a random grid position not occupied by the snake.
 * Uses a bounded retry loop (maxAttempts = gridSize * gridSize) so a
 * degenerate `random` function or a near-full grid cannot infinite-loop.
 * Returns null when no free cell could be found within the attempt budget
 * (effectively only when the grid is full).
 * @param {number} gridSize
 * @param {Array<{x: number, y: number}>} snake
 * @param {() => number} random
 * @returns {{x: number, y: number} | null}
 */
export function spawnFood(gridSize, snake, random) {
  const maxAttempts = gridSize * gridSize;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const x = Math.floor(random() * gridSize);
    const y = Math.floor(random() * gridSize);
    const onSnake = snake.some((s) => s.x === x && s.y === y);
    if (!onSnake) return { x, y };
  }
  return null;
}

function drawBoard(ctx, snake, food) {
  const size = GRID_SIZE * CELL_SIZE;
  ctx.fillStyle = "#050505";
  ctx.fillRect(0, 0, size, size);

  if (food) {
    ctx.fillStyle = "#ef4444";
    ctx.fillRect(
      food.x * CELL_SIZE,
      food.y * CELL_SIZE,
      CELL_SIZE - 1,
      CELL_SIZE - 1,
    );
  }

  ctx.fillStyle = "#4ade80";
  for (const segment of snake) {
    ctx.fillRect(
      segment.x * CELL_SIZE,
      segment.y * CELL_SIZE,
      CELL_SIZE - 1,
      CELL_SIZE - 1,
    );
  }
}

const ARROW_KEY_MAP = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
};

/**
 * Builds the fresh per-game state used at start and on restart. Pure: takes
 * the grid size and a random source, returns a snapshot. Kept separate from
 * `startGame` so restart logic and tests use the same factory.
 * @param {number} gridSize
 * @param {() => number} random
 * @returns {{
 *   snake: Array<{x: number, y: number}>,
 *   direction: "up"|"down"|"left"|"right",
 *   score: number,
 *   food: {x: number, y: number} | null,
 * }}
 */
export function createGameState(gridSize, random) {
  const snake = createInitialSnake();
  return {
    snake,
    direction: "right",
    score: 0,
    food: spawnFood(gridSize, snake, random),
  };
}

/**
 * Wires up the canvas, keyboard, and game loop. Browser-only.
 * Supports a SPACE-to-start initial mode and a restart flow (button or SPACE
 * from the game-over overlay).
 * @returns {() => void} A function that tears down listeners and the loop.
 */
export function startGame() {
  const canvas = document.getElementById("gameCanvas");
  if (!canvas) return () => {};
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};

  const startOverlay = document.getElementById("startOverlay");
  const gameOverOverlay = document.getElementById("gameOverOverlay");
  const scoreEl = document.getElementById("score");
  const finalScoreEl = document.getElementById("finalScore");
  const restartButton = document.getElementById("restartButton");

  let snake, direction, pendingDirection, score, food;
  let intervalId = null;
  // "idle" = initial start overlay shown, waiting for SPACE
  // "running" = loop ticking, accepting arrow keys
  // "over" = game-over overlay shown, waiting for restart
  let mode = "idle";

  function resetState() {
    const initial = createGameState(GRID_SIZE, Math.random);
    snake = initial.snake;
    direction = initial.direction;
    pendingDirection = initial.direction;
    score = initial.score;
    food = initial.food;
    if (scoreEl) scoreEl.textContent = String(score);
  }

  function stopLoop() {
    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  }

  function beginRun() {
    resetState();
    if (startOverlay) startOverlay.classList.add("hidden");
    if (gameOverOverlay) gameOverOverlay.classList.add("hidden");
    drawBoard(ctx, snake, food);
    mode = "running";
    stopLoop();
    intervalId = setInterval(tick, TICK_MS);
  }

  function endGame() {
    mode = "over";
    stopLoop();
    if (finalScoreEl) finalScoreEl.textContent = String(score);
    if (gameOverOverlay) gameOverOverlay.classList.remove("hidden");
  }

  function tick() {
    if (mode !== "running") return;
    direction = pendingDirection;
    const provisional = moveSnake(snake, direction);
    const newHead = provisional[0];

    // Wall collision is checked against the provisional head before applying
    // it to the live snake, so we never call checkSelfCollision with an
    // out-of-bounds head.
    if (checkWallCollision(newHead, GRID_SIZE)) {
      endGame();
      return;
    }

    const ate = checkFoodCollision(newHead, food);
    snake = ate ? moveSnake(snake, direction, true) : provisional;

    if (ate) {
      score += POINTS_PER_FOOD;
      if (scoreEl) scoreEl.textContent = String(score);
      food = spawnFood(GRID_SIZE, snake, Math.random);
    }

    if (checkSelfCollision(snake)) {
      endGame();
      return;
    }

    drawBoard(ctx, snake, food);
  }

  function onKeyDown(event) {
    if (event.key === " " || event.code === "Space") {
      if (mode === "idle" || mode === "over") {
        event.preventDefault();
        beginRun();
      }
      return;
    }
    if (mode !== "running") return;
    const mapped = ARROW_KEY_MAP[event.key];
    if (!mapped) return;
    event.preventDefault();
    pendingDirection = getNewDirection(direction, mapped);
  }

  function onRestartClick() {
    beginRun();
  }

  document.addEventListener("keydown", onKeyDown);
  if (restartButton) restartButton.addEventListener("click", onRestartClick);

  // Initial idle state: show start overlay, draw initial board behind it.
  resetState();
  if (startOverlay) startOverlay.classList.remove("hidden");
  if (gameOverOverlay) gameOverOverlay.classList.add("hidden");
  drawBoard(ctx, snake, food);

  return function stop() {
    mode = "over";
    stopLoop();
    document.removeEventListener("keydown", onKeyDown);
    if (restartButton)
      restartButton.removeEventListener("click", onRestartClick);
  };
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      startGame();
    });
  } else {
    startGame();
  }
}
