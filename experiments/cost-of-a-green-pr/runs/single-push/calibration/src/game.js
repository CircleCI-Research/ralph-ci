// Classic Snake Game - Core Logic Module
// Pure functions are exported so they can be unit tested without a browser;
// DOM/canvas wiring lives in startGame(), which only runs in a browser.

/** Board is a GRID_SIZE x GRID_SIZE square of CELL_SIZE pixel cells. */
export const GRID_SIZE = 20;
export const CELL_SIZE = 20;

/** Milliseconds between game ticks. */
export const TICK_MS = 150;

/** Points banked for each piece of food eaten. */
export const POINTS_PER_FOOD = 10;

/**
 * Unit vectors for the four legal headings, keyed by `KeyboardEvent.key` so a
 * keydown handler can look an arrow press up directly.
 *
 * @type {Readonly<Record<string, { x: number, y: number }>>}
 */
export const DIRECTIONS = Object.freeze({
  ArrowUp: Object.freeze({ x: 0, y: -1 }),
  ArrowDown: Object.freeze({ x: 0, y: 1 }),
  ArrowLeft: Object.freeze({ x: -1, y: 0 }),
  ArrowRight: Object.freeze({ x: 1, y: 0 }),
});

/** Colours tuned to the retro palette in style.css. */
export const COLORS = Object.freeze({
  board: "#060a06",
  snakeHead: "#7dff5c",
  snakeBody: "#39ff14",
  // Deliberately outside the green ramp (matches --danger in style.css) so
  // food never reads as a body segment, on screen or to a pixel probe.
  food: "#ff4d4d",
});

/**
 * Build the starting snake: a 3-segment body near the middle of the grid,
 * laid out horizontally with the head on the right so it can move right.
 *
 * @returns {{ x: number, y: number }[]} head-first list of body segments
 */
export function createInitialSnake() {
  const centre = Math.floor(GRID_SIZE / 2);
  return [
    { x: centre, y: centre },
    { x: centre - 1, y: centre },
    { x: centre - 2, y: centre },
  ];
}

/**
 * Move the snake one cell in `direction`: a new head is pushed on the front
 * and the tail segment is dropped, so the length is unchanged. Growth is the
 * caller's job (it re-appends the tail when food was eaten).
 *
 * @param {{ x: number, y: number }[]} snake head-first list of body segments
 * @param {{ x: number, y: number }} direction unit vector of travel
 * @returns {{ x: number, y: number }[]} a new snake array (input is not mutated)
 */
export function moveSnake(snake, direction) {
  const [head] = snake;
  const newHead = { x: head.x + direction.x, y: head.y + direction.y };

  // Copy the segments we keep as well as the array, so nothing the caller
  // still holds can be changed through the snake we hand back.
  return [newHead, ...snake.slice(0, -1).map((segment) => ({ ...segment }))];
}

/**
 * Pick the heading for the next tick. A snake cannot turn back through its own
 * neck, so an input that exactly reverses `current` is ignored; anything else
 * (including a repeat of the current heading) is accepted.
 *
 * @param {{ x: number, y: number }} current heading applied on the last tick
 * @param {{ x: number, y: number } | null | undefined} input requested heading
 * @returns {{ x: number, y: number }} the heading to travel on the next tick
 */
export function getNewDirection(current, input) {
  if (!input) {
    return current;
  }

  const isReversal = input.x === -current.x && input.y === -current.y;
  return isReversal ? current : input;
}

/**
 * Has the head left the board? Cells run 0..gridSize-1 on both axes, so the
 * first cell outside any edge counts as a hit.
 *
 * @param {{ x: number, y: number }} head the snake's head cell
 * @param {number} gridSize width/height of the square board, in cells
 * @returns {boolean} true when the head is outside the grid
 */
export function checkWallCollision(head, gridSize) {
  return head.x < 0 || head.x >= gridSize || head.y < 0 || head.y >= gridSize;
}

/**
 * Has the head run into the snake's own body? Only the segments *behind* the
 * head are considered, so a one-segment snake never collides with itself.
 *
 * @param {{ x: number, y: number }[]} snake head-first list of body segments
 * @returns {boolean} true when the head shares a cell with a body segment
 */
export function checkSelfCollision(snake) {
  const [head, ...body] = snake;
  return body.some((segment) => segment.x === head.x && segment.y === head.y);
}

/**
 * Is the head sitting on the food? A missing food cell (the board filled up
 * and `spawnFood` had nowhere to put one) is never a collision.
 *
 * @param {{ x: number, y: number }} head the snake's head cell
 * @param {{ x: number, y: number } | null | undefined} food the food cell
 * @returns {boolean} true when head and food share a cell
 */
