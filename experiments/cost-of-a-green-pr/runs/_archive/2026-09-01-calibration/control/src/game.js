// Classic Snake Game - Core Logic Module
// Pure functions are exported for unit testing; DOM/canvas wiring lives in
// createGame()/startGame() and is driven through injectable timers and an
// injectable random source so it can be exercised with vitest instead of a
// real browser.

export const GRID_SIZE = 20;
export const CELL_SIZE = 20;
export const TICK_MS = 150;

/** Points banked for each piece of food eaten. */
export const POINTS_PER_FOOD = 10;

/** Palette, shared with the renderer's tests so colours are asserted by name. */
export const COLORS = Object.freeze({
  background: "#0b0f0b",
  grid: "#152015",
  snakeHead: "#aaff80",
  snakeBody: "#39ff14",
  food: "#ff3864",
});

/**
 * Direction vectors keyed by name. A direction is a plain `{ x, y }` delta
 * applied to the head each tick; y grows downward to match canvas coordinates.
 */
export const DIRECTIONS = Object.freeze({
  up: Object.freeze({ x: 0, y: -1 }),
  down: Object.freeze({ x: 0, y: 1 }),
  left: Object.freeze({ x: -1, y: 0 }),
  right: Object.freeze({ x: 1, y: 0 }),
});

/** Keyboard keys that steer the snake, mapped to their direction vector. */
export const KEY_DIRECTIONS = Object.freeze({
  ArrowUp: DIRECTIONS.up,
  ArrowDown: DIRECTIONS.down,
  ArrowLeft: DIRECTIONS.left,
  ArrowRight: DIRECTIONS.right,
  w: DIRECTIONS.up,
  s: DIRECTIONS.down,
  a: DIRECTIONS.left,
  d: DIRECTIONS.right,
});

/**
 * Build the starting snake: a 3-segment body near the middle of the grid,
 * laid out horizontally with the head on the right so it can move right.
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
 * Advance the snake one cell along `direction`.
 *
 * Returns a brand new array of new segment objects — the input snake is never
 * mutated, so callers can keep the previous state for comparison. The tail is
 * dropped unless `grow` is true (i.e. the snake just ate food), in which case
 * the body keeps its tail and the snake gets one segment longer.
 */
export function moveSnake(snake, direction, grow = false) {
  const [head] = snake;
  const newHead = { x: head.x + direction.x, y: head.y + direction.y };
  const body = grow ? snake : snake.slice(0, -1);
  return [newHead, ...body.map((segment) => ({ x: segment.x, y: segment.y }))];
}

/**
 * True when `head` has left the board. The grid spans 0..gridSize-1 on both
 * axes, so any negative coordinate or one at/over gridSize is a wall hit.
 */
export function checkWallCollision(head, gridSize = GRID_SIZE) {
  return head.x < 0 || head.y < 0 || head.x >= gridSize || head.y >= gridSize;
}

/**
 * True when the head overlaps any other segment of its own body. The head
 * itself (index 0) is skipped, so a snake that has not doubled back is safe.
 */
export function checkSelfCollision(snake) {
  const [head] = snake;
  if (!head) return false;
  return snake
    .slice(1)
    .some((segment) => segment.x === head.x && segment.y === head.y);
}

/**
 * True when the head is sitting on the food cell. A missing head or missing
 * food (the board is full and nothing could spawn) is never a collision.
 */
export function checkFoodCollision(head, food) {
  if (!head || !food) return false;
  return head.x === food.x && head.y === food.y;
}

/** `${x},${y}` keys for every cell the snake occupies. */
function occupiedCells(snake) {
  return new Set((snake ?? []).map((segment) => `${segment.x},${segment.y}`));
}

/**
 * Pick a free cell for the next piece of food.
 *
 * `random` is injectable (defaults to Math.random) and is drawn twice per
 * attempt — x first, then y. Candidates that land on the snake are rejected
 * and redrawn, but the retry loop is capped at `gridSize * gridSize` attempts
 * so an unlucky (or fake, or constant) random source can never hang the game;
 * past the cap it falls back to a deterministic scan for the first free cell.
 *
 * Returns null only when the snake fills the entire board — i.e. the player
 * has won and there is nowhere left to put food.
 */
export function spawnFood(
  gridSize = GRID_SIZE,
  snake = [],
  random = Math.random,
) {
  const occupied = occupiedCells(snake);
  const maxAttempts = gridSize * gridSize;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const x = Math.floor(random() * gridSize);
    const y = Math.floor(random() * gridSize);
    if (!occupied.has(`${x},${y}`)) return { x, y };
  }

  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      if (!occupied.has(`${x},${y}`)) return { x, y };
    }
  }
  return null;
}

/** True when two direction vectors point the same way. */
function sameDirection(a, b) {
  return Boolean(a) && Boolean(b) && a.x === b.x && a.y === b.y;
}

/**
 * Resolve the direction the snake should travel next.
 *
 * A snake cannot turn back onto itself, so an `input` that is the exact
 * opposite of `current` is rejected and `current` is returned unchanged.
 * Missing input (no key pressed yet) also keeps the current direction.
 */
