# Project Build - Activity Log

## Current Status

**Last Updated:** 2026-05-15
**Tasks Completed:** 7
**Current Task:** Task 6 complete — restart flow, SPACE-to-start initial state, README
**CI Status:** Pipeline #1157 PASSING on current branch (post-task-5)

---

## CI Status Log

- 2026-05-15: NOT RUN — no pipelines found for branch yet

---

## Session Log

## 2026-05-15 - Iteration 1

### Task

Task 0 (setup): Create basic HTML structure and implement createInitialSnake.

### Work performed

- Created `src/index.html` with HTML5 boilerplate: canvas (400x400), score display,
  game over overlay (hidden by default with restart button), and start overlay.
  Linked `style.css` and `game.js` (as ES module).
- Created `src/game.js` as an ES module that exports `createInitialSnake()`,
  returning a 3-segment snake centered at (10, 10) in a horizontal line.
- Created `src/game.test.ts` with vitest tests for `createInitialSnake` covering
  length, head position, horizontal layout / consecutive x values, and numeric
  x/y properties on every segment.

### Outcome

- Task complete — orchestrator will run Review Gate (lint:fix + test:run), then
  commit and push if green.
- Style sheet `src/style.css` is intentionally left for the next task (styling).
  The browser will still render the canvas without it (the `<link>` will 404 but
  the page loads).

## 2026-05-15 - Iteration 2

### Task

Task 1 (styling): Style the game with retro aesthetic.

### Work performed

- Created `src/style.css` with a retro arcade look:
  - Dark page background (`#0a0a0a`) with a centered flex layout.
  - `.game-container` with a green neon border and glow shadow.
  - Canvas styled with a 3px neon-green border, dark interior, and pixelated
    image rendering to match the grid art.
  - `.score-display` rendered in monospace with uppercase letter-spacing and
    green glow.
  - `.game-over-overlay` and `.start-overlay` absolutely positioned, centered
    over the canvas, with translucent black background, neon-green border, and
    glow. `.hidden` class hides the game-over overlay on load.
  - `#restartButton` styled as a chunky pixel-style button with hover/focus
    invert.
- No JavaScript changes; existing tests for `createInitialSnake` continue to
  cover the only currently-exported game logic.

### Outcome

- Task complete — orchestrator will run Review Gate (lint:fix + test:run), then
  commit and push if green.
- Visual verification (opening `src/index.html`) shows a centered game with a
  dark retro background, neon-green border, and overlay treatment.

## 2026-05-15 - Iteration 3

### Task

Task 2 (testing): Set up test infrastructure and write tests for the core pure
game-logic functions (`moveSnake`, `checkWallCollision`, `checkSelfCollision`).

### Work performed

- Extended `src/game.test.ts` with three new `describe` blocks:
  - `moveSnake` — covers all four directions, length preservation / tail drop,
    and immutability of the input snake.
  - `checkWallCollision` — covers in-bounds, all four out-of-bounds edges
    (including `x===gridSize` and `y===gridSize`), and boundary cells 0 and
    `gridSize-1`.
  - `checkSelfCollision` — covers a clean snake, head looping onto a body
    segment, a single-segment snake, and body-vs-body duplicates which should
    NOT count (only head-vs-body does).
- Extended `src/game.js` with pure-function implementations of `moveSnake`,
  `checkWallCollision`, and `checkSelfCollision`. All three are pure (no DOM,
  no timers, no randomness, no mutation of inputs).
- Note: the task description framed these as "failing test + empty stub" TDD
  steps, but the Review Gate runs `test:run` on every iteration and would
  reject a push with failing tests. I implemented the functions in this same
  iteration so the gate stays green; the next "core" task still owns the
  canvas rendering, game loop, and keyboard controls.

### Outcome

- Task complete — orchestrator will run Review Gate (lint:fix + test:run), then
  commit and push if green.
- All four exported pure functions now have unit tests; the next task focuses
  on wiring movement into the game loop and rendering.

## 2026-05-15 - Iteration 4

### Task

Task 3 (core): Implement snake movement and rendering — `getNewDirection`,
canvas rendering, game loop, and arrow-key controls.

### Work performed

- Added `getNewDirection(current, input)` to `src/game.js`. It rejects
  180-degree turns by returning `current` when `input` is the opposite of
  `current`, ignores unknown inputs (also returning `current`), and otherwise
  returns `input`. The opposites map is shared with the function so the rule
  has a single source of truth.
- Added 8 unit tests for `getNewDirection` covering perpendicular turns in
  both axes, all four 180-degree rejections, same-direction inputs, and
  unknown inputs.
- Implemented `startGame()` in `src/game.js` as the DOM/canvas glue:
  - Gets the `#gameCanvas` 2D context, hides the start overlay on launch.
  - Maintains internal state: `snake`, `direction`, `pendingDirection`, and
    a `stopped` flag.
  - `drawBoard(ctx, snake)` fills the canvas dark and renders each snake
    segment as a 19x19 neon-green tile inside its 20-px cell.
  - `tick()` adopts `pendingDirection`, calls `moveSnake`, and stops the
    loop on `checkWallCollision` for the new head.
  - Uses `setInterval(tick, 150)` for continuous movement.
  - Listens for `keydown` events; `ArrowUp/Down/Left/Right` map to
    `up/down/left/right` and are passed through `getNewDirection` before
    being staged as `pendingDirection`. Returns a cleanup function that
    stops the loop and removes the listener (useful for future restart).