export function checkFoodCollision(head, food) {
  return Boolean(food) && head.x === food.x && head.y === food.y;
}

/**
 * Score after a tick. Eating food banks `POINTS_PER_FOOD`; every other tick
 * leaves the running total alone, so the game loop can pipe *every* tick
 * through here instead of branching around the score.
 *
 * @param {number} score the score before this tick
 * @param {boolean} ateFood did the head land on food this tick?
 * @returns {number} the score to display after this tick
 */
export function getNextScore(score, ateFood) {
  return ateFood ? score + POINTS_PER_FOOD : score;
}

/**
 * Pick a free cell for the next piece of food.
 *
 * Random cells are sampled first so food placement feels unpredictable, but the
 * sampling is capped at `gridSize * gridSize` attempts: as the snake fills the
 * board, random draws collide more and more often, and an uncapped retry loop
 * would spin forever on a full (or nearly full) grid. After the cap we fall
 * back to a deterministic scan for the first free cell, and only return `null`
 * when the snake genuinely covers every cell.
 *
 * @param {number} gridSize width/height of the square board, in cells
 * @param {{ x: number, y: number }[]} snake cells the food must avoid
 * @param {() => number} [random] source of randomness in [0, 1)
 * @returns {{ x: number, y: number } | null} a free cell, or null if none exist
 */
export function spawnFood(gridSize, snake, random = Math.random) {
  const occupied = new Set(snake.map((segment) => `${segment.x},${segment.y}`));
  const maxAttempts = gridSize * gridSize;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const x = Math.floor(random() * gridSize);
    const y = Math.floor(random() * gridSize);

    if (!occupied.has(`${x},${y}`)) {
      return { x, y };
    }
  }

  for (let y = 0; y < gridSize; y += 1) {
    for (let x = 0; x < gridSize; x += 1) {
      if (!occupied.has(`${x},${y}`)) {
        return { x, y };
      }
    }
  }

  return null;
}

/**
 * Everything a fresh run starts from, in one object.
 *
 * Both the first load and the restart button read the board out of here, so
 * "start" and "restart" cannot drift apart: adding a field to a new game means
 * adding it once, and the restart path picks it up for free. Every call builds
 * new objects, so a restart can never alias the dead run's snake.
 *
 * @param {() => number} [random] source of randomness in [0, 1), for the food
 * @returns {{
 *   snake: { x: number, y: number }[],
 *   direction: { x: number, y: number },
 *   queuedDirection: { x: number, y: number },
 *   food: { x: number, y: number } | null,
 *   score: number,
 *   isGameOver: boolean,
 * }} the opening position of a new game
 */
export function createInitialState(random = Math.random) {
  const snake = createInitialSnake();

  return {
    snake,
    direction: DIRECTIONS.ArrowRight,
    queuedDirection: DIRECTIONS.ArrowRight,
    // Spawn against the rebuilt snake, so the new food is never under it.
    food: spawnFood(GRID_SIZE, snake, random),
    score: 0,
    isGameOver: false,
  };
}

/**
 * Repaint the board background, wiping the previous frame.
 *
 * @param {CanvasRenderingContext2D} ctx canvas context to draw into
 * @param {number} gridSize width/height of the square board, in cells
 * @param {number} cellSize pixel size of one cell
 */
export function drawBoard(ctx, gridSize, cellSize) {
  ctx.fillStyle = COLORS.board;
  ctx.fillRect(0, 0, gridSize * cellSize, gridSize * cellSize);
}

/**
 * Draw the snake, one filled square per segment. Squares are inset by a pixel
 * on each side so neighbouring segments read as a chain rather than a bar.
 *
 * @param {CanvasRenderingContext2D} ctx canvas context to draw into
 * @param {{ x: number, y: number }[]} snake head-first list of body segments
 * @param {number} cellSize pixel size of one cell
 */
export function drawSnake(ctx, snake, cellSize) {
  snake.forEach((segment, index) => {
    ctx.fillStyle = index === 0 ? COLORS.snakeHead : COLORS.snakeBody;
    ctx.fillRect(
      segment.x * cellSize + 1,
      segment.y * cellSize + 1,
      cellSize - 2,
      cellSize - 2,
    );
  });
}

/**
 * Draw the food as a filled circle inscribed in its cell. The round shape and
 * the off-ramp colour both keep it distinct from the square snake segments.
 *
 * @param {CanvasRenderingContext2D} ctx canvas context to draw into
 * @param {{ x: number, y: number } | null | undefined} food the food cell
 * @param {number} cellSize pixel size of one cell
 */
