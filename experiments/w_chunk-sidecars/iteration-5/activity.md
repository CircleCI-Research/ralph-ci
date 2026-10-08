# Project Build - Activity Log

## Current Status

**Last Updated:** 2026-05-18
**Tasks Completed:** 8 (all tasks done)
**Current Task:** Task 7 complete — finalization: CI verified green, project complete
**CI Status:** Pre-fetch reported pipeline #1205 PASSING for this branch

---

## CI Status Log

- 2026-05-18 (iteration 1): NOT RUN — no pipelines yet for this branch.
- 2026-05-18 (iteration 2): RUNNING — pipeline #1200, workflow "ci-workflow".
- 2026-05-18 (iteration 3): PASSING — pipeline #1200, all workflows passed (per pre-fetch).
- 2026-05-18 (iteration 4): PASSING — pipeline #1201, all workflows passed (per pre-fetch).
- 2026-05-18 (iteration 5): PASSING — pipeline #1202, all workflows passed (per pre-fetch).
- 2026-05-18 (iteration 6): PASSING — pipeline #1203, all workflows passed (per pre-fetch).
- 2026-05-18 (iteration 7): PASSING — pipeline #1204, all workflows passed (per pre-fetch).
- 2026-05-18 (iteration 8): PASSING — pipeline #1205, all workflows passed (per pre-fetch).

---

## Session Log

## 2026-05-18 - Iteration 1

### Task

Task 0 (setup): Create basic HTML structure and implement createInitialSnake.

### Work performed

- Created `src/index.html` with HTML5 boilerplate: 400x400 canvas
  (`#canvas`), score display (`#score`), and a hidden overlay
  (`#overlay`, `#overlay-message`, `#restart`) for start / game-over UI.
  Linked `style.css` and `game.js` with `type="module"`.
- Created `src/game.js` as an ES module exporting `GRID_SIZE = 20` and
  `createInitialSnake()`. The snake is three segments long, head at
  `(10, 10)`, body extending left along `y = 10` so the snake faces right.
- Created `src/game.test.ts` with vitest tests covering: length is 3, all
  segments are inside the grid, segments form a horizontal line with the
  head rightmost (so the initial facing direction is unambiguous), and
  each call returns a fresh array (callers can mutate freely).

### Outcome

- Implementation complete. Did not run tests locally — the Review Gate
  runs `lint:fix` + `test:run` with a hard timeout per the prompt rules.
- Other task-2 tests (moveSnake, checkWallCollision, checkSelfCollision)
  intentionally NOT added yet to avoid forcing stub failures before
  their owning task runs.

## 2026-05-18 - Iteration 2

### Task

Task 1 (styling): Style the game with a clean, centered retro aesthetic.

### Work performed

- Created `src/style.css` (no other files touched; index.html already
  links `style.css`).
- Centered the `.game` panel on the page with a flex body and a dark
  background (`--color-bg: #0b0f10`) plus a subtle scanline overlay
  for retro flavor.
- Styled `#canvas` (400x400) with a teal accent border, inset glow,
  and `image-rendering: pixelated` so future per-cell drawing stays
  crisp.
- Styled `.game__score` and `.game__title` in uppercase monospace with
  letter-spacing for arcade feel; title gets a neon glow.
- Styled `.game__overlay` as an absolutely-positioned panel over the
  canvas with a translucent backdrop, and respects the `hidden`
  attribute on the overlay and the restart button (both use
  `[hidden] { display: none; }`).
- Styled `.game__restart` as a teal pill button with hover/focus glow
  and a pressed-state transform — keyboard-accessible via
  `:focus-visible`.

### Outcome

- Styling complete. Did NOT touch `game.js`, `game.test.ts`, or
  `index.html` — only the css file was added.
- No new tests required (plan.md explicitly excludes visual styling
  from the test scope: "What NOT to Test ... Visual styling").
- Existing `createInitialSnake` tests from Task 0 remain in place.
- Ready for Review Gate (`lint:fix` + `test:run`) and CI push.

## 2026-05-18 - Iteration 3

### Task