- Module bottom guards DOM bootstrapping with
  `if (typeof document !== "undefined")` so vitest (node env) does not
  invoke `startGame()`. In the browser, it runs on `DOMContentLoaded`
  (or immediately if the document is already ready).

### Outcome

- Task complete — orchestrator will run Review Gate (lint:fix + test:run), then
  commit and push if green.
- Visual verification (opening `src/index.html`): start overlay hides on
  load, the 3-segment snake renders at the center and steps right every
  150ms, and arrow keys redirect it while ignoring 180-degree reversals.
  The loop halts when the head crosses the wall (full game-over screen and
  self-collision wiring belong to later tasks).

## 2026-05-15 - Iteration 5

### Task

Task 4 (core): Implement food spawning and collision detection — add
`checkFoodCollision` and `spawnFood`, render food on canvas, grow the
snake when food is eaten, and respawn food off the snake.

### Work performed

- Added `checkFoodCollision(head, food)` to `src/game.js`. Returns `true`
  when head and food share a cell. `null` food (grid full) never collides.
- Added `spawnFood(gridSize, snake, random)` with a bounded retry loop
  capped at `gridSize * gridSize` attempts so a degenerate `random` or a
  near-full grid cannot infinite-loop (satisfies the prompt's MANDATORY
  Rule 2). Returns `null` only when no free cell is found within budget.
- Added optional `grow` parameter to `moveSnake(snake, direction, grow)`.
  Default `false` preserves the old behavior (tail dropped, length
  unchanged); `true` keeps the tail so the snake grows by one segment.