export function getNewDirection(current, input) {
  if (!input) return current;
  if (!current) return input;
  const isReversal = input.x === -current.x && input.y === -current.y;
  return isReversal ? current : input;
}

/**
 * Translate a `KeyboardEvent.key` value into a direction vector, or null when
 * the key does not steer. Letter keys are matched case-insensitively so shift
 * or caps lock does not break WASD.
 */
export function directionFromKey(key) {
  if (typeof key !== "string") return null;
  return KEY_DIRECTIONS[key] ?? KEY_DIRECTIONS[key.toLowerCase()] ?? null;
}

/**
 * True for the keys that kick off a game that has not begun, and that restart
 * one that has ended. Older browsers report the space bar as "Spacebar", and
 * some report `event.code` style "Space", so all three are accepted.
 */
function isStartKey(key) {
  return key === " " || key === "Spacebar" || key === "Space";
}

/** Paint the board background, grid lines, the food and the snake. */
export function drawBoard(ctx, snake, food = null) {
  if (!ctx) return;
  const size = GRID_SIZE * CELL_SIZE;

  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  for (let i = 1; i < GRID_SIZE; i++) {
    const offset = i * CELL_SIZE + 0.5;
    ctx.beginPath();
    ctx.moveTo(offset, 0);
    ctx.lineTo(offset, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, offset);
    ctx.lineTo(size, offset);
    ctx.stroke();
  }

  // Food goes down before the snake so the head covers it on the eating tick.
  // It is inset further than a body segment, which reads as a pellet rather
  // than a block and keeps it visually distinct from the snake.
  if (food) {
    ctx.fillStyle = COLORS.food;
    ctx.fillRect(
      food.x * CELL_SIZE + 3,
      food.y * CELL_SIZE + 3,
      CELL_SIZE - 6,
      CELL_SIZE - 6,
    );
  }

  // Body first, then the head in a brighter shade so the direction of travel
  // is readable at a glance.
  snake.forEach((segment, index) => {
    ctx.fillStyle = index === 0 ? COLORS.snakeHead : COLORS.snakeBody;
    ctx.fillRect(
      segment.x * CELL_SIZE + 1,
      segment.y * CELL_SIZE + 1,
      CELL_SIZE - 2,
      CELL_SIZE - 2,
    );
  });
}

/**
 * Build the game controller around a document-like object.
 *
 * The returned object exposes the mutable `state` plus `start`/`stop`/`tick`/
 * `handleKeydown`, which keeps the loop drivable from tests (call `tick()`
 * directly, or run `start()` under fake timers) without a real browser.
 * `options.random` seeds food placement so tests are deterministic.
 *
 * A tick that would put the head into a wall or into the snake's own body is
 * never committed: the loop stops, the game over overlay is revealed with the
 * final score, and the snake is left standing on its last legal cell. From
 * there `restart()` — the overlay's button, or SPACE — puts the board back to
 * its opening state and plays on.
 */