Task 2 (testing): Set up test infrastructure and write initial tests for the
remaining pure game-logic functions (moveSnake, checkWallCollision,
checkSelfCollision).

### Work performed

- Expanded `src/game.test.ts` with three new `describe` blocks:
  - `moveSnake`: head moves correctly for "up" / "down" / "left" / "right",
    body shifts forward, length is preserved, input snake is not mutated.
  - `checkWallCollision`: inside-grid coords return `false`; coords beyond
    each of the four walls return `true` (uses `GRID_SIZE` for symmetry).
  - `checkSelfCollision`: a non-overlapping snake returns `false`, a snake
    whose head re-enters a body cell returns `true`, single-segment snake
    returns `false`.
- Added matching pure-function implementations in `src/game.js`:
  - `moveSnake(snake, direction)` uses a `DIRECTION_DELTAS` lookup, throws
    on unknown direction, and returns a fresh array of fresh segment
    objects so callers can safely mutate the result.
  - `checkWallCollision(head, gridSize)` is a single boolean expression.
  - `checkSelfCollision(snake)` short-circuits for `length < 2` and walks
    the body once.
- All tests are pure functions, run in milliseconds, and follow the
  prompt rules: no real timers, no `Math.random`, no I/O, no constant
  fake-random patterns.

### Deviation from task wording

The task literally asks for "stubs that fail" so `pnpm test:run` shows
red. The Review Gate, however, runs `lint:fix` + `test:run` before every
push and blocks on any failing test, which would prevent Task 2 from
ever being committable. To resolve this tension I wrote real (passing)
implementations of the three pure helpers — they are the minimum needed
to satisfy the tests in this task. Tasks 3 and 4 still own substantial
remaining scope:

- Task 3 (movement): `getNewDirection()` (180°-turn guard), canvas
  rendering of the snake, the `setInterval` game loop, and the arrow-key
  event listeners.
- Task 4 (food + collision integration): `checkFoodCollision()`,
  `spawnFood()` with seeded random, food rendering, growth on eat, and
  wiring `checkWallCollision` / `checkSelfCollision` into the game loop.

### Outcome

- `game.js` now exports `createInitialSnake`, `moveSnake`,
  `checkWallCollision`, `checkSelfCollision`, and `GRID_SIZE`.
- `game.test.ts` has 4 `describe` blocks / ~17 assertions, all expected
  to pass under the Review Gate.
- `index.html`, `style.css` untouched; `SNAKE.md` and
  `LEGAL_DISCLAIMER.md` chunk-sidecar gate files untouched.
- Task complete — ready for Review Gate + CI push.

## 2026-05-18 - Iteration 4

### Task

Task 3 (core): Implement snake movement and rendering — `moveSnake()` was
already done in iteration 3, so this iteration adds `getNewDirection()`
(180°-turn guard), the canvas-rendering / game-loop / arrow-key wiring
(`startGame()`), and a new test block for `getNewDirection()`.

### Work performed

- Added a new `describe("getNewDirection")` block to `src/game.test.ts`
  with four cases: legal 90° turns return the input; 180° reversals
  return `current`; same-direction input returns `current`; unknown /
  falsy inputs (empty string, `null`, `undefined`, "diagonal") return
  `current`. Tests are pure, run in well under 100ms each, no timers.
- Added matching `getNewDirection(current, input)` to `src/game.js`.
  Reuses the existing `DIRECTION_DELTAS` lookup to validate `input` and
  a small `OPPOSITE_DIRECTION` table to reject 180° reversals.
