// Snake game logic. Pure functions live here so vitest can exercise them
// without a DOM; the canvas/DOM wiring sits at the bottom of the file.

export const GRID_SIZE = 20;

// Direction vectors in canvas coordinates: y grows downward, so UP is -1.
export const DIRECTIONS = {
  UP: { x: 0, y: -1 },
  DOWN: { x: 0, y: 1 },
  LEFT: { x: -1, y: 0 },
  RIGHT: { x: 1, y: 0 },
};

export function createInitialSnake() {
  const center = Math.floor(GRID_SIZE / 2);
  return [
    { x: center, y: center },
    { x: center - 1, y: center },
    { x: center - 2, y: center },
  ];
}

// Returns a new snake advanced one cell along `direction`. The input snake is
// never mutated. When `grow` is false the tail segment is dropped, so length
// stays constant; passing true keeps it and the snake grows by one.
export function moveSnake(snake, direction, grow = false) {
  const [head] = snake;
  const next = { x: head.x + direction.x, y: head.y + direction.y };
  const body = grow ? snake : snake.slice(0, -1);
  return [next, ...body.map((segment) => ({ x: segment.x, y: segment.y }))];
}

// True when the head has left the board. Called with the head *after* a move,
// so it may legitimately be one cell outside the grid.
export function checkWallCollision(head, gridSize) {
  return head.x < 0 || head.y < 0 || head.x >= gridSize || head.y >= gridSize;
}

// True when the head overlaps any other segment of its own body.
export function checkSelfCollision(snake) {
  const [head, ...body] = snake;
  if (!head) return false;
  return body.some((segment) => segment.x === head.x && segment.y === head.y);
}

// True when the head has landed on the food cell. Tolerates a missing food
// (the board can be full, in which case there is nothing left to spawn).
export function checkFoodCollision(head, food) {
  if (!head || !food) return false;
  return head.x === food.x && head.y === food.y;
}

// Picks a free cell for the next piece of food. `random` is injected so tests
// can be deterministic; it is called twice per attempt, once per axis.
//
// The random search is capped at gridSize * gridSize attempts and then falls
// back to a deterministic scan, so a nearly full board can never spin here.
// Returns null only when every cell is occupied — the player has won.
export function spawnFood(gridSize, snake = [], random = Math.random) {
  const occupied = new Set(snake.map((segment) => `${segment.x},${segment.y}`));
  if (occupied.size >= gridSize * gridSize) return null;

  const maxAttempts = gridSize * gridSize;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const x = Math.floor(random() * gridSize);
    const y = Math.floor(random() * gridSize);
    if (!occupied.has(`${x},${y}`)) return { x, y };
  }

  for (let y = 0; y < gridSize; y += 1) {
    for (let x = 0; x < gridSize; x += 1) {
      if (!occupied.has(`${x},${y}`)) return { x, y };
    }
  }
  return null;
}

// Rejects a reversal onto the snake's own neck and returns the direction the
// snake should actually travel. Any other input (including the current
// direction) is accepted as-is.
export function getNewDirection(current, input) {
  if (!input) return current;
  if (!current) return input;
  const isReversal = input.x === -current.x && input.y === -current.y;
  return isReversal ? current : input;
}

// Arrow keys are the only bindings the spec calls for. Keyed by
// KeyboardEvent.key so the lookup is a plain object access in the handler.
export const KEY_DIRECTIONS = {
  ArrowUp: DIRECTIONS.UP,
  ArrowDown: DIRECTIONS.DOWN,
  ArrowLeft: DIRECTIONS.LEFT,
  ArrowRight: DIRECTIONS.RIGHT,
};

// Milliseconds between ticks. Slow enough that a 20-cell board is playable,
// fast enough that the snake reads as moving rather than stepping.
export const TICK_MS = 120;

// Points awarded per piece of food. A round number rather than 1 so the score
// reads as an arcade score rather than a length counter.
export const POINTS_PER_FOOD = 10;

export const COLORS = {
  board: "#101710",
  head: "#39ff14",
  body: "#1f8b12",
  // Deliberately off the green palette so food reads at a glance against
  // both the board and the snake.
  food: "#ff3864",
};

