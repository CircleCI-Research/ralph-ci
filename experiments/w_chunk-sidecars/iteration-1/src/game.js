// Classic Snake Game - Core Logic Module
// Pure functions exported for testing; DOM/canvas wiring lives in startGame().

export const GRID_SIZE = 20;
export const CELL_SIZE = 20;
export const TICK_MS = 150;

export function createInitialSnake() {
  return [
    { x: 10, y: 10 },
    { x: 9, y: 10 },
    { x: 8, y: 10 },
  ];
}

const DIRECTION_DELTAS = {
  right: { x: 1, y: 0 },
  left: { x: -1, y: 0 },
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
};

const OPPOSITES = {
  right: "left",
  left: "right",
  up: "down",
  down: "up",
};

export function moveSnake(snake, direction) {
  const delta = DIRECTION_DELTAS[direction];
  if (!delta) {
    return snake.map((s) => ({ ...s }));
  }
  const head = snake[0];
  const newHead = { x: head.x + delta.x, y: head.y + delta.y };
  const next = [newHead];
  for (let i = 0; i < snake.length - 1; i++) {
    next.push({ x: snake[i].x, y: snake[i].y });
  }
  return next;
}

export function checkWallCollision(head, gridSize) {
  return head.x < 0 || head.x >= gridSize || head.y < 0 || head.y >= gridSize;
}

export function checkSelfCollision(snake) {
  if (snake.length < 2) return false;
  const head = snake[0];
  for (let i = 1; i < snake.length; i++) {
    if (snake[i].x === head.x && snake[i].y === head.y) return true;
  }
  return false;
}

export function getNewDirection(current, input) {
  if (!DIRECTION_DELTAS[input]) return current;
  if (OPPOSITES[current] === input) return current;
  return input;
}

export function checkFoodCollision(head, food) {
  return head.x === food.x && head.y === food.y;
}

export function isGameOver(snake, gridSize) {
  if (!snake || snake.length === 0) return false;
  const head = snake[0];
  return checkWallCollision(head, gridSize) || checkSelfCollision(snake);
}

export function spawnFood(gridSize, snake, random) {
  // Bail-out cap (Rule 2): an exhausted grid must terminate the retry loop.
  const maxAttempts = gridSize * gridSize;
  let food = {
    x: Math.floor(random() * gridSize),
    y: Math.floor(random() * gridSize),
  };
  let attempts = 1;
  while (
    snake.some((s) => s.x === food.x && s.y === food.y) &&
    attempts < maxAttempts
  ) {
    food = {
      x: Math.floor(random() * gridSize),
      y: Math.floor(random() * gridSize),
    };
    attempts++;
  }
  return food;
}

function drawBoard(ctx, snake, food) {
  ctx.fillStyle = "#0d0f12";
  ctx.fillRect(0, 0, GRID_SIZE * CELL_SIZE, GRID_SIZE * CELL_SIZE);
  ctx.fillStyle = "#ff3860";
  ctx.fillRect(
    food.x * CELL_SIZE + 1,
    food.y * CELL_SIZE + 1,
    CELL_SIZE - 2,
    CELL_SIZE - 2,
  );
  ctx.fillStyle = "#39ff14";
  for (let i = 0; i < snake.length; i++) {
    const seg = snake[i];
    ctx.fillRect(
      seg.x * CELL_SIZE + 1,
      seg.y * CELL_SIZE + 1,
      CELL_SIZE - 2,
      CELL_SIZE - 2,
    );
  }
}

const KEY_TO_DIRECTION = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
};

export function startGame(doc) {
  const canvas = doc.getElementById("gameCanvas");
  if (!canvas || typeof canvas.getContext !== "function") return null;
  const ctx = canvas.getContext("2d");
  const scoreEl = doc.getElementById("score");
  const gameOverEl = doc.getElementById("gameOverOverlay");
  const finalScoreEl = doc.getElementById("finalScore");
  const startOverlayEl = doc.getElementById("startOverlay");
  const restartBtn = doc.getElementById("restartButton");

  let snake = createInitialSnake();
  let direction = "right";
  let queuedDirection = direction;
  let food = spawnFood(GRID_SIZE, snake, Math.random);
  let score = 0;
  let intervalId = null;
  let state = "idle";

  const stopLoop = () => {
    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };

  const resetState = () => {
    snake = createInitialSnake();
    direction = "right";
    queuedDirection = direction;
    score = 0;
    food = spawnFood(GRID_SIZE, snake, Math.random);
    if (scoreEl) scoreEl.textContent = "0";
    drawBoard(ctx, snake, food);
  };

  const endGame = () => {
    stopLoop();
    state = "gameOver";
    if (finalScoreEl) finalScoreEl.textContent = String(score);
    if (gameOverEl) gameOverEl.classList.remove("hidden");
  };

  const beginGame = () => {
    if (state === "playing") return;
    resetState();
    if (startOverlayEl) startOverlayEl.classList.add("hidden");
    if (gameOverEl) gameOverEl.classList.add("hidden");
    state = "playing";
    stopLoop();
    intervalId = setInterval(tick, TICK_MS);
  };

  const tick = () => {
    direction = queuedDirection;
    const next = moveSnake(snake, direction);
    const newHead = next[0];
    if (isGameOver(next, GRID_SIZE)) {
      endGame();
      return;
    }
    if (checkFoodCollision(newHead, food)) {
      // Grow: put the dropped tail back so length increases by one.
      next.push(snake[snake.length - 1]);
      score++;
      if (scoreEl) scoreEl.textContent = String(score);
      food = spawnFood(GRID_SIZE, next, Math.random);
    }
    snake = next;
    drawBoard(ctx, snake, food);
  };

  const onKey = (event) => {
    if (event.key === " " || event.key === "Spacebar") {
      if (state === "idle" || state === "gameOver") {
        if (typeof event.preventDefault === "function") event.preventDefault();
        beginGame();
      }
      return;
    }
    if (state !== "playing") return;
    const requested = KEY_TO_DIRECTION[event.key];
    if (!requested) return;
    queuedDirection = getNewDirection(direction, requested);
  };

  const onRestartClick = () => {
    beginGame();
  };

  drawBoard(ctx, snake, food);
  doc.addEventListener("keydown", onKey);
  if (restartBtn) restartBtn.addEventListener("click", onRestartClick);

  return {
    stop: () => {
      stopLoop();
      doc.removeEventListener("keydown", onKey);
      if (restartBtn) restartBtn.removeEventListener("click", onRestartClick);
    },
  };
}

if (typeof document !== "undefined") {
  startGame(document);
}
