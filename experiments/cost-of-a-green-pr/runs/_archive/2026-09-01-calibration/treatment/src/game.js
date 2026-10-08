// Classic Snake Game - Core Logic Module
// Pure functions are exported for testing; DOM/canvas wiring lives in
// startGame() at the bottom of this file.

export const GRID_SIZE = 20;
export const CELL_SIZE = 20;
export const INITIAL_SNAKE_LENGTH = 3;

/**
 * Build the starting snake: three horizontal segments with the head at the
 * center of the grid, laid out so the snake can move right immediately.
 * Index 0 is the head.
 */
export function createInitialSnake(gridSize = GRID_SIZE) {
  const center = Math.floor(gridSize / 2);
  const snake = [];
  for (let i = 0; i < INITIAL_SNAKE_LENGTH; i++) {
    snake.push({ x: center - i, y: center });
  }
  return snake;
}

/**
 * Unit direction vectors. Frozen so a stray mutation in the game loop cannot
 * corrupt the shared table.
 */
export const DIRECTIONS = Object.freeze({
  up: Object.freeze({ x: 0, y: -1 }),
  down: Object.freeze({ x: 0, y: 1 }),
  left: Object.freeze({ x: -1, y: 0 }),
  right: Object.freeze({ x: 1, y: 0 }),
});

/**
 * Advance the snake one cell in `direction`. Returns a brand new array of new
 * segment objects — the input snake is never mutated, so the caller still holds
 * the pre-move tail and can re-append it to grow after eating food.
 */
export function moveSnake(snake, direction) {
  const head = snake[0];
  const newHead = { x: head.x + direction.x, y: head.y + direction.y };
  const body = snake.slice(0, -1).map((segment) => ({ ...segment }));
  return [newHead, ...body];
}

/**
 * True when `head` has left the gridSize x gridSize board on any side.
 */
export function checkWallCollision(head, gridSize = GRID_SIZE) {
  return head.x < 0 || head.y < 0 || head.x >= gridSize || head.y >= gridSize;
}

/**
 * True when the head occupies the same cell as any other segment.
 */
export function checkSelfCollision(snake) {
  const head = snake[0];
  return snake
    .slice(1)
    .some((segment) => segment.x === head.x && segment.y === head.y);
}

/**
 * True when the head is sitting on the food cell. Missing food (the board is
 * full and there is nowhere left to spawn) never counts as a hit.
 */
export function checkFoodCollision(head, food) {
  if (!head || !food) return false;
  return head.x === food.x && head.y === food.y;
}

/**
 * Turn one random sample into a grid coordinate, clamped to the board. Real
 * `Math.random` never returns 1, but injected fakes in tests can, and an
 * off-by-one here would spawn food outside the wall.
 */
function toCoord(sample, gridSize) {
  return Math.min(gridSize - 1, Math.max(0, Math.floor(sample * gridSize)));
}

/**
 * First unoccupied cell in reading order, or null when the board is full.
 * Used as the deterministic fallback for `spawnFood`.
 */
function firstFreeCell(gridSize, occupied) {
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      if (!occupied.has(`${x},${y}`)) return { x, y };
    }
  }
  return null;
}

/**
 * Pick a random empty cell for the next piece of food.
 *
 * `random` is injected so tests stay deterministic. The rejection loop is
 * capped at `gridSize * gridSize` attempts — on a nearly-full board random
 * sampling can miss the last free cells for a very long time, so once the cap
 * is hit we scan for the first free cell instead. That bail-out is what keeps
 * this function from ever spinning forever. Returns null only when every cell
 * is occupied (the snake has filled the board).
 */
export function spawnFood(
  gridSize = GRID_SIZE,
  snake = [],
  random = Math.random,
) {
  const occupied = new Set(snake.map((segment) => `${segment.x},${segment.y}`));
  const maxAttempts = gridSize * gridSize;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const x = toCoord(random(), gridSize);
    const y = toCoord(random(), gridSize);
    if (!occupied.has(`${x},${y}`)) return { x, y };
  }
  return firstFreeCell(gridSize, occupied);
}

/**
 * Milliseconds between game-loop ticks. One tick = one cell of movement.
 */
export const TICK_MS = 150;

/**
 * Board colors, kept in sync with the custom properties in style.css so the
 * canvas matches the surrounding retro chrome.
 */
export const COLORS = Object.freeze({
  board: "#060906",
  snakeHead: "#7dff5c",
  snakeBody: "#39ff14",
  food: "#ff2e4d",
});

/**
 * True when two direction vectors point exactly opposite ways.
 */
export function isOpposite(a, b) {
  return a.x === -b.x && a.y === -b.y;
}