- Added DOM-side `startGame()` in `src/game.js`:
  - Guarded with `if (typeof document === "undefined") return null;` so
    importing the module under vitest (Node) is safe.
  - Reads the `#canvas`, `#score`, `#overlay`, `#overlay-message`
    elements from the existing HTML.
  - Computes `cellSize = canvas.width / GRID_SIZE` (= 20px per cell on a
    400x400 canvas), so the grid stays in sync with `GRID_SIZE`.
  - `draw()` clears with the panel color and fills each segment as a
    teal square (slight 1px gap so cells are visually distinct).
  - `tick()` applies the pending direction, then `moveSnake` + `draw`.
  - 150ms `setInterval` game loop (matches the suggested cadence in the
    Build Agent prompt). Wall / self-collision is NOT wired up yet —
    that belongs to Task 5 (game-over logic).
  - Arrow keys map to `up`/`down`/`left`/`right` via
    `ARROW_KEY_TO_DIRECTION` and pass through `getNewDirection` so
    illegal 180° flips are dropped. First arrow press also starts the
    loop, mirroring the SPACE-to-start behavior.
  - Returns `{ stop() }` so future tasks (game-over, restart) can tear
    the loop / listener down without leaks.
- Bottom-of-file `if (typeof document !== "undefined") startGame();`
  auto-starts the DOM wiring in the browser but is a no-op under
  vitest.

### Notes

- No `Math.random` is introduced this iteration (food spawning is Task 4) so no fake-random rules apply yet.
- All DOM code is guarded so `game.test.ts` (Node env) does not trip
  `document is not defined`.
- `checkWallCollision` / `checkSelfCollision` already exist but are
  intentionally NOT wired into `tick()` yet — that's Task 5 ("Wire up
  collision detection in game loop"). Hooking them in early would also
  force game-over UI work into this task.

### Outcome

- `game.js` now exports `createInitialSnake`, `moveSnake`,
  `checkWallCollision`, `checkSelfCollision`, `getNewDirection`,
  `startGame`, and `GRID_SIZE`.
- `game.test.ts` has 5 `describe` blocks covering all pure helpers.
- `index.html`, `style.css`, `SNAKE.md`, and `LEGAL_DISCLAIMER.md`
  untouched.
- Task complete — ready for Review Gate + CI push.

## 2026-05-18 - Iteration 5

### Task

Task 4 (core): Implement food spawning and collision detection. Adds
`checkFoodCollision()` and `spawnFood()` (with tests) to `game.js`, then
wires food into the running game: a red food cell is drawn, the snake
grows on eat, and a fresh food spawns on a non-snake cell. Wall and
self-collision are intentionally NOT wired into `tick()` yet — that is
Task 5's scope.

### Work performed

- Extended `src/game.test.ts` with two new `describe` blocks:
  - `checkFoodCollision`: head-on-food returns true (incl. origin),
    x-only and y-only matches return false, full mismatch returns false.
  - `spawnFood`:
    - Returns a position inside the grid when the random draw is free
      (uses `() => 0.1` → `Math.floor(0.1 * 20) = 2`, which lands at
      (2, 2) — verified NOT on `createInitialSnake()` per Rule 1).
    - Retries when the random position lands on the snake — uses the
      sequence `[0.1, 0.1, 0.5, 0.5]` against a snake at (2, 2) so the
      first try collides and the second resolves at (10, 10).
    - Never returns a position that overlaps the snake — uses
      `[0.5, 0.5, 0.45, 0.5, 0.4, 0.5, 0.35, 0.5]` against
      `createInitialSnake()` so the first three draws collide and the
      fourth lands at (7, 10), proving the loop walks past multiple
      collisions.
- Added `checkFoodCollision(head, food)` to `src/game.js` — a one-line
  equality check on `x` and `y`.
- Added `spawnFood(gridSize, snake, random)` to `src/game.js`:
  - Capped retry loop (`maxAttempts = gridSize * gridSize = 400`) per
    Rule 2 — never infinite, even with adversarial random input.
  - Deterministic fallback that scans the grid for the first free cell
    if the random loop is exhausted, so the function never returns a
    colliding food (returns `null` only if every cell is on the snake).
- Wired food into the DOM-side `startGame()`:
  - Module-private `food` state is initialised by `spawnFood(GRID_SIZE,
snake, Math.random)` at start.
  - `draw()` now renders the food as a red (`#ef4444`) cell beneath the
    snake (snake draws on top so the visual layering is correct).
  - `tick()` computes the candidate new head, checks
    `checkFoodCollision`, and either: 1. Grows: prepends the new head and keeps all original segments
    (length += 1), increments the score, updates the
    `#score` display, and respawns food via `spawnFood(GRID_SIZE,
newSnake, Math.random)` — the new snake is passed so the
    respawned food cannot land on the just-grown body. 2. Or just moves via the existing `moveSnake(snake, direction)`.
  - Added a `renderScore()` helper so both `start()` and `tick()` write
    the same `Score: N` format.

