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

function nextHead(head, direction) {
  switch (direction) {
    case "up":
      return { x: head.x, y: head.y - 1 };
    case "down":
      return { x: head.x, y: head.y + 1 };
    case "left":
      return { x: head.x - 1, y: head.y };
    case "right":
      return { x: head.x + 1, y: head.y };
    default:
      throw new Error(`Unknown direction: ${direction}`);
  }
}

export function moveSnake(snake, direction) {
  return [nextHead(snake[0], direction), ...snake.slice(0, -1)];
}

export function growSnake(snake, direction) {
  return [nextHead(snake[0], direction), ...snake];
}

export function checkWallCollision(head, gridSize) {
  return head.x < 0 || head.x >= gridSize || head.y < 0 || head.y >= gridSize;
}

export function checkSelfCollision(snake) {
  const [head, ...body] = snake;
  return body.some((seg) => seg.x === head.x && seg.y === head.y);
}

export function checkFoodCollision(head, food) {
  return head.x === food.x && head.y === food.y;
}

export function spawnFood(gridSize, snake, random) {
  const occupied = new Set(snake.map((s) => `${s.x},${s.y}`));
  const maxAttempts = gridSize * gridSize;
  for (let i = 0; i < maxAttempts; i++) {
    const x = Math.floor(random() * gridSize);
    const y = Math.floor(random() * gridSize);
    if (!occupied.has(`${x},${y}`)) {
      return { x, y };
    }
  }
  throw new Error("spawnFood: no free cell available");
}

const OPPOSITES = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
};

export function getNewDirection(current, input) {
  if (OPPOSITES[current] === input) return current;
  return input;
}

const KEY_TO_DIRECTION = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
};

export function createInitialState(gridSize, random) {
  const snake = createInitialSnake();
  return {
    snake,
    food: spawnFood(gridSize, snake, random),
    score: 0,
    gameOver: false,
  };
}

export function tickGameState(state, direction, gridSize, random) {
  if (state.gameOver) return state;
  const moved = moveSnake(state.snake, direction);
  const newHead = moved[0];
  if (checkWallCollision(newHead, gridSize) || checkSelfCollision(moved)) {
    return { ...state, gameOver: true };
  }
  if (checkFoodCollision(newHead, state.food)) {
    const grown = growSnake(state.snake, direction);
    return {
      ...state,
      snake: grown,
      food: spawnFood(gridSize, grown, random),
      score: state.score + 1,
    };
  }
  return { ...state, snake: moved };
}

export function drawSnake(ctx, snake, cellSize) {
  ctx.fillStyle = "#00ff41";
  for (const seg of snake) {
    ctx.fillRect(
      seg.x * cellSize + 1,
      seg.y * cellSize + 1,
      cellSize - 2,
      cellSize - 2,
    );
  }
}

export function drawFood(ctx, food, cellSize) {
  ctx.fillStyle = "#ff0040";
  ctx.fillRect(
    food.x * cellSize + 1,
    food.y * cellSize + 1,
    cellSize - 2,
    cellSize - 2,
  );
}

export function clearCanvas(ctx, width, height) {
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, width, height);
}

export function startGame(canvas) {
  const ctx = canvas.getContext("2d");
  let state = createInitialState(GRID_SIZE, Math.random);
  let currentDirection = "right";
  let pendingDirection = currentDirection;
  let loopId = null;
  let phase = "idle";

  const doc = typeof document !== "undefined" ? document : null;
  const scoreEl = doc ? doc.getElementById("score") : null;
  const gameOverEl = doc ? doc.getElementById("game-over") : null;
  const finalScoreEl = doc ? doc.getElementById("final-score") : null;
  const startMessageEl = doc ? doc.getElementById("start-message") : null;
  const restartBtn = doc ? doc.getElementById("restart-btn") : null;

  function render() {
    clearCanvas(ctx, canvas.width, canvas.height);
    drawFood(ctx, state.food, CELL_SIZE);
    drawSnake(ctx, state.snake, CELL_SIZE);
  }

  function updateScore() {
    if (scoreEl) scoreEl.textContent = String(state.score);
  }

  function show(el) {
    if (el) el.classList.remove("hidden");
  }

  function hide(el) {
    if (el) el.classList.add("hidden");
  }

  function stopLoop() {
    if (loopId !== null) {
      clearInterval(loopId);
      loopId = null;
    }
  }

  function tick() {
    currentDirection = pendingDirection;
    state = tickGameState(state, currentDirection, GRID_SIZE, Math.random);
    render();
    updateScore();
    if (state.gameOver) {
      stopLoop();
      phase = "gameOver";
      if (finalScoreEl) finalScoreEl.textContent = String(state.score);
      show(gameOverEl);
    }
  }

  function startRunning() {
    phase = "running";
    hide(startMessageEl);
    hide(gameOverEl);
    if (loopId === null) loopId = setInterval(tick, TICK_MS);
  }

  function restart() {
    state = createInitialState(GRID_SIZE, Math.random);
    currentDirection = "right";
    pendingDirection = currentDirection;
    render();
    updateScore();
    startRunning();
  }

  function handleKey(event) {
    if (event.key === " " || event.code === "Space") {
      event.preventDefault();
      if (phase === "idle") startRunning();
      else if (phase === "gameOver") restart();
      return;
    }
    if (phase !== "running") return;
    const dir = KEY_TO_DIRECTION[event.key];
    if (!dir) return;
    event.preventDefault();
    pendingDirection = getNewDirection(currentDirection, dir);
  }

  function handleRestartClick() {
    if (phase === "gameOver") restart();
  }

  function stop() {
    stopLoop();
    if (typeof window !== "undefined") {
      window.removeEventListener("keydown", handleKey);
    }
    if (restartBtn) restartBtn.removeEventListener("click", handleRestartClick);
  }

  render();
  updateScore();
  show(startMessageEl);
  hide(gameOverEl);
  if (typeof window !== "undefined") {
    window.addEventListener("keydown", handleKey);
  }
  if (restartBtn) restartBtn.addEventListener("click", handleRestartClick);

  return { stop };
}

if (typeof document !== "undefined") {
  const canvas = document.getElementById("game-canvas");
  if (canvas instanceof HTMLCanvasElement) {
    startGame(canvas);
  }
}
