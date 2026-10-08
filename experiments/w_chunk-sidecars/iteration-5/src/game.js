export const GRID_SIZE = 20;

export function createInitialSnake() {
  return [
    { x: 10, y: 10 },
    { x: 9, y: 10 },
    { x: 8, y: 10 },
  ];
}

const DIRECTION_DELTAS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export function moveSnake(snake, direction) {
  const delta = DIRECTION_DELTAS[direction];
  if (!delta) {
    throw new Error(`Unknown direction: ${direction}`);
  }
  const head = snake[0];
  const newHead = { x: head.x + delta.x, y: head.y + delta.y };
  // Keep length constant: new head + all but the last segment.
  return [
    newHead,
    ...snake.slice(0, -1).map((seg) => ({ x: seg.x, y: seg.y })),
  ];
}

export function checkWallCollision(head, gridSize) {
  return head.x < 0 || head.y < 0 || head.x >= gridSize || head.y >= gridSize;
}

export function checkSelfCollision(snake) {
  if (snake.length < 2) return false;
  const head = snake[0];
  for (let i = 1; i < snake.length; i++) {
    if (snake[i].x === head.x && snake[i].y === head.y) {
      return true;
    }
  }
  return false;
}

export function checkFoodCollision(head, food) {
  return head.x === food.x && head.y === food.y;
}

export function spawnFood(gridSize, snake, random) {
  const maxAttempts = gridSize * gridSize;
  for (let i = 0; i < maxAttempts; i++) {
    const x = Math.floor(random() * gridSize);
    const y = Math.floor(random() * gridSize);
    let onSnake = false;
    for (const segment of snake) {
      if (segment.x === x && segment.y === y) {
        onSnake = true;
        break;
      }
    }
    if (!onSnake) return { x, y };
  }
  // Deterministic fallback: snake fills (almost) every cell. Scan the
  // grid for the first free cell so we never return a colliding food
  // and never loop forever.
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      let onSnake = false;
      for (const segment of snake) {
        if (segment.x === x && segment.y === y) {
          onSnake = true;
          break;
        }
      }
      if (!onSnake) return { x, y };
    }
  }
  return null;
}

const OPPOSITE_DIRECTION = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
};

export function getNewDirection(current, input) {
  if (!DIRECTION_DELTAS[input]) return current;
  if (OPPOSITE_DIRECTION[current] === input) return current;
  return input;
}

const ARROW_KEY_TO_DIRECTION = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
};

const TICK_MS = 150;

export function startGame() {
  if (typeof document === "undefined") return null;

  const canvas = document.getElementById("canvas");
  const scoreEl = document.getElementById("score");
  const overlay = document.getElementById("overlay");
  const overlayMessage = document.getElementById("overlay-message");
  const restartBtn = document.getElementById("restart");
  if (!canvas || !canvas.getContext) return null;

  const ctx = canvas.getContext("2d");
  const cellSize = canvas.width / GRID_SIZE;

  let snake = createInitialSnake();
  let direction = "right";
  let pendingDirection = direction;
  let food = spawnFood(GRID_SIZE, snake, Math.random);
  let score = 0;
  let intervalId = null;
  let running = false;

  function renderScore() {
    if (scoreEl) scoreEl.textContent = `Score: ${score}`;
  }

  function draw() {
    ctx.fillStyle = "#050807";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (food) {
      ctx.fillStyle = "#ef4444";
      ctx.fillRect(
        food.x * cellSize,
        food.y * cellSize,
        cellSize - 1,
        cellSize - 1,
      );
    }
    ctx.fillStyle = "#2dd4bf";
    for (const segment of snake) {
      ctx.fillRect(
        segment.x * cellSize,
        segment.y * cellSize,
        cellSize - 1,
        cellSize - 1,
      );
    }
  }

  function tick() {
    direction = pendingDirection;
    const head = snake[0];
    const delta = DIRECTION_DELTAS[direction];
    const newHead = { x: head.x + delta.x, y: head.y + delta.y };
    if (checkWallCollision(newHead, GRID_SIZE)) {
      gameOver();
      return;
    }
    const ateFood = food !== null && checkFoodCollision(newHead, food);
    const newSnake = ateFood
      ? [newHead, ...snake.map((seg) => ({ x: seg.x, y: seg.y }))]
      : moveSnake(snake, direction);
    if (checkSelfCollision(newSnake)) {
      gameOver();
      return;
    }
    snake = newSnake;
    if (ateFood) {
      score += 1;
      renderScore();
      food = spawnFood(GRID_SIZE, snake, Math.random);
    }
    draw();
  }

  function gameOver() {
    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
    running = false;
    if (overlay && overlayMessage) {
      overlayMessage.textContent = `Game Over — Score: ${score}`;
      overlay.hidden = false;
    }
    if (restartBtn) restartBtn.hidden = false;
  }

  function start() {
    if (running) return;
    running = true;
    if (overlay) overlay.hidden = true;
    if (restartBtn) {
      // Blur first: if the user just clicked Restart, the button keeps
      // focus, and a later SPACE press would re-fire its click handler.
      restartBtn.blur();
      restartBtn.hidden = true;
    }
    renderScore();
    intervalId = setInterval(tick, TICK_MS);
  }

  function reset() {
    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
    snake = createInitialSnake();
    direction = "right";
    pendingDirection = direction;
    food = spawnFood(GRID_SIZE, snake, Math.random);
    score = 0;
    renderScore();
    draw();
    start();
  }

  function handleKeydown(event) {
    if (event.key === " " || event.code === "Space") {
      if (!running) reset();
      return;
    }
    const requested = ARROW_KEY_TO_DIRECTION[event.key];
    if (!requested) return;
    if (!running) {
      reset();
    }
    pendingDirection = getNewDirection(direction, requested);
  }

  function handleRestartClick() {
    reset();
  }

  document.addEventListener("keydown", handleKeydown);
  if (restartBtn) restartBtn.addEventListener("click", handleRestartClick);
  if (overlay && overlayMessage) {
    overlay.hidden = false;
    overlayMessage.textContent = "Press SPACE to start";
  }
  if (restartBtn) restartBtn.hidden = true;
  draw();

  return {
    stop() {
      if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
      }
      running = false;
      document.removeEventListener("keydown", handleKeydown);
      if (restartBtn)
        restartBtn.removeEventListener("click", handleRestartClick);
    },
  };
}

if (typeof document !== "undefined") {
  startGame();
}