/**
 * Resolve the direction to travel next. A 180-degree turn would drive the head
 * straight into the neck, so it is rejected and `current` is kept. Unknown or
 * missing input is also ignored.
 */
export function getNewDirection(current, input) {
  if (!input) return current;
  if (isOpposite(current, input)) return current;
  return input;
}

/**
 * Arrow keys mapped to direction vectors, keyed by KeyboardEvent.key.
 */
export const KEY_DIRECTIONS = Object.freeze({
  ArrowUp: DIRECTIONS.up,
  ArrowDown: DIRECTIONS.down,
  ArrowLeft: DIRECTIONS.left,
  ArrowRight: DIRECTIONS.right,
});

/**
 * Direction for a KeyboardEvent.key, or null for any other key. Uses an own
 * property check so inherited names like "constructor" cannot leak through.
 */
export function directionFromKey(key) {
  return Object.prototype.hasOwnProperty.call(KEY_DIRECTIONS, key)
    ? KEY_DIRECTIONS[key]
    : null;
}

/**
 * Keys that begin a round from the start screen and restart one from the game
 * over screen. "Spacebar" is the legacy IE/Edge name for the same key.
 */
export const START_KEYS = Object.freeze([" ", "Spacebar"]);

/**
 * True for the keys that start or restart a round.
 */
export function isStartKey(key) {
  return START_KEYS.includes(key);
}

/**
 * Points added for each piece of food. One point per meal keeps the score and
 * the snake's growth in step, so `score === snake.length - INITIAL_SNAKE_LENGTH`
 * always holds.
 */
export const POINTS_PER_FOOD = 1;

/**
 * Fresh mutable game state for one round. `direction` is the heading the last
 * tick committed to; `pendingDirection` is the heading the next tick will use.
 * `running` tracks the loop timer; `gameOver` is the terminal flag that stops
 * the round for good.
 */
export function createGameState(gridSize = GRID_SIZE, random = Math.random) {
  const snake = createInitialSnake(gridSize);
  return {
    snake,
    direction: DIRECTIONS.right,
    pendingDirection: DIRECTIONS.right,
    gridSize,
    running: false,
    gameOver: false,
    score: 0,
    random,
    food: spawnFood(gridSize, snake, random),
  };
}

/**
 * Put an existing state object back to the start of a fresh round, in place.
 *
 * The fields are copied onto the *same* object rather than returning a new one
 * because `startGame()` closes over `state`; swapping the reference would leave
 * the loop, the renderer, and the keyboard handler all driving the old, dead
 * round. `gridSize` and the injected `random` carry over, so a restart plays on
 * the same board with the same source of randomness.
 */
export function resetState(state) {
  Object.assign(state, createGameState(state.gridSize, state.random));
  return state;
}

/**
 * Record a steering input. The reversal check runs against the *committed*
 * direction, not the pending one, so two quick presses inside a single tick
 * (right, then up, then left) can never fold the snake back onto its neck.
 * A rejected input leaves any already-queued turn intact.
 */
export function applyInput(state, input) {
  const next = getNewDirection(state.direction, input);
  if (next !== state.direction) {
    state.pendingDirection = next;
  }
  return state.pendingDirection;
}

/**
 * True when the snake has run out of the round: head off the board, or head on
 * one of its own segments. Both are fatal, so the game loop only needs this one
 * question after each move.
 */
export function hasCollided(state) {
  return (
    checkWallCollision(state.snake[0], state.gridSize) ||
    checkSelfCollision(state.snake)
  );
}

/**
 * Advance the game by one step: commit the queued direction, then move. When
 * the new head lands on the food the snake grows — `moveSnake` drops the tail
 * and never mutates its input, so re-appending a copy of the pre-move tail
 * restores the length and adds one. New food is then spawned somewhere that is
 * not on the (already grown) snake, and the score goes up.
 *
 * The collision check runs *after* the move, against the post-growth snake, and
 * latches `gameOver`. Once that flag is set the state is frozen: a late timer
 * callback that slips through after the loop is cleared cannot walk a dead
 * snake any further or inflate the final score.
 */
export function tick(state) {
  if (state.gameOver) return state;
  state.direction = state.pendingDirection;
  const tail = state.snake[state.snake.length - 1];
  const moved = moveSnake(state.snake, state.direction);
  if (checkFoodCollision(moved[0], state.food)) {
    state.snake = [...moved, { ...tail }];
    state.score += POINTS_PER_FOOD;
    state.food = spawnFood(state.gridSize, state.snake, state.random);
  } else {
    state.snake = moved;
  }
  if (hasCollided(state)) {
    state.gameOver = true;
  }
  return state;
}