export function drawFood(ctx, food, cellSize) {
  if (!food) {
    return;
  }

  const radius = cellSize / 2 - 2;

  ctx.fillStyle = COLORS.food;
  ctx.beginPath();
  ctx.arc(
    food.x * cellSize + cellSize / 2,
    food.y * cellSize + cellSize / 2,
    radius,
    0,
    Math.PI * 2,
  );
  ctx.fill();
}

/**
 * Wire the pure logic above to the canvas, the keyboard and the overlays.
 * Not unit tested — everything it depends on is exercised directly.
 *
 * @returns {void}
 */
export function startGame() {
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");
  const startOverlay = document.getElementById("startOverlay");
  const gameOverOverlay = document.getElementById("gameOverOverlay");
  const scoreDisplay = document.getElementById("score");
  const finalScoreDisplay = document.getElementById("finalScore");
  const restartButton = document.getElementById("restartButton");

  const opening = createInitialState();

  let snake = opening.snake;
  /** Heading used by the last tick. */
  let direction = opening.direction;
  /** Heading the player has asked for, applied on the next tick. */
  let queuedDirection = opening.queuedDirection;
  /** Current food cell, or null once the snake covers the whole board. */
  let food = opening.food;
  /** Running total, POINTS_PER_FOOD per piece of food. */
  let score = opening.score;
  /** Set when the snake dies, so a stray key press cannot resume a dead game. */
  let isGameOver = opening.isGameOver;
  let timerId = null;

  function render() {
    drawBoard(ctx, GRID_SIZE, CELL_SIZE);
    drawFood(ctx, food, CELL_SIZE);
    drawSnake(ctx, snake, CELL_SIZE);
  }

  function stop() {
    if (timerId !== null) {
      clearInterval(timerId);
      timerId = null;
    }
  }

  function showScore() {
    if (scoreDisplay) {
      scoreDisplay.textContent = String(score);
    }
  }

  /**
   * End the run: halt the loop through the single stop() path, then hang the
   * game-over overlay and the final score off it. The last on-board frame is
   * left painted, so the player can see where they died.
   */
  function endGame() {
    stop();
    isGameOver = true;

    if (finalScoreDisplay) {
      finalScoreDisplay.textContent = String(score);
    }

    gameOverOverlay?.classList.remove("hidden");
  }

  function tick() {
    direction = queuedDirection;

    // moveSnake drops the tail, so hold on to it: eating means putting it back.
    const tail = snake[snake.length - 1];
    snake = moveSnake(snake, direction);

    const [head] = snake;

    if (checkWallCollision(head, GRID_SIZE) || checkSelfCollision(snake)) {
      endGame();
      return;
    }

    if (checkFoodCollision(head, food)) {
      // Re-append the tail the move dropped: the snake is one segment longer
      // and the new food avoids every cell of the *grown* body.
      snake = [...snake, { ...tail }];
      food = spawnFood(GRID_SIZE, snake);
      score = getNextScore(score, true);
      showScore();
    }

    render();
  }

  function run() {
    if (isGameOver || timerId !== null) {
      return;
    }
    startOverlay?.classList.add("hidden");
    timerId = setInterval(tick, TICK_MS);
  }

  /**
   * Throw the dead run away and deal a new one. Clearing `isGameOver` last of
   * all is what lets run() start the interval again; stop() first means a
   * restart triggered while a loop is somehow still live cannot leave two
   * intervals ticking the same board.
   */
  function restart() {
    stop();

    const next = createInitialState();

    snake = next.snake;
    direction = next.direction;
    queuedDirection = next.queuedDirection;
    food = next.food;
    score = next.score;
    isGameOver = next.isGameOver;

    gameOverOverlay?.classList.add("hidden");
    showScore();
    render();
    run();
  }

  document.addEventListener("keydown", (event) => {
    const input = DIRECTIONS[event.key];

    if (input) {
      event.preventDefault();
      // Compare against `direction`, not `queuedDirection`: two turns inside a
      // single tick would otherwise let the snake fold back on itself.
      queuedDirection = getNewDirection(direction, input);
      run();
      return;
    }

    if (event.key === " ") {
      event.preventDefault();

      if (isGameOver) {
        restart();
      } else {
        run();
      }
    }
  });

  restartButton?.addEventListener("click", () => {
    // Drop focus first: a focused button treats a later SPACE as a click, which
    // would restart a game that is already running mid-play.
    restartButton.blur();
    restart();
  });

  showScore();
  render();
}

// Only auto-start in a browser; importing the module in vitest must not touch
// the DOM or start a timer.
if (typeof document !== "undefined") {
  startGame();
}