// The game state is a plain value so every transition below is a pure
// function: the loop only ever replaces the state and redraws.
//
// `started` and `gameOver` are the two flags that name the three phases the
// screen can be in: idle (the title card), in play, and over. A fresh state
// is idle — the snake is placed but the loop does not run until the player
// presses SPACE.
export function createInitialState(random = Math.random) {
  const snake = createInitialSnake();
  return {
    snake,
    direction: DIRECTIONS.RIGHT,
    pendingDirection: DIRECTIONS.RIGHT,
    food: spawnFood(GRID_SIZE, snake, random),
    score: 0,
    started: false,
    gameOver: false,
  };
}

// A restart is a brand new game already in play: the snake is back at its
// starting position and length, the score is zero, and nothing at all is
// carried over from the finished round. It skips the title card, because the
// player has just asked for another go and should not have to ask twice.
export function restartState(random = Math.random) {
  return { ...createInitialState(random), started: true };
}

// SPACE. From the title card it begins play; from a finished game it starts a
// new one; while a game is already running it changes nothing, so a stray
// press cannot reset a game in progress.
export function startState(state, random = Math.random) {
  if (state.gameOver) return restartState(random);
  if (state.started) return state;
  return { ...state, started: true };
}

// Queues a turn for the next tick. Turns are validated against `direction`
// (the last direction actually travelled) rather than `pendingDirection`, so
// two keys pressed inside one tick can never combine into a reversal.
export function applyInput(state, input) {
  const next = getNewDirection(state.direction, input);
  // getNewDirection hands back the current direction when it rejects an
  // input. Dropping that case keeps an already-queued legal turn from being
  // clobbered by an illegal one pressed right after it.
  if (next === state.direction) return state;
  return { ...state, pendingDirection: next };
}

// Advances one tick: the queued direction becomes the travelled one and the
// snake moves a single cell. When that cell holds the food the snake keeps its
// tail (so it grows by one), scores, and fresh food is spawned clear of the
// new body.
//
// A tick that would kill the snake instead flips `gameOver` and leaves the
// snake where it was, so the last frame shows it alive at the edge rather than
// half off the board. Once `gameOver` is set the state is frozen: a stray
// timer tick after the loop stops is a no-op rather than a rewrite.
export function step(state, random = Math.random) {
  if (state.gameOver) return state;

  const direction = state.pendingDirection;
  const [head] = state.snake;
  const nextHead = { x: head.x + direction.x, y: head.y + direction.y };

  // Checked before the move, because a head outside the grid has no cell to
  // be drawn in and cannot meaningfully collide with the body.
  if (checkWallCollision(nextHead, GRID_SIZE)) {
    return { ...state, direction, gameOver: true };
  }

  const ate = checkFoodCollision(nextHead, state.food);
  const snake = moveSnake(state.snake, direction, ate);

  // Checked after the move, on the moved snake: the cell the tail vacates on
  // a non-growing tick is free for the head to enter, and moveSnake has
  // already dropped it here.
  if (checkSelfCollision(snake)) {
    return { ...state, direction, gameOver: true };
  }

  return {
    ...state,
    direction,
    snake,
    score: ate ? state.score + POINTS_PER_FOOD : state.score,
    // Spawned against the grown snake, so the new food is never under it.
    food: ate ? spawnFood(GRID_SIZE, snake, random) : state.food,
  };
}

// The strings the DOM shows. They live here, beside the scoring rule, so the
// wording is pinned by the tests rather than buried in the event wiring.
export function formatScore(score) {
  return `Score: ${score}`;
}

export function gameOverMessage(score) {
  return `Game Over — Final Score ${score}`;
}

// Shown on the title card. Exported so index.html's static copy of it can be
// checked against the string the first repaint writes.
export const START_MESSAGE = "Press SPACE to start";

// What the overlay should be showing for a given state: the whole title
// card / game over screen decision as one pure value, so the DOM layer only
// has to apply it and the three phases can be pinned without a browser.
export function overlayState(state) {
  if (state.gameOver) {
    return {
      hidden: false,
      message: gameOverMessage(state.score),
      showRestart: true,
    };
  }
  if (!state.started) {
    return { hidden: false, message: START_MESSAGE, showRestart: false };
  }
  // In play: nothing between the player and the board.
  return { hidden: true, message: "", showRestart: false };
}

