// Classic Snake Game - Core Logic Module
//
// Everything that can be tested without a browser is exported as a pure
// function. The DOM/canvas wiring lives in startGame() and is only invoked
// when a real document exists, so importing this module under vitest (node
// environment) is side-effect free.

/** The board is a square grid of GRID_SIZE x GRID_SIZE cells. */
export const GRID_SIZE = 20;

/** Pixel size of one grid cell; GRID_SIZE * CELL_SIZE matches the canvas. */
export const CELL_SIZE = 20;

/** Milliseconds between game ticks. */
export const TICK_MS = 150;

/** Points awarded for each piece of food eaten. */
export const POINTS_PER_FOOD = 10;

/** Colours mirror the phosphor-green palette in style.css. */
const BOARD_COLOUR = "#0f150f";
const SNAKE_COLOUR = "#1f7a10";
const SNAKE_HEAD_COLOUR = "#39ff14";

/** Amber, the other classic CRT phosphor - food never reads as snake. */
const FOOD_COLOUR = "#ffb000";

/** Gap in pixels left around each cell so segments read as separate blocks. */
const CELL_INSET = 1;

/** Extra gap around the food disc, so it sits clearly inside its own cell. */
const FOOD_INSET = 2;

/**
 * Arrow keys mapped to the one-cell delta they steer towards. `event.key`
 * values, so the keyboard handler stays a lookup rather than a switch.
 */
const KEY_DIRECTIONS = {
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
};

/**
 * At most this many steering inputs are buffered between ticks. Two is enough
 * to make a quick round-the-corner double-tap feel responsive without letting
 * a mashed keyboard queue up a long tail of stale turns.
 */
const MAX_QUEUED_TURNS = 2;

/** Copy a run of cells so a returned snake never aliases the one passed in. */
function copyCells(cells) {
  return cells.map((cell) => ({ x: cell.x, y: cell.y }));
}

/** Identify a cell by value, for set membership. */
function cellKey(cell) {
  return `${cell.x},${cell.y}`;
}

/** Do two deltas point the same way? */
function isSameDirection(a, b) {
  return a.x === b.x && a.y === b.y;
}

/** Do two deltas point at each other, i.e. would this be a 180-degree turn? */
function isReverseDirection(a, b) {
  return a.x === -b.x && a.y === -b.y;
}

/**
 * Build the starting snake: three segments laid out horizontally across the
 * middle of the grid, head first so the body trails to the left and the snake
 * can set off to the right without immediately doubling back on itself.
 *
 * A fresh array of fresh segment objects is returned on every call so callers
 * (and restarts) never share mutable state.
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
 * Advance the snake one cell in `direction` (a `{ x, y }` one-cell delta),
 * returning a new snake. Length is preserved: the head gains a cell and the
 * tail drops one, so growth stays the caller's business.
 *
 * The input snake and its segments are never mutated - every segment in the
 * result is a fresh object, so a caller can keep the previous snake around.
 * The head is free to step off the grid; catching that is the wall check's
 * job, not this function's.
 */
export function moveSnake(snake, direction) {
  // Every segment takes the cell of the one ahead of it, which is the same as
  // keeping all but the last segment and pushing the new head on the front.
  return [nextHead(snake, direction), ...copyCells(snake.slice(0, -1))];
}

/**
 * The cell the head would occupy after one step in `direction`. Shared by
 * moveSnake/growSnake and by the tick loop, which needs to know where the head
 * is about to land before it decides whether the snake is eating.
 */
function nextHead(snake, direction) {
  const head = snake[0];
  return { x: head.x + direction.x, y: head.y + direction.y };
}

/**
 * Advance the snake one cell in `direction` while keeping its tail, so the
 * snake comes back one segment longer. This is moveSnake for the tick where
 * food was eaten; every other tick drops the tail.
 *
 * Like moveSnake it copies rather than mutates, so the previous snake stays
 * valid and no segment in the result aliases the input.
 */
export function growSnake(snake, direction) {
  return [nextHead(snake, direction), ...copyCells(snake)];
}

