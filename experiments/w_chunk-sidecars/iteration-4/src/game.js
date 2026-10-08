export const GRID_SIZE = 20;
export const CELL_SIZE = 20;
export const TICK_MS = 150;

export const DIRECTIONS = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};

const OPPOSITES = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
};

export function createInitialSnake() {
  return [
    { x: 10, y: 10 },
    { x: 9, y: 10 },
    { x: 8, y: 10 },
  ];
}

export function moveSnake(snake, direction) {
  const vec = DIRECTIONS[direction];
  const head = snake[0];
  const newHead = { x: head.x + vec.dx, y: head.y + vec.dy };
  const body = snake.slice(0, -1).map((seg) => ({ x: seg.x, y: seg.y }));
  return [newHead, ...body];
}

export function checkWallCollision(head, gridSize) {
  return head.x < 0 || head.x >= gridSize || head.y < 0 || head.y >= gridSize;
}

export function checkSelfCollision(snake) {
  const [head, ...body] = snake;
  return body.some((seg) => seg.x === head.x && seg.y === head.y);
}

export function isGameOver(snake, gridSize) {
  if (!snake || snake.length === 0) return false;
  return checkWallCollision(snake[0], gridSize) || checkSelfCollision(snake);
}

export function getNewDirection(current, input) {
  if (!Object.prototype.hasOwnProperty.call(DIRECTIONS, input)) {
    return current;
  }
  if (OPPOSITES[current] === input) {
    return current;
  }
  return input;
}

export function checkFoodCollision(head, food) {
  if (!food) return false;
  return head.x === food.x && head.y === food.y;
}

export function spawnFood(gridSize, snake, random) {
  const occupied = new Set(snake.map((s) => `${s.x},${s.y}`));
  const maxAttempts = gridSize * gridSize;
  for (let i = 0; i < maxAttempts; i++) {
    const x = Math.floor(random() * gridSize);
    const y = Math.floor(random() * gridSize);
    const key = `${x},${y}`;
    if (!occupied.has(key)) {
      return { x, y };
    }
  }
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      if (!occupied.has(`${x},${y}`)) {
        return { x, y };
      }
    }
  }
  return null;
}

export function drawSnake(ctx, snake, cellSize) {
  ctx.fillStyle = "#39ff14";
  for (const segment of snake) {
    ctx.fillRect(
      segment.x * cellSize,
      segment.y * cellSize,
      cellSize - 1,
      cellSize - 1,
    );
  }
}

export function drawFood(ctx, food, cellSize) {
  if (!food) return;
  ctx.fillStyle = "#ff3b6b";
  ctx.fillRect(
    food.x * cellSize,
    food.y * cellSize,
    cellSize - 1,
    cellSize - 1,
  );
}

export function clearCanvas(ctx, width, height) {
  ctx.fillStyle = "#0b1020";
  ctx.fillRect(0, 0, width, height);
}

export function createInitialState(random = Math.random) {
  const snake = createInitialSnake();
  return {
    snake,
    direction: "right",
    pendingDirection: "right",
    food: spawnFood(GRID_SIZE, snake, random),
    score: 0,
    status: "idle",
  };
}

export function startGame(doc) {
  const canvas = doc.getElementById("game-canvas");
  if (!canvas || typeof canvas.getContext !== "function") return null;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const scoreEl = doc.getElementById("score");
  const gameOverEl = doc.getElementById("game-over");
  const finalScoreEl = doc.getElementById("final-score");
  const startOverlayEl = doc.getElementById("start-overlay");
  const restartButtonEl = doc.getElementById("restart-button");

  let state = createInitialState();
  let intervalId = null;

  function renderScore() {
    if (scoreEl) scoreEl.textContent = String(state.score);
  }

  function render() {
    clearCanvas(ctx, canvas.width, canvas.height);
    drawFood(ctx, state.food, CELL_SIZE);
    drawSnake(ctx, state.snake, CELL_SIZE);
  }

  function showStartOverlay() {
    if (!startOverlayEl) return;
    startOverlayEl.classList.remove("hidden");
    startOverlayEl.setAttribute("aria-hidden", "false");
  }

  function hideStartOverlay() {
    if (!startOverlayEl) return;
    startOverlayEl.classList.add("hidden");
    startOverlayEl.setAttribute("aria-hidden", "true");
  }

  function showGameOverOverlay() {
    if (finalScoreEl) finalScoreEl.textContent = String(state.score);
    if (gameOverEl) {
      gameOverEl.classList.remove("hidden");
      gameOverEl.setAttribute("aria-hidden", "false");
    }
  }

  function hideGameOverOverlay() {
    if (!gameOverEl) return;
    gameOverEl.classList.add("hidden");
    gameOverEl.setAttribute("aria-hidden", "true");
  }

  function startLoop() {
    if (intervalId === null) {
      intervalId = setInterval(tick, TICK_MS);
    }
  }

  function stopLoop() {
    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  }

  function beginPlay() {
    state.status = "running";
    hideStartOverlay();
    hideGameOverOverlay();
    startLoop();
  }

  function resetAndPlay() {
    stopLoop();
    state = createInitialState();
    renderScore();
    render();
    beginPlay();
  }

  function endGame() {
    if (state.status === "over") return;
    state.status = "over";
    stopLoop();
    showGameOverOverlay();
  }

  function tick() {
    if (state.status !== "running") return;
    state.direction = getNewDirection(state.direction, state.pendingDirection);
    const head = state.snake[0];
    const vec = DIRECTIONS[state.direction];
    const newHead = { x: head.x + vec.dx, y: head.y + vec.dy };

    if (checkWallCollision(newHead, GRID_SIZE)) {
      endGame();
      return;
    }

    if (checkFoodCollision(newHead, state.food)) {
      state.snake = [
        newHead,
        ...state.snake.map((seg) => ({ x: seg.x, y: seg.y })),
      ];
      state.score += 1;
      state.food = spawnFood(GRID_SIZE, state.snake, Math.random);
      renderScore();
    } else {
      state.snake = moveSnake(state.snake, state.direction);
    }

    if (checkSelfCollision(state.snake)) {
      render();
      endGame();
      return;
    }

    render();
  }

  const keyMap = {
    ArrowUp: "up",
    ArrowDown: "down",
    ArrowLeft: "left",
    ArrowRight: "right",
  };

  function onKeyDown(event) {
    if (event.key === " " || event.key === "Spacebar") {
      if (state.status === "idle") {
        beginPlay();
      } else if (state.status === "over") {
        resetAndPlay();
      }
      event.preventDefault();
      return;
    }
    const dir = keyMap[event.key];
    if (!dir) return;
    if (state.status !== "running") return;
    state.pendingDirection = getNewDirection(state.direction, dir);
    event.preventDefault();
  }

  function onRestartClick() {
    resetAndPlay();
  }

  doc.addEventListener("keydown", onKeyDown);
  if (restartButtonEl) {
    restartButtonEl.addEventListener("click", onRestartClick);
  }

  renderScore();
  render();
  showStartOverlay();

  return {
    stop() {
      stopLoop();
      doc.removeEventListener("keydown", onKeyDown);
      if (restartButtonEl) {
        restartButtonEl.removeEventListener("click", onRestartClick);
      }
    },
    getState() {
      return state;
    },
  };
}

if (typeof document !== "undefined") {
  startGame(document);
}
