# Project Build - Activity Log

## Current Status

**Last Updated:** 2026-05-15
**Tasks Completed:** 7 (Task 0 setup, Task 1 styling, Task 2 testing, Task 3 core movement, Task 4 food + collisions, Task 5 game over, Task 6 polish/restart) + Task 7 finalization
**Current Task:** Task 7 (finalization) — verify CI green and signal COMPLETE
**CI Status:** Passing (pipeline #1149, workflow `ci-workflow`, all workflows passed)

---

## CI Status Log

- 2026-05-15: Pre-iteration CI status = NOT RUN (no pipelines for branch yet)
- 2026-05-15: CI Doctor — Chunk sidecar `--gate-snake` failed (SNAKE.md missing in `experiments/w_chunk-sidecars/*/src/`). Created `src/SNAKE.md` containing the required `SNAKE 🐍🕹️` marker; both `--gate-legal` and `--gate-snake` pass locally.

---

## Session Log

## 2026-05-15 - Iteration 1

### Task

Task 0 (setup): Create basic HTML structure and implement createInitialSnake.

### Work performed

- Created `src/index.html` with HTML5 boilerplate, 400x400 canvas (`#gameCanvas`),
  score display (`#score`), game-over overlay (`#gameOverOverlay` + `#finalScore` + `#restartButton`),
  start overlay (`#startOverlay`), and `<script type="module" src="game.js">` + linked `style.css`.
- Created `src/game.js` exporting `createInitialSnake()` — returns a 3-segment snake
  centered on the 20x20 grid with the body trailing horizontally to the left of the head.
- Created `src/game.test.ts` with focused unit tests for `createInitialSnake`:
  length, center-region head, horizontal body alignment, numeric coordinates.

### Outcome

- Task complete — Review Gate will validate lint + tests, then orchestrator commits/pushes.
- `style.css` is referenced by index.html but will be authored in Task 1 (styling); browsers
  tolerate the missing stylesheet, and the Review Gate does not load the page.

## 2026-05-15 - Iteration 2

### Task

Task 1 (styling): Style the game with retro aesthetic.

### Work performed

- Created `src/style.css` with a retro neon-green-on-black aesthetic:
  - Centered `.game-container` on the page via flexbox on `body` (min-height: 100vh).
  - Dark radial-gradient body background (`#0d0f12` core) for retro feel.
  - Panel container with subtle border, rounded corners, and neon glow shadow.
  - Canvas styled with neon-green border, inner glow, and `image-rendering: pixelated`
    for crisp grid cells.
  - Score display rendered in uppercase monospace with letter-spacing and accent glow.
  - Game-over overlay absolutely positioned over canvas with danger-red heading and
    accent-styled final score; start overlay shares the same neon framing for consistency.
  - Restart button styled as a neon-filled button with inverted hover/focus state and
    keyboard-accessible focus glow (no removed outline without replacement).
  - `.hidden` utility uses `display: none !important` to override flex positioning.

### Outcome

- Task complete — Review Gate will validate lint + tests, then orchestrator commits/pushes.
- No JS or test changes in this iteration; existing `createInitialSnake` tests remain green.

## 2026-05-15 - Iteration 3

### Task

Task 2 (testing): Set up test infrastructure and write initial failing tests for
`moveSnake`, `checkWallCollision`, and `checkSelfCollision`. `tasks.json` marks this
task `passes: false` — test failures are expected (TDD red phase; Task 3/4 will make
them pass).

### Work performed

- Extended `src/game.test.ts` with three new test suites:
  - `moveSnake`: 7 cases covering each cardinal direction (right/left/up/down),
    snake length preservation, body-segment shift, and non-mutation of input.
    Used string directions (`"up"|"down"|"left"|"right"`); the implementation
    in Task 3 will dispatch on this format.
  - `checkWallCollision`: 6 cases covering each out-of-bounds edge
    (x < 0, x === gridSize, y < 0, y === gridSize), an interior cell, and the
    inclusive boundary cells (0 and gridSize - 1).
  - `checkSelfCollision`: 3 cases — fresh snake (false), head overlapping a
    later body segment (true), and a single-segment snake (false).
- Added stub exports to `src/game.js` for the three pending functions
  (`moveSnake` returns `[]`, `checkWallCollision` and `checkSelfCollision` return
  `false`). Each stub uses `_`-prefixed params to satisfy lint's
  `argsIgnorePattern: "^_"`. Stubs are deliberate placeholders — they cause
  the new tests to fail with clean assertion errors, never throw or hang.
- Verified MANDATORY test rules are satisfied: no `Math.random` use, no timers,
  no DOM access, no I/O, all tests synchronous and well under 100ms.
- No production retry loops introduced (Rule 2 N/A this iteration).

### Outcome

- Task 2 complete by design: tests exist and fail; stubs exist and compile.
- Expected Review Gate result: `pnpm test:run` reports failing assertions for
  `moveSnake` (head positions, length, body shift), `checkWallCollision`
  (all four out-of-bounds cases), and `checkSelfCollision` (head-overlap case).
  Per `tasks.json` Task 2 has `passes: false`; the orchestrator handles the
  TDD red phase. Task 3 (core) implements `moveSnake` + direction handling to
  turn these failures green.

## 2026-05-15 - Iteration 4

### Task

Task 3 (core): Implement snake movement and rendering. Turn the failing
`moveSnake`/`checkWallCollision`/`checkSelfCollision` assertions green, add
`getNewDirection()` (with test) to block 180° reversals, and wire canvas
rendering + a tick-based game loop + arrow-key controls in `startGame()`.

### Work performed

- Implemented core pure functions in `src/game.js`:
  - `moveSnake(snake, direction)`: shifts the head by the direction delta
    (right/left/up/down), prepends the new head, drops the tail, and returns
    a fresh array of fresh segment objects (no mutation of input). Unknown
    direction values return a defensive copy.
  - `checkWallCollision(head, gridSize)`: returns true when head x or y is
    `< 0` or `>= gridSize`. Boundary cells `0` and `gridSize - 1` are inside.
  - `checkSelfCollision(snake)`: short-circuits for `length < 2`; otherwise
    scans `snake[1..]` for any segment equal to the head.
  - `getNewDirection(current, input)`: returns `current` when `input` is
    unknown OR when `input` is the opposite of `current` (180° reversal
    block); otherwise returns `input`. Same-direction input is a no-op.
- Added `getNewDirection` tests in `src/game.test.ts` covering perpendicular
  turns, all four 180° reversals, no-op same-direction, and unknown input.
- Exposed `GRID_SIZE = 20`, `CELL_SIZE = 20`, `TICK_MS = 150` constants and
  added a `startGame(doc)` function (browser-only — auto-invoked under
  `if (typeof document !== "undefined")`):
  - Resolves `#gameCanvas`, gets a 2D context, draws a black background and
    the snake as neon-green cells with a 1px gutter for the grid effect.
  - Runs a `setInterval(tick, 150)` loop: applies the latest queued direction
    (so a key press only takes effect at the next tick — prevents
    double-turn-into-self in a single frame), advances the snake, stops the
    loop on wall or self collision.
  - Listens for `keydown` and maps `ArrowUp/Down/Left/Right` through
    `getNewDirection` into a queued direction.
- Followed MANDATORY test rules: no real timers (the new
  `getNewDirection` tests are synchronous), no `Math.random`, no DOM access in
  tests, no I/O. All tests well under 100ms.

### Outcome

- Task 3 complete. Expected Review Gate result: all `moveSnake`,
  `checkWallCollision`, `checkSelfCollision`, and new `getNewDirection`
  tests green. Snake renders and moves with arrow-key controls in browser
  (verified by code review against `index.html` element IDs and the
  `style.css` neon-green palette; the Review Gate does not load the page).
- The DOM-bound `startGame()` is intentionally not unit tested per
  `plan.md` ("What NOT to Test: Canvas rendering, DOM event handlers").

## 2026-05-15 - Iteration 5

### Task

Task 4 (core): Implement food spawning and collision detection. Add and
implement `checkFoodCollision` + `spawnFood` with tests, draw food on
canvas, grow the snake on food collision, increment score, and respawn
food (never landing on the snake).

### Work performed

- Added new pure exports to `src/game.js`:
  - `checkFoodCollision(head, food)`: equality check on `x` and `y`.
  - `spawnFood(gridSize, snake, random)`: derives `(x, y)` from
    `Math.floor(random() * gridSize)` and retries until the candidate is
    not on the snake. Loop is bounded by `maxAttempts = gridSize * gridSize`
    (Rule 2 bail-out) so a fully-saturated grid cannot hang.
- Extended `src/game.test.ts` with two new suites:
  - `checkFoodCollision`: 5 cases (identical coords, origin, x-differ,
    y-differ, both-differ).
  - `spawnFood`: 4 cases — coords inside grid; first-try success when
    the candidate is clear; one-retry-then-success when the first
    candidate hits the snake head; multi-retry sequence where three
    successive candidates each collide with a different segment before
    a clear cell is found.
  - All fake-random calls use either a non-colliding constant or a
    bounded sequence terminated by `?? 0`. Traced manually:
    `() => 0.5` on snake `[(0,0)]` gridSize 5 → `(2,2)` clear;
    `() => 0.0` on snake `[(2,2),(1,2),(0,2)]` → `(0,0)` clear;
    `[0.4,0.4,0.0,0.0]` → `(2,2)` collide then `(0,0)` clear;
    `[0.25,0.25,0.5,0.25,0.75,0.25,0.0,0.75]` on snake `[(1,1),(2,1),(3,1)]`
    gridSize 4 → `(1,1)`,`(2,1)`,`(3,1)` collide then `(0,3)` clear.
    Worst-case attempts (4) << maxAttempts (16). No constant fake can
    cause an infinite loop because all retry-required sequences resolve
    within the bounded `seq` before hitting `?? 0`, and `?? 0` itself
    yields `(0, 0)` which is not on any test snake.
- Wired food/score into `startGame(doc)`:
  - Initialized `food = spawnFood(GRID_SIZE, snake, Math.random)` and
    `score = 0`; resolved `#score` element from `doc`.
  - Replaced `drawSnake` with `drawBoard(ctx, snake, food)` which paints
    the dark background, the food cell in danger-red (`#ff3860` —
    matches the `style.css` accent), then the neon-green snake. Snake
    is drawn last so it visually consumes food on the same tick it eats.
  - On food collision (after wall/self-collision check), the dropped
    tail (`snake[snake.length - 1]`) is pushed back onto `next` so the
    snake grows by one cell; score increments and the `#score`
    `textContent` is updated; a new food is spawned against the _grown_
    snake to guarantee it does not land on any snake cell.
- Preserved `moveSnake`'s pure API (no growth flag): growth is handled in
  the loop. Existing `moveSnake` tests therefore remain unchanged and
  green.

### Outcome

- Task 4 complete. Expected Review Gate result: all prior tests plus
  the 5 new `checkFoodCollision` and 4 new `spawnFood` tests green.
- Snake grows when eating food; food respawns at a position never on
  the snake; score increments on each eat (verified by code review of
  `tick()` and `#score` element in `src/index.html`).
- DOM rendering (canvas draws, score text update) is intentionally not
  unit tested per `plan.md` ("What NOT to Test: Canvas rendering").

## 2026-05-15 - Iteration 6

### Task

Task 5 (core): Implement game over logic. Wire collision detection into
the loop, stop the loop on collision, display the game-over overlay with
the final score, and ensure score is updated when food is eaten.

### Work performed

- Added a new pure export `isGameOver(snake, gridSize)` in `src/game.js`
  that returns `true` when the head is out of bounds (`checkWallCollision`)
  or overlaps any body segment (`checkSelfCollision`). Returns `false`
  defensively for empty snakes. This consolidates the two existing
  collision predicates into a single game-over check that is easy to
  test as a pure function.
- Added 8 `isGameOver` tests in `src/game.test.ts` covering: fresh snake
  (false), each of the four wall sides (true), self-overlap (true),
  single-segment snake (false), and empty snake (false). All synchronous,
  no timers, no randomness, well under 100ms (Rules 3 + 4 satisfied).
- Refactored `tick()` in `startGame(doc)` to use `isGameOver(next, GRID_SIZE)`
  in place of the inline `checkWallCollision || checkSelfCollision` pair.
- Added an `endGame()` closure that:
  - Calls `clearInterval(intervalId)` to stop the game loop on collision.
  - Sets `#finalScore` `textContent` to the final `score` (resolved from
    `doc.getElementById("finalScore")`, which is present in
    `src/index.html` inside `#gameOverOverlay`).
  - Removes the `hidden` class from `#gameOverOverlay` (resolved from
    `doc.getElementById("gameOverOverlay")`) so the retro game-over
    panel becomes visible above the canvas. The `.hidden` utility in
    `style.css` uses `display: none !important`, so removing it reveals
    the overlay.
- Score updates on food eat were already implemented in Iteration 5
  (Task 4); no change needed there, only verified the wiring still
  flows from `score++` → `#score` `textContent` and into `#finalScore`
  via `endGame()` at game over.
- Kept `moveSnake`'s pure API unchanged; game-over wiring lives entirely
  in `startGame()` and the new `isGameOver()` helper.

### Outcome

- Task 5 complete. Expected Review Gate result: all prior tests plus
  the 8 new `isGameOver` tests green (39 total assertions in the suite).
- Game ends on wall or self collision: the loop halts via
  `clearInterval`, `#finalScore` shows the final score, and
  `#gameOverOverlay` becomes visible (verified by code review against
  `src/index.html` element IDs and `src/style.css` `.hidden` utility;
  the Review Gate does not load the page).
- DOM wiring (overlay show/hide, score `textContent` write) is
  intentionally not unit tested per `plan.md` ("What NOT to Test:
  Canvas rendering, DOM event handlers").
- The restart button is wired up in the next task (Task 6 polish).

## 2026-05-15 - Iteration 7

### Task

Task 6 (polish): Add restart functionality and final polish. Wire the
restart button, reset state (snake position/length, score, food) on
restart, clear and restart the game loop, add a SPACE-to-start initial
state, and create `src/README.md` with player instructions.

### Work performed

- Refactored `startGame(doc)` into a three-state machine
  (`idle` → `playing` → `gameOver`), all wired through a shared
  `beginGame()` entry point:
  - `resetState()` calls `createInitialSnake()` (Task 0's pure function
    handles the snake position/length reset), resets `direction` and
    `queuedDirection` to `"right"`, sets `score = 0`, updates
    `#score` `textContent`, spawns a fresh food against the new snake,
    and redraws the board. This single helper is the "reset snake +
    score + food" step from `tasks.json`.
  - `stopLoop()` centralises `clearInterval` + `intervalId = null`,
    so we never double-clear or leak intervals when restarting from
    `gameOver` (the "Clear and restart game loop" step).
  - `beginGame()` is idempotent (no-op when already `playing`), calls
    `resetState()`, hides both overlays, sets state to `playing`,
    stops any prior loop, and starts a new `setInterval(tick, TICK_MS)`.
- Removed the auto-start: `startGame()` now draws the initial board
  but does NOT start the loop. The `#startOverlay` (already present
  in `src/index.html` without the `hidden` class) is therefore visible
  on first render, satisfying "Add 'Press SPACE to start' initial state".
- Wired keyboard:
  - SPACE (`event.key === " "` or `"Spacebar"`) triggers `beginGame()`
    when state is `idle` or `gameOver`; ignored mid-game.
    `event.preventDefault()` is called (guarded by typeof check) to
    suppress page scrolling.
  - Arrow keys are routed through `getNewDirection` only when state
    is `playing` (so a stray arrow press during the start screen or
    after game over has no effect).
- Wired the restart button: `#restartButton` `click` handler calls
  `beginGame()`. Keyboard activation of the focused restart button
  (SPACE/Enter) is safe — keydown fires first and flips state to
  `playing`, so the subsequent click is a no-op via the
  `if (state === "playing") return` guard.
- Created `src/README.md` covering: how to launch (open `index.html`),
  controls (SPACE/arrow keys/restart), rules (20×20 grid, no 180°
  reversal, food never on snake), file layout (one row per source
  file), and the `pnpm test:run` command for the unit tests. No
  emojis used.
- No new pure functions introduced this iteration: the restart logic
  is entirely DOM-bound state-machine wiring, which `plan.md`
  explicitly excludes from unit testing ("What NOT to Test: Canvas
  rendering, DOM event handlers"). The existing `createInitialSnake`
  tests already cover "snake position/length resets on restart"
  because `resetState()` delegates to that function. All 39 prior
  assertions remain unchanged and should remain green.

### Outcome

- Task 6 complete. Expected Review Gate result: all 39 existing tests
  still green (no test file changes; no production retry loops added;
  Rules 1–4 trivially satisfied).
- Full game loop verified by code review: page loads → start overlay
  visible over rendered initial snake → SPACE → overlay hides, loop
  ticks at 150ms, arrow keys steer, food grows snake and increments
  `#score` → wall/self collision → loop stops, game-over overlay
  shows final score → SPACE or restart button → reset to fresh
  initial state and loop restarts. Restart from `gameOver` correctly
  clears the prior interval via `stopLoop()` before starting a new one.
- All steps from `tasks.json` Task 6 addressed: restart button (wired),
  reset snake position/length (via `createInitialSnake`), reset score
  (set to 0 and `#score` updated), clear and restart loop
  (`stopLoop` + new `setInterval`), SPACE-to-start initial state
  (state machine `idle` + visible `#startOverlay`), `src/README.md`
  created.

## 2026-05-15 - Iteration 8

### Task

Task 7 (finalization): Commit and push any remaining changes, verify CI
passes, signal COMPLETE.

### Work performed

- Verified working tree: the only unstaged change is `metrics.json`, which
  is orchestrator-managed (RalphCI iteration metrics) and is not part of
  the build agent's scope. All source code (`src/index.html`,
  `src/style.css`, `src/game.js`, `src/game.test.ts`, `src/README.md`,
  `src/SNAKE.md`) is committed.
- Verified commit log: all seven implementation tasks (Tasks 0–6) are
  represented by their respective `feat:` commits on this branch, plus
  the three `fix(ci-sidecar):` prerequisite commits that satisfy the
  Chunk sidecar legal/snake gates and restore the
  `missingPromiseStreak` narrowing workaround.
- Verified CI: CLI pre-fetch reports CircleCI pipeline #1149 PASSING on
  this branch, workflow `ci-workflow`, all workflows passed. Per the
  prompt, when the CLI says CI is green, trust it.
- Per prompt: did NOT run `git commit` or `git push` (orchestrator
  handles all git operations). Did NOT edit `tasks.json` (CLI manages
  task completion). Did NOT run `pnpm test` / `pnpm test:run` (Review
  Gate handles tests with hard timeout).

### Outcome

- All tasks complete. CI is green on the latest pushed commit.
- Signaling `<promise>COMPLETE</promise>`.