/**
 * Resolve a steering input against the direction the snake is already
 * travelling in. A snake cannot turn back through its own neck, so a
 * 180-degree reversal is rejected and `current` is returned unchanged. Any
 * other input (a left or right turn, or the current heading again) is
 * accepted.
 *
 * Unknown or missing input is ignored the same way, which keeps the keyboard
 * handler free of validation. The returned delta is always a fresh object.
 */
export function getNewDirection(current, input) {
  const keep = { x: current.x, y: current.y };

  if (!input || typeof input.x !== "number" || typeof input.y !== "number") {
    return keep;
  }

  if (isReverseDirection(current, input)) return keep;

  return { x: input.x, y: input.y };
}

/**
 * Translate a keyboard `event.key` into the delta it steers towards, or null
 * for any key the game does not use. Returns a fresh delta each call so the
 * caller can hand it straight to the game state.
 */
export function directionFromKey(key) {
  const direction = KEY_DIRECTIONS[key];
  return direction ? { x: direction.x, y: direction.y } : null;
}

/**
 * Report whether `head` has left a `gridSize` x `gridSize` board. Coordinates
 * are zero-based, so `gridSize` itself is already off the board.
 */
export function checkWallCollision(head, gridSize) {
  return head.x < 0 || head.y < 0 || head.x >= gridSize || head.y >= gridSize;
}

/**
 * Report whether the snake's head has run into one of its own body segments.
 * Only segments 1..n-1 are compared, since the head trivially sits on itself.
 */
export function checkSelfCollision(snake) {
  const head = snake[0];
  return snake.some(
    (segment, index) =>
      index > 0 && segment.x === head.x && segment.y === head.y,
  );
}

/**
 * Report whether a snake that has *already moved* is dead: its head is either
 * off the board or on one of its own segments. This is the rule the tick loop
 * applies, kept as one pure function so the loop has no branching logic of its
 * own to get wrong.
 *
 * Taking the post-move snake rather than the cell the head is about to enter
 * is what makes chasing your own tail legal: moveSnake has already dropped the
 * tail, so stepping into the cell it just vacated is not a collision. Passing
 * the pre-move snake would kill the player on a perfectly ordinary turn.
 */
export function isGameOver(snake, gridSize) {
  return checkWallCollision(snake[0], gridSize) || checkSelfCollision(snake);
}

/**
 * Report whether the head has landed on the food. A missing food (the board is
 * full, so there is nowhere left to put one) is never eaten.
 */
export function checkFoodCollision(head, food) {
  return Boolean(food) && head.x === food.x && head.y === food.y;
}

/**
 * Pick a cell for the next piece of food: uniformly at random among the cells
 * the snake does not occupy. `random` defaults to Math.random and is injected
 * so tests can drive the choice deterministically.
 *
 * The free cells are enumerated rather than sampled-and-retried on purpose.
 * Rejection sampling gets slower exactly when the snake is longest, and a
 * capped retry loop has to fall back to a scan anyway; scanning a 20x20 board
 * once per meal is cheaper than the bookkeeping and, more importantly, cannot
 * loop. Returns null only when the snake fills the entire grid.
 */
export function spawnFood(gridSize, snake, random = Math.random) {
  const occupied = new Set(snake.map(cellKey));
  const free = [];

  for (let y = 0; y < gridSize; y += 1) {
    for (let x = 0; x < gridSize; x += 1) {
      if (!occupied.has(`${x},${y}`)) free.push({ x, y });
    }
  }

  if (free.length === 0) return null;

  // Clamped so a fake random outside [0, 1) cannot index off the end.
  const index = Math.min(
    Math.max(Math.floor(random() * free.length), 0),
    free.length - 1,
  );
  return free[index];
}

/**
 * The score after a tick: unchanged unless the snake ate, in which case it
 * gains POINTS_PER_FOOD. Pure, so the running total is never derived from
 * whatever happens to be rendered in the DOM.
 */
export function nextScore(score, ate) {
  return ate ? score + POINTS_PER_FOOD : score;
}