export function createGame(doc, options = {}) {
  const tickMs = options.tickMs ?? TICK_MS;
  const random = options.random ?? Math.random;
  const canvas = doc.getElementById("gameCanvas");
  const ctx =
    canvas && typeof canvas.getContext === "function"
      ? canvas.getContext("2d")
      : null;
  const startOverlay = doc.getElementById("startOverlay");
  const gameOverOverlay = doc.getElementById("gameOverOverlay");
  const scoreEl = doc.getElementById("score");
  const finalScoreEl = doc.getElementById("finalScore");
  const restartButton = doc.getElementById("restartButton");

  const initialSnake = createInitialSnake();
  const state = {
    snake: initialSnake,
    direction: DIRECTIONS.right,
    // The turn queued for the next tick. Buffering it means a key pressed
    // mid-tick is applied once, on a cell boundary, rather than immediately.
    nextDirection: DIRECTIONS.right,
    running: false,
    // Set once a collision has ended the run. It latches: nothing short of a
    // restart clears it, so a stray tick() or key press cannot resurrect the
    // snake after it has died.
    gameOver: false,
    score: 0,
    food: spawnFood(GRID_SIZE, initialSnake, random),
  };
  let timer = null;

  function render() {
    drawBoard(ctx, state.snake, state.food);
  }

  /**
   * Toggle the `hidden` class on an overlay. Elements are looked up up front
   * and may be missing (a document without the overlay markup, or a test stub),
   * so every call is guarded rather than assumed.
   */
  function setHidden(element, hidden) {
    if (!element || !element.classList) return;
    if (hidden) element.classList.add("hidden");
    else element.classList.remove("hidden");
  }

  /** Write the score to state and to the on-page counter. */
  function setScore(value) {
    state.score = value;
    if (scoreEl) scoreEl.textContent = String(value);
  }

  /**
   * End the run: freeze the loop, latch `gameOver`, and reveal the game over
   * overlay with the score the player finished on.
   */
  function endGame() {
    stop();
    state.gameOver = true;
    if (finalScoreEl) finalScoreEl.textContent = String(state.score);
    setHidden(gameOverOverlay, false);
  }

  /**
   * Put the board back to its opening state: a fresh 3-segment snake in the
   * middle facing right, a zeroed score, a newly drawn piece of food, the game
   * over overlay dismissed and the "press SPACE to start" one back in its
   * place. The loop is stopped first so a reset that lands mid-game cannot
   * leave the old interval running alongside the new one. The board is idle
   * afterwards — restart() is what resets *and* plays on.
   */
  function reset() {
    stop();
    const snake = createInitialSnake();
    state.snake = snake;
    state.direction = DIRECTIONS.right;
    state.nextDirection = DIRECTIONS.right;
    state.gameOver = false;
    state.food = spawnFood(GRID_SIZE, snake, random);
    setScore(0);
    setHidden(gameOverOverlay, true);
    setHidden(startOverlay, false);
    render();
  }

  /** Reset the board and play on — what the overlay's button and SPACE do. */
  function restart() {
    reset();
    // Hiding the button drops focus in every browser that matters, but blur
    // first anyway: a still-focused button would swallow the next SPACE as a
    // click and restart a game that had only just begun.
    restartButton?.blur?.();
    start();
  }

  function tick() {
    if (state.gameOver) return;
    state.direction = state.nextDirection;
    // Move first, then ask whether the head landed on the food: growth has to
    // be decided before the tail is dropped, so an eating tick re-runs the
    // move with grow=true and keeps the tail instead.
    const moved = moveSnake(state.snake, state.direction);
    const ate = checkFoodCollision(moved[0], state.food);
    const next = ate ? moveSnake(state.snake, state.direction, true) : moved;

    // Collisions are judged against the snake this tick would produce, so the
    // eating tick is checked with the tail it kept, and a plain tick is free
    // to move into the cell its own tail is vacating. A losing tick is never
    // committed — the snake is left standing on its last legal cell rather
    // than drawn half inside a wall.
    if (checkWallCollision(next[0], GRID_SIZE) || checkSelfCollision(next)) {
      endGame();
      return;
    }

    state.snake = next;
    if (ate) {
      setScore(state.score + POINTS_PER_FOOD);
      state.food = spawnFood(GRID_SIZE, state.snake, random);
    }
    render();
  }

  function start() {
    // A finished run stays finished: only restart() clears `gameOver`, so a
    // stray start() cannot resurrect a dead snake mid-overlay.
    if (state.running || state.gameOver) return;
    state.running = true;
    setHidden(startOverlay, true);
    // Looked up at call time (not module load) so vitest fake timers apply.
    timer = globalThis.setInterval(tick, tickMs);
  }

  function stop() {
    state.running = false;
    if (timer !== null) {
      globalThis.clearInterval(timer);
      timer = null;
    }
  }

  /**
   * Queue a turn. Returns false when the turn was a 180 and got rejected, so
   * an already-queued legal turn is never clobbered by an illegal one.
   */
  function requestDirection(requested) {
    const next = getNewDirection(state.direction, requested);
    if (!sameDirection(next, requested)) return false;
    state.nextDirection = next;
    return true;
  }

  function handleKeydown(event) {
    const key = event?.key;

    // SPACE is the one key that works on the game over screen: it is "start"
    // before the first run and "play again" after the last one.
    if (isStartKey(key)) {
      event?.preventDefault?.();
      if (state.gameOver) restart();
      else if (!state.running) start();
      return;
    }

    // Steering keys stay inert once the run is over, so a player still
    // hammering the arrows cannot skip past the final score.
    if (state.gameOver) return;

    const requested = directionFromKey(key);
    if (!requested) return;
    event?.preventDefault?.();
    requestDirection(requested);
    // Arrow keys also start a game that has not begun yet.
    if (!state.running) start();
  }

  /** The overlay's own button; clicking it is the mouse route into restart(). */
  function handleRestartClick(event) {
    event?.preventDefault?.();
    restart();
  }

  setScore(state.score);
  setHidden(gameOverOverlay, true);
  if (restartButton && typeof restartButton.addEventListener === "function") {
    restartButton.addEventListener("click", handleRestartClick);
  }
  render();

  return {
    state,
    canvas,
    ctx,
    restartButton,
    render,
    tick,
    start,
    stop,
    endGame,
    reset,
    restart,
    requestDirection,
    handleKeydown,
    handleRestartClick,
  };
}

/**
 * Wire the module to the page: build the controller and listen for keyboard
 * input. The game stays idle behind the start overlay until SPACE or an arrow
 * key is pressed.
 */
export function startGame(doc, options = {}) {
  if (!doc || typeof doc.getElementById !== "function") return null;

  const game = createGame(doc, options);
  const target = options.keyTarget ?? doc;
  if (target && typeof target.addEventListener === "function") {
    target.addEventListener("keydown", game.handleKeydown);
  }
  return game;
}

if (typeof document !== "undefined") {
  startGame(document);
}