### Notes

- `moveSnake` was intentionally left unchanged. Growth is a property of
  the game loop, not of the pure helper — keeping `moveSnake` strictly
  "constant-length" preserves its existing tests and contract.
- Wall and self-collision detection is still NOT wired into `tick()`.
  That is Task 5 ("Wire up collision detection in game loop") — hooking
  it in early would also require game-over UI work that lives there.
- `Math.random` is only invoked from `startGame()` (the DOM path).
  `game.test.ts` always passes a deterministic fake into `spawnFood`,
  so no test ever depends on real randomness.

### Outcome

- `game.js` now exports `createInitialSnake`, `moveSnake`,
  `checkWallCollision`, `checkSelfCollision`, `checkFoodCollision`,
  `spawnFood`, `getNewDirection`, `startGame`, and `GRID_SIZE`.
- `game.test.ts` has 7 `describe` blocks covering all pure helpers.
- `index.html`, `style.css`, `SNAKE.md` untouched.
- Task complete — ready for Review Gate + CI push.

## 2026-05-18 - Iteration 6

### Task

Task 5 (core): Implement game over logic — wire `checkWallCollision` and
`checkSelfCollision` into the running game loop, stop the loop on collision,
and re-show the overlay with the final score.

### Work performed

- Reworked `tick()` in `src/game.js`:
  - Computes the candidate `newHead` from the resolved direction.
  - Calls `checkWallCollision(newHead, GRID_SIZE)` first; on hit, invokes
    `gameOver()` and returns without mutating `snake` or drawing
    (we keep the last valid frame so the snake doesn't appear past
    the wall).
  - Builds the `newSnake` (grow on food, otherwise `moveSnake`).
  - Calls `checkSelfCollision(newSnake)` on the _next_ state; on hit,
    invokes `gameOver()` and returns without committing the move.
  - Only commits `snake = newSnake`, increments score, refreshes
    `#score`, and respawns food after both collision checks pass.
- Added `gameOver()` inside `startGame()`:
  - `clearInterval(intervalId)` + nulls the handle so `stop()` is a
    no-op afterward (idempotent teardown).
  - Sets `running = false`.
  - Re-uses the existing `#overlay` + `#overlay-message` elements:
    sets text to `Game Over — Score: ${score}` and unhides the panel.
- Score-on-eat was already wired in iteration 5 (`score += 1`,
  `renderScore()`) — no change needed for that step.

### Notes

- `food && checkFoodCollision(...)` was tightened to
  `food !== null && checkFoodCollision(...)` since `spawnFood()` can
  legitimately return `null` only when the snake fills the grid;
  using an explicit null check makes the intent clearer (`food` is
  always an object or `null`, never a falsy primitive).
- The restart button stays hidden — Task 6 (polish) owns the restart
  flow (`#restart` listener, snake/score/loop reset). Showing the
  button here would force half of Task 6's scope into Task 5.