/**
 * The state a game begins with, freshly built every call: the opening snake in
 * the middle of the board heading right, an empty turn queue, a piece of food
 * somewhere off the snake, a zeroed score and a stopped clock.
 *
 * This is the single definition of "a new game", so booting and restarting
 * cannot drift apart - restart is just this state assigned over the live one.
 * `random` is injected so food placement stays deterministic under test.
 */
export function createInitialGameState(random = Math.random) {
  const snake = createInitialSnake();

  return {
    snake,
    // The snake sets off to the right, away from its own body.
    direction: { x: 1, y: 0 },
    // Turns land here first and are applied one per tick, so two keys pressed
    // inside a single tick cannot combine into a reversal.
    queuedTurns: [],
    food: spawnFood(GRID_SIZE, snake, random),
    score: 0,
    // Latched once the snake dies, so a stray key press cannot restart the
    // timer on a finished game. Only restart() clears it.
    gameOver: false,
    running: false,
    timer: null,
  };
}

/**
 * Paint one grid cell, inset slightly so neighbouring segments stay visually
 * separate blocks rather than one smooth ribbon.
 */
function drawCell(ctx, cell, colour) {
  ctx.fillStyle = colour;
  ctx.fillRect(
    cell.x * CELL_SIZE + CELL_INSET,
    cell.y * CELL_SIZE + CELL_INSET,
    CELL_SIZE - CELL_INSET * 2,
    CELL_SIZE - CELL_INSET * 2,
  );
}

/**
 * Draw the snake, head in the brighter neon so the direction of travel is
 * readable at a glance. Does not clear first - drawBoard owns the order.
 */
export function drawSnake(ctx, snake) {
  if (!ctx) return;

  snake.forEach((segment, index) => {
    drawCell(ctx, segment, index === 0 ? SNAKE_HEAD_COLOUR : SNAKE_COLOUR);
  });
}

/**
 * Draw the food as a filled amber disc. Round and a different phosphor, so it
 * cannot be mistaken for a snake segment even at a glance.
 */
export function drawFood(ctx, food) {
  if (!ctx || !food) return;

  const radius = CELL_SIZE / 2 - FOOD_INSET;

  ctx.fillStyle = FOOD_COLOUR;
  ctx.beginPath();
  ctx.arc(
    food.x * CELL_SIZE + CELL_SIZE / 2,
    food.y * CELL_SIZE + CELL_SIZE / 2,
    radius,
    0,
    Math.PI * 2,
  );
  ctx.fill();
}

/**
 * Repaint the whole board: clear, then food, then snake (so a head sharing the
 * food's cell for one frame is drawn on top of it).
 */
export function drawBoard(ctx, snake, food) {
  if (!ctx) return;

  ctx.fillStyle = BOARD_COLOUR;
  ctx.fillRect(0, 0, GRID_SIZE * CELL_SIZE, GRID_SIZE * CELL_SIZE);

  drawFood(ctx, food);
  drawSnake(ctx, snake);
}

/**
 * Wire the game up to a document-like object: draw the opening position,
 * listen for the arrow keys, and run a tick loop that keeps the snake moving,
 * eating, growing and scoring until it hits a wall or itself, at which point
 * the loop stops and the game over overlay reports the final score.
 *
 * `random` is injected so a caller can make food placement deterministic.
 * Returns a handle exposing the live state plus `start()`/`stop()`, which the
 * later restart work can drive.
 */