// Grid cells are drawn one pixel short so the board's background shows
// through as a seam, which reads as a retro dot-matrix grid.
export function drawSnake(ctx, snake, cellSize) {
  snake.forEach((segment, index) => {
    ctx.fillStyle = index === 0 ? COLORS.head : COLORS.body;
    ctx.fillRect(
      segment.x * cellSize,
      segment.y * cellSize,
      cellSize - 1,
      cellSize - 1,
    );
  });
}

// No-op when there is no food, which only happens on a completely full board.
export function drawFood(ctx, food, cellSize) {
  if (!food) return;
  ctx.fillStyle = COLORS.food;
  ctx.fillRect(
    food.x * cellSize,
    food.y * cellSize,
    cellSize - 1,
    cellSize - 1,
  );
}

export function render(ctx, state, width, height, cellSize) {
  ctx.fillStyle = COLORS.board;
  ctx.fillRect(0, 0, width, height);
  // Food first so the head paints over it on the tick it is eaten.
  drawFood(ctx, state.food, cellSize);
  drawSnake(ctx, state.snake, cellSize);
}

// --- DOM wiring ---------------------------------------------------------
// Everything below touches the document and is deliberately left out of the
// unit tests; the logic it drives is the pure code above.

export function startGame(doc = globalThis.document) {
  const canvas = doc?.getElementById("canvas");
  if (!canvas) return null;

  const ctx = canvas.getContext("2d");
  const overlay = doc.getElementById("overlay");
  const overlayMessage = doc.getElementById("overlay-message");
  const restartButton = doc.getElementById("restart");
  const scoreDisplay = doc.getElementById("score");
  const cellSize = canvas.width / GRID_SIZE;

  let state = createInitialState();
  let timer = null;

  // One place writes the screen, so the canvas, the score line and the
  // overlay can never disagree about which state they are showing. The board
  // is painted before the overlay goes up, so the frame under the scrim is
  // the one the snake died on.
  const draw = () => {
    render(ctx, state, canvas.width, canvas.height, cellSize);
    if (scoreDisplay) scoreDisplay.textContent = formatScore(state.score);

    const view = overlayState(state);
    if (overlayMessage) overlayMessage.textContent = view.message;
    if (restartButton) restartButton.hidden = !view.showRestart;
    if (overlay) overlay.hidden = view.hidden;
  };

  const stop = () => {
    if (timer === null) return;
    clearInterval(timer);
    timer = null;
  };

  const tick = () => {
    state = step(state);
    draw();
    // The state is absorbing once it is over, so a callback already in flight
    // when clearInterval lands is a no-op rather than a rewrite.
    if (state.gameOver) stop();
  };

  const run = () => {
    if (timer !== null) return;
    timer = setInterval(tick, TICK_MS);
  };

  // SPACE. startState decides whether that means begin, restart, or nothing;
  // the loop is (re)started either way, and run() is a no-op when it is
  // already ticking.
  const start = () => {
    // A finished game restarts rather than resumes, so drop the old loop
    // before the state underneath it is replaced.
    if (state.gameOver) stop();
    state = startState(state);
    draw();
    run();
  };

  // The restart button. Stops first so a tick from the old game can never
  // land on the new state.
  const restart = () => {
    stop();
    state = restartState();
    draw();
    run();
  };

  const onKeyDown = (event) => {
    const direction = KEY_DIRECTIONS[event.key];
    if (direction) {
      // Arrow keys scroll the page by default, which fights the game.
      event.preventDefault();
      // Only SPACE or the button restarts: steering into a wall and then
      // leaning on the arrow keys should not undo the death.
      if (state.gameOver) return;
      state = applyInput(state, direction);
      start();
      return;
    }
    if (event.key === " ") {
      event.preventDefault();
      start();
    }
  };

  doc.addEventListener("keydown", onKeyDown);
  restartButton?.addEventListener("click", restart);
  draw();

  return {
    start,
    stop,
    restart,
    getState: () => state,
  };
}

// Guarded so importing this module in the node test environment never reaches
// for a DOM that is not there.
if (typeof document !== "undefined") {
  startGame();
}