/**
 * Paint the empty board.
 */
export function drawBoard(ctx, gridSize = GRID_SIZE, cellSize = CELL_SIZE) {
  ctx.fillStyle = COLORS.board;
  ctx.fillRect(0, 0, gridSize * cellSize, gridSize * cellSize);
}

/**
 * Paint the snake, head first and brighter, with a 1px gutter between cells so
 * the segments read as a chain rather than one solid bar.
 */
export function drawSnake(ctx, snake, cellSize = CELL_SIZE) {
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
 * Paint the food as a smaller inset pellet so it reads as a distinct pixel
 * rather than another snake segment. No-op once the board is full.
 */
export function drawFood(ctx, food, cellSize = CELL_SIZE) {
  if (!food) return;
  const inset = Math.max(2, Math.round(cellSize / 5));
  ctx.fillStyle = COLORS.food;
  ctx.fillRect(
    food.x * cellSize + inset,
    food.y * cellSize + inset,
    cellSize - inset * 2,
    cellSize - inset * 2,
  );
}

/**
 * Draw one whole frame. The snake goes on last so the head covers the food on
 * the frame it is eaten.
 */
export function render(ctx, state, cellSize = CELL_SIZE) {
  drawBoard(ctx, state.gridSize, cellSize);
  drawFood(ctx, state.food, cellSize);
  drawSnake(ctx, state.snake, cellSize);
}

/* -------------------------------------------------------------------------
 * DOM wiring. Everything below touches the browser and is deliberately not
 * unit tested (see plan.md); it is guarded so importing this module in Node
 * during the test run never reaches for `document`.
 * ---------------------------------------------------------------------- */

/**
 * Wire the canvas, the game loop, and the keyboard to a fresh game state.
 * Returns a small handle so callers can drive the round.
 */
export function startGame() {
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");
  const startOverlay = document.getElementById("startOverlay");
  const gameOverOverlay = document.getElementById("gameOverOverlay");
  const scoreLabel = document.getElementById("score");
  const finalScoreLabel = document.getElementById("finalScore");
  const restartButton = document.getElementById("restartButton");

  const state = createGameState();
  let timerId = null;

  function showScore() {
    if (scoreLabel) scoreLabel.textContent = String(state.score);
  }

  function stopLoop() {
    if (timerId !== null) {
      clearInterval(timerId);
      timerId = null;
    }
    state.running = false;
  }

  /**
   * End the round: kill the timer and raise the game-over overlay with the
   * score the player finished on.
   */
  function endGame() {
    stopLoop();
    if (finalScoreLabel) finalScoreLabel.textContent = String(state.score);
    gameOverOverlay?.classList.remove("hidden");
  }

  function step() {
    tick(state);
    // Draw the fatal frame before the overlay goes up, so the player sees the
    // move that killed them. A head past the wall simply clips off-canvas.
    render(ctx, state);
    showScore();
    if (state.gameOver) {
      endGame();
    }
  }

  function startLoop() {
    if (state.running || state.gameOver) return;
    state.running = true;
    startOverlay?.classList.add("hidden");
    timerId = setInterval(step, TICK_MS);
  }

  /**
   * Wind the board back to the start screen: stop the timer *first* so a tick
   * already queued behind `clearInterval` cannot land on the fresh state, then
   * reset, swap the overlays back, and repaint.
   */
  function resetRound() {
    stopLoop();
    resetState(state);
    gameOverOverlay?.classList.add("hidden");
    startOverlay?.classList.remove("hidden");
    showScore();
    render(ctx, state);
  }

  /** Reset and immediately deal a new round, as the button label promises. */
  function restartGame() {
    resetRound();
    startLoop();
  }

  restartButton?.addEventListener("click", () => {
    // Drop focus before restarting: a focused button is activated by SPACE, so
    // leaving it focused would make the start/steer SPACE press reset a round
    // that is already in progress.
    restartButton.blur();
    restartGame();
  });

  document.addEventListener("keydown", (event) => {
    if (state.gameOver) {
      // Arrow keys stay inert on a finished round — only a deliberate SPACE
      // (the keyboard twin of the restart button) deals a new one.
      if (isStartKey(event.key)) {
        event.preventDefault();
        restartGame();
      }
      return;
    }
    const direction = directionFromKey(event.key);
    if (direction) {
      event.preventDefault();
      applyInput(state, direction);
      startLoop();
      return;
    }
    if (isStartKey(event.key)) {
      event.preventDefault();
      startLoop();
    }
  });

  showScore();
  render(ctx, state);
  return { state, startLoop, stopLoop, endGame, resetRound, restartGame };
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startGame);
  } else {
    startGame();
  }
}