export function startGame(
  doc = typeof document !== "undefined" ? document : null,
  random = Math.random,
) {
  if (!doc) return null;

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

  const state = createInitialGameState(random);

  /** Push the running total into the header readout. */
  function renderScore() {
    if (scoreEl) scoreEl.textContent = String(state.score);
  }

  /** Stop the clock and show the game over overlay with the final score. */
  function endGame() {
    stop();
    state.gameOver = true;

    if (startOverlay) startOverlay.classList.add("hidden");
    if (finalScoreEl) finalScoreEl.textContent = String(state.score);
    if (gameOverOverlay) gameOverOverlay.classList.remove("hidden");
  }

  /**
   * Put a finished (or in-progress) game back to its opening position and play
   * on: the clock is cleared first so no stale tick can fire against the new
   * snake, then the whole state - snake, length, direction, queued turns, food,
   * score and the gameOver latch - is replaced wholesale by a fresh one, the
   * overlays are dismissed and the loop starts again.
   *
   * Assigning over `state` rather than rebinding it keeps the handle returned by
   * startGame (and anything else holding the object) pointing at the live game.
   */
  function restart() {
    stop();
    Object.assign(state, createInitialGameState(random));

    if (gameOverOverlay) gameOverOverlay.classList.add("hidden");
    renderScore();
    drawBoard(ctx, state.snake, state.food);

    // start() hides the start overlay and puts the clock back on.
    start();
  }

  function tick() {
    if (state.queuedTurns.length > 0) {
      state.direction = state.queuedTurns.shift();
    }

    // Decide before moving: the head only eats the cell it is about to enter.
    const eating = checkFoodCollision(
      nextHead(state.snake, state.direction),
      state.food,
    );

    state.snake = eating
      ? growSnake(state.snake, state.direction)
      : moveSnake(state.snake, state.direction);

    if (eating) {
      state.score = nextScore(state.score, true);
      renderScore();
      // Respawn against the grown snake so the new food is never under it.
      state.food = spawnFood(GRID_SIZE, state.snake, random);
    }

    // Paint the frame the snake died on before the overlay covers it, so the
    // board always shows the position that ended the game.
    drawBoard(ctx, state.snake, state.food);

    // Checked after the move, not before: the tail has already been dropped,
    // so following your own tail into the cell it just left stays legal.
    if (isGameOver(state.snake, GRID_SIZE)) endGame();
  }

  function start() {
    if (state.running || state.gameOver) return;
    state.running = true;
    if (startOverlay) startOverlay.classList.add("hidden");
    state.timer = setInterval(tick, TICK_MS);
  }

  function stop() {
    if (state.timer !== null) clearInterval(state.timer);
    state.timer = null;
    state.running = false;
  }

  function steer(direction) {
    // Validate against the last queued turn rather than the direction on
    // screen, so a queued turn cannot be reversed by the next key press.
    const last =
      state.queuedTurns[state.queuedTurns.length - 1] ?? state.direction;
    const next = getNewDirection(last, direction);

    if (isSameDirection(next, last)) return;
    if (state.queuedTurns.length >= MAX_QUEUED_TURNS) return;

    state.queuedTurns.push(next);
  }

  function onKeyDown(event) {
    const direction = directionFromKey(event.key);
    const isStartKey = event.key === " " || event.key === "Spacebar";

    if (!direction && !isStartKey) return;

    // Swallow the key either way, so arrows never scroll the page behind the
    // board - including once the game is over.
    event.preventDefault();

    // A finished game listens for "play again" only: SPACE restarts, arrows are
    // swallowed above (so the page still cannot scroll) but steer nothing.
    if (state.gameOver) {
      if (isStartKey) restart();
      return;
    }

    if (direction) steer(direction);
    start();
  }

  doc.addEventListener("keydown", onKeyDown);

  if (restartButton) {
    restartButton.addEventListener("click", () => {
      // Drop focus first: a button the browser still considers active would
      // treat the next SPACE as another click on itself instead of leaving it
      // to the game, restarting a run already in progress.
      if (typeof restartButton.blur === "function") restartButton.blur();
      restart();
    });
  }

  // The opening state is idle, not paused mid-run: the board shows the snake
  // and its first meal, the "Press SPACE to start" overlay is up, the game over
  // overlay is not, and no clock runs until a key press or the restart button.
  if (startOverlay) startOverlay.classList.remove("hidden");
  if (gameOverOverlay) gameOverOverlay.classList.add("hidden");
  renderScore();
  drawBoard(ctx, state.snake, state.food);

  return { canvas, ctx, state, start, stop, restart };
}

// Boot only in a browser; under vitest `document` is undefined.
if (typeof document !== "undefined") {
  startGame(document);
}