- No new pure helpers were introduced, so no new tests were required.
  All seven existing `describe` blocks still cover the underlying
  collision functions; this iteration only changes the DOM-bound
  wiring inside `startGame()`, which is explicitly out of unit-test
  scope per plan.md ("What NOT to Test: Canvas rendering, DOM event
  handlers").

### Outcome

- Hitting any wall or running the head into the body now stops the
  game loop and displays `Game Over — Score: N` over the canvas.
- `game.js` exports unchanged; `game.test.ts` unchanged; `index.html`,
  `style.css`, `SNAKE.md`, `LEGAL_DISCLAIMER.md` untouched.
- Task complete — ready for Review Gate + CI push.

## 2026-05-18 - Iteration 7

### Task

Task 6 (polish): Add restart functionality and final polish — make the
existing Restart button work, allow SPACE to restart after game over,
fully reset game state (snake position/length, score, food, direction),
and document how to play in `src/README.md`. The initial "Press SPACE to
start" overlay was already in place from earlier iterations.

### Work performed

- `src/game.js`:
  - Picked up the existing `#restart` element from the DOM in
    `startGame()` (it was already in `index.html` but wired to nothing).
  - Added a `reset()` helper inside `startGame()` that: - Clears any running interval (so a click-during-play is safe). - Re-initialises `snake = createInitialSnake()`, `direction =
"right"`, `pendingDirection = "right"`, `food = spawnFood(...)`,
    `score = 0`. - Updates the score display, redraws the canvas, then calls
    `start()` to (re-)launch the loop. `start()` hides the overlay
    and the restart button.
  - `start()` now also `blur()`s the restart button before hiding it.
    Without this, a Restart click leaves the button focused, so the
    browser's default SPACE-activates-focused-button behaviour would
    re-fire the click handler on the next SPACE press during play.
  - `gameOver()` now unhides the restart button alongside the overlay.
  - SPACE in the keydown handler now calls `reset()` instead of
    `start()` when the game is not running, so it works for both the
    initial state and the post-game-over state. Arrow keys do the
    same when the game is not running, then apply the new direction.
  - Restart button click is wired to `reset()` via a
    `handleRestartClick` listener that the returned `stop()` also
    removes, so the cleanup path stays leak-free.
- `src/README.md` created: how-to-play instructions, controls table,
  file layout, and the list of exported pure helpers (mirrors
  `plan.md`'s "Game Logic Module Design" section so anyone reading the
  output folder can find the testable surface).

### Notes

- No new pure helpers were introduced, so no new tests were required.
  The restart wiring is DOM/event behaviour, explicitly excluded from
  unit-test scope by `plan.md` ("What NOT to Test: Canvas rendering,
  DOM event handlers").
- `index.html` and `style.css` were already prepared for the restart
  button (the `#restart` element exists; `.game__restart` and
  `.game__restart[hidden]` rules were styled in iteration 2). No
  changes needed there.
- `moveSnake`, `checkWallCollision`, `checkSelfCollision`,
  `checkFoodCollision`, `spawnFood`, `getNewDirection`,
  `createInitialSnake`, and `GRID_SIZE` exports are all unchanged.
- Verified by inspection (cannot run the browser): SPACE on initial
  overlay → game starts; arrow keys steer; wall/self collision →
  overlay shows `Game Over — Score: N` + Restart button; clicking
  Restart or pressing SPACE → snake / score / food / direction all
  reset and the loop resumes.

### Outcome

- Full game loop now works end-to-end: play → die → restart, both via
  button and via SPACE.
- New file: `src/README.md`. Modified: `src/game.js`. `game.test.ts`,
  `index.html`, `style.css`, `SNAKE.md`, `LEGAL_DISCLAIMER.md`
  untouched.
- Task complete — ready for Review Gate + CI push.

## 2026-05-18 - Iteration 8

### Task

Task 7 (finalization): Commit and push any remaining changes, verify CI passes,
and signal project COMPLETE.

### Work performed

- Verified the working tree: only `metrics.json` is modified, which is
  managed by the orchestrator (per the prompt rule: "Do NOT create git
  commits or push — the orchestrator handles all git operations").
- Confirmed CI pre-fetch shows pipeline #1205 is PASSING on
  `experiments/w_chunk-sidecars/iteration-5__w-chunk-sidecars-05__1.0.1`
  ("ci-workflow" — all workflows passed).
- Updated activity.md to record this finalization iteration and the
  iteration-8 CI status line.

### Notes

- Tasks 0–6 (HTML/canvas, styling, test infra, movement, food +
  collision, game over, restart polish) were all completed and pushed in
  prior iterations. CI has been green for every push since iteration 3.
- No source changes this iteration — Task 7 is purely a "verify and
  signal" step.

### Outcome

- All tasks done; CI is green on the latest pipeline. Signalling
  `<promise>COMPLETE</promise>`.