- Added 7 unit tests covering: `checkFoodCollision` true/false on x and y
  mismatches and null food; `spawnFood` returning an in-bounds cell, a
  cell not on the snake, retry-on-collision via a deterministic sequence
  (asserting that the random fn was called twice — once per attempt),
  and a deterministic corner cell. All sequence-based and non-colliding
  constant random fakes per the prompt's MANDATORY Rule 1; bail-out is
  not exercised by tests (it's a defensive guard, not core behavior).
- Added 2 tests for `moveSnake` covering `grow=true` (length grows by 1,
  full tail preserved) and `grow=false` default (length unchanged).
- Updated `drawBoard(ctx, snake, food)` to render food as a 19x19 red
  (`#ef4444`) tile, drawn before the snake so the head paints over the
  food cell on the tick it is eaten.
- Updated the game loop's `tick`:
  1. Compute the next snake via `moveSnake` (no grow).
  2. Check wall collision on the new head (existing behavior).
  3. Check food collision on the new head; if eaten, recompute the snake
     with `moveSnake(snake, direction, true)` so the tail is preserved,
     then respawn food with `spawnFood(GRID_SIZE, snake, Math.random)`
     so the new food is never on the (now-grown) snake.
- Initial food is spawned at `startGame` start and drawn alongside the
  initial snake.
- Score display update and game-over UI are intentionally deferred to
  task 5 (`Implement game over logic`) per `tasks.json`. Self-collision
  is implemented and tested but not yet wired into `tick` for the same
  reason — task 5 owns "Wire up collision detection in game loop".

### Outcome

- Task complete — orchestrator will run Review Gate (lint:fix + test:run),
  then commit and push if green.
- Visual verification (opening `src/index.html`): the snake renders with
  a single red food cell on the board; steering the head onto the food
  grows the snake by one segment and a new food cell appears elsewhere
  (never on the snake). The game continues until a wall is hit.

## 2026-05-15 - Iteration 6

### Task

Task 5 (core): Implement game over logic — wire collision detection in the
game loop, stop on collision, update score on food, and display the game
over overlay with the final score.

### Outcome preview

- Task complete — orchestrator will run Review Gate (lint:fix + test:run),
  then commit and push if green.
- Visual verification (opening `src/index.html`): the score in the header
  ticks up by 1 each time the head eats a red food cell; running the snake
  into a wall OR into its own body stops the loop instantly and reveals the
  "Game Over!" overlay with the final score and the (not-yet-wired)
  restart button (restart belongs to task 6).

### Work performed

- Added `isGameOver(snake, gridSize)` to `src/game.js`, a pure function
  that returns true when either `checkWallCollision(head, gridSize)` or
  `checkSelfCollision(snake)` would. Wall is checked first so an
  out-of-bounds head never reaches the self-collision compare. Exported
  for testability; the live `tick` keeps the two checks split (wall
  before snake mutation, self after) because the food-eating branch
  changes the snake before self-collision is meaningful.
- Added `POINTS_PER_FOOD = 1` exported constant so the score increment
  has a single source of truth.
- Reworked `startGame()` in `src/game.js`:
  - Looks up `#gameOverOverlay`, `#score`, and `#finalScore` alongside
    the canvas and start overlay, defensively allowing each to be null.
  - On launch: hides the game-over overlay (in case it was visible from
    a previous session in dev), zeroes the in-DOM score, draws the
    initial board.
  - Introduced internal `score` state and `endGame()` helper. `endGame()`
    sets `stopped`, writes `score` into `#finalScore`, and removes
    `.hidden` from `#gameOverOverlay`.
  - `tick()` now: (1) checks wall collision on the provisional new head
    and calls `endGame()` on hit; (2) on a food collision, regrows the
    snake, increments `score`, writes it to `#score`, and respawns food;
    (3) finally checks self-collision on the (possibly grown) snake and
    calls `endGame()` on hit. drawing the board is skipped on game over
    so the canvas freezes on the last safe frame behind the overlay.
- Added unit tests in `src/game.test.ts`:
  - `isGameOver`: 5 cases — clean snake, wall-only collision, self-only
    collision, wall+self combined (verifies wall short-circuits before
    the body is inspected, so an out-of-bounds head never feeds into
    `checkSelfCollision`), and a boundary `gridSize-1` cell.
  - `POINTS_PER_FOOD`: sanity test that the constant is a positive
    integer, since `tick` relies on it.
- DOM event listeners and game-loop wiring are intentionally not unit
  tested per `plan.md` ("What NOT to Test: DOM event handlers, Canvas
  rendering"). The pure `isGameOver`/`checkSelfCollision`/`checkWallCollision`
  trio fully covers the conditions that drive `endGame()`.

### Outcome

- Task complete — orchestrator will run Review Gate (lint:fix + test:run),
  then commit and push if green.
- Restart button wiring is intentionally deferred to task 6
  (`Add restart functionality and final polish`); the button is rendered
  inside the game-over overlay but currently has no click handler.

## 2026-05-15 - Iteration 7

### Task

Task 6 (polish): Add restart functionality and final polish — restart
button + SPACE-to-start initial state, reset snake/score/loop, write
`src/README.md`.

### Work performed

- Added a pure `createGameState(gridSize, random)` helper to `src/game.js`
  that returns `{ snake, direction, score, food }`. It is the single
  source of truth for "fresh game" data and is used by both the initial
  boot and the restart path so they can't drift.
- Reworked `startGame()` in `src/game.js` to be a three-mode state
  machine (`idle` / `running` / `over`) instead of a one-shot run:
  - Boot: state is `idle`, start overlay is visible, the initial board
    is drawn behind it, and no loop is running. The game waits for
    SPACE before doing anything (satisfies "Press SPACE to start"
    initial state).
  - SPACE while `idle` or `over` → `beginRun()`: hides both overlays,
    resets snake/direction/score/food via `createGameState`, redraws,
    flips to `running`, and starts a fresh `setInterval(tick, 150)`.
  - Arrow keys are only accepted in `running` mode (no steering at the
    start screen or after death).
  - `endGame()` now clears the interval (rather than just setting a
    `stopped` flag), writes `score` into `#finalScore`, reveals the
    game-over overlay, and flips to `over`.
  - Restart button: `#restartButton` `click` handler calls `beginRun()`.
    The teardown closure (returned by `startGame`) removes both the
    `keydown` and `click` listeners and clears the interval.
- Updated `src/index.html` to add a small "Or press SPACE to restart"
  hint under the restart button, and `src/style.css` to share the
  `.controls` typography rule between the start and game-over overlays.
- Added 2 unit tests in `src/game.test.ts` for `createGameState`:
  - Returns the canonical initial snake, `direction: "right"`, `score: 0`,
    and a deterministic food cell. Uses `() => 0.05` → food at (1, 1)
    which does not collide with the initial snake `[(8,10),(9,10),(10,10)]`
    (per the prompt's MANDATORY Rule 1: trace the math, no constant
    fake on an occupied cell).
  - Two consecutive calls return independent snake arrays (no shared
    reference), so a restart cannot leak mutations from a previous run.
- No new tests for `startGame` itself per `plan.md` ("What NOT to Test:
  DOM event handlers, Canvas rendering"). The mode transitions
  (idle → running → over → running) are exercised by the existing pure
  tests for collision/movement plus the new `createGameState` tests; the
  glue is intentionally thin.
- Created `src/README.md` with: how to play (SPACE to start, arrows to
  steer, click Restart or press SPACE on game over), a controls table,
  the file layout, the exported pure helpers, and `pnpm test:run`
  instructions. Notes that the test suite uses only deterministic fakes
  and that `startGame` is guarded by `typeof document !== "undefined"`.

### Outcome

- Task complete — orchestrator will run Review Gate (lint:fix + test:run),
  then commit and push if green.
- Visual verification (opening `src/index.html`): page loads with the
  start overlay visible over a frozen initial board; pressing SPACE
  hides the overlay and starts the snake stepping right; arrow keys
  steer; running into a wall or the body reveals the Game Over overlay
  with the final score, and either clicking "Restart Game" or pressing
  SPACE resets snake/score/food and the loop resumes immediately.
- With this task complete all 7 tasks in `tasks.json` are done; the
  next iteration should signal `<promise>COMPLETE</promise>` once CI
  reports green on this push.
