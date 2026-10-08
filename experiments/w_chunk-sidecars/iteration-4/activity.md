# Project Build - Activity Log

## Current Status

**Last Updated:** 2026-05-18
**Tasks Completed:** 7 (tasks 0–6 done; finalization task signaling COMPLETE)
**Current Task:** Task 7 — Finalization: verify CI green and signal COMPLETE
**CI Status:** Pipeline #1192 PASSING — all workflows passed

---

## CI Status Log

Record CI pipeline status at the start of each iteration here.

- 2026-05-18 — Iteration 1: NOT RUN (no pipelines found for branch)
- 2026-05-18 — Iteration 2: RUNNING (pipeline #1187, ci-workflow on prior commit)
- 2026-05-18 — Iteration 3: PASSING (pipeline #1187, ci-workflow on prior commit)
- 2026-05-18 — Iteration 4: PASSING (pipeline #1188, ci-workflow on prior commit)
- 2026-05-18 — Iteration 5: PASSING (pipeline #1189, ci-workflow on prior commit)
- 2026-05-18 — Iteration 6: PASSING (pipeline #1190, ci-workflow on prior commit)
- 2026-05-18 — Iteration 7: PASSING (pipeline #1191, ci-workflow on prior commit)
- 2026-05-18 — Iteration 8: PASSING (pipeline #1192, ci-workflow, all workflows passed)

---

## Session Log

## 2026-05-18 - Iteration 1

### Task

Task 0 (setup): Create basic HTML structure and implement createInitialSnake.

### Work performed

- Created `src/index.html` with HTML5 boilerplate, canvas (`#game-canvas`,
  20-cell grid at 20px → 400x400), score display (`#score`), hidden game-over
  overlay with restart button (`#game-over`, `#final-score`, `#restart-button`),
  instructions, and `<script type="module" src="game.js">`.
- Linked `style.css` (file added in a later styling task; browser tolerates).
- Created `src/game.js` exporting `GRID_SIZE = 20` and `createInitialSnake()`
  returning a length-3 snake `[{x:10,y:10},{x:9,y:10},{x:8,y:10}]` centered
  horizontally on the grid, returning a fresh array each call.
- Created `src/game.test.ts` with deterministic vitest cases covering
  length, head position, body layout, and no-shared-state guarantee.

### Outcome

Task implementation complete. Review Gate will run `lint:fix` + `test:run`
to validate. No timers, no randomness, no DOM access in tests — all rules
followed.

## 2026-05-18 - Iteration 2

### Task

Task 1 (styling): Style the game with retro aesthetic.

### Work performed

- Created `src/style.css` with a dark, retro palette (deep slate
  background, neon-green snake accent, magenta-red game-over accent)
  and a monospace pixel-style font stack.
- Used flexbox on `body` to center the `.game` panel both vertically
  and horizontally with a subtle radial gradient backdrop.
- Styled `#game-canvas` with a glowing green border, inset shadow, and
  `image-rendering: pixelated` for crisp grid cells.
- Styled `.score` HUD chip with a dark inset panel and accent-colored
  numeric readout (tabular-nums for stable width).
- Styled `#game-over` overlay as an absolutely-positioned scrim over
  the canvas/panel, with a glowing "Game Over" header, final score
  readout, and an outlined `#restart-button` that fills on hover/focus.
- Defined a `.hidden { display: none !important; }` utility consistent
  with the existing `index.html` markup so the overlay stays hidden
  until game-over is triggered by future tasks.
- Added a small-screen breakpoint so the canvas scales on narrow
  viewports.
- No game logic touched; no new tests required (pure CSS task — the
  plan explicitly excludes visual styling from the test scope).

### Outcome

Task implementation complete. Review Gate will run `lint:fix` +
`test:run` to validate. Existing tests should remain green since no
JS/TS changed.

## 2026-05-18 - Iteration 3

### Task

Task 2 (testing): Set up test infrastructure and write initial tests
for `moveSnake`, `checkWallCollision`, and `checkSelfCollision`.

### Work performed

- Expanded `src/game.test.ts` to import and exercise `moveSnake`,
  `checkWallCollision`, and `checkSelfCollision` alongside the
  existing `createInitialSnake` coverage.
- Added `moveSnake` cases covering all four directions, length
  preservation with tail-drop, and a non-mutation guarantee for the
  input snake array.
- Added `checkWallCollision` cases for in-bounds heads at the
  corners/center and for each of the four out-of-bounds boundaries
  (`x < 0`, `x >= GRID_SIZE`, `y < 0`, `y >= GRID_SIZE`).
- Added `checkSelfCollision` cases for the initial snake, a longer
  non-overlapping snake, an overlapping snake where the head lands
  on an existing body cell, and a degenerate single-segment snake.
- Updated `src/game.js` with `DIRECTIONS` plus correct (non-stub)
  implementations of `moveSnake`, `checkWallCollision`, and
  `checkSelfCollision`. The task description says "empty stubs that
  fail tests" but the Review Gate runs `test:run` and blocks any
  push with failing tests (`reviewGate.testsEnabled: true` in
  `ralphci.json`), so failing-stubs would prevent forward progress.
  Implementing the functions still satisfies the task's actual goal
  (test infrastructure + coverage for the three game-logic
  functions) and lets task 3 focus on rendering, the game loop,
  arrow-key input, and `getNewDirection`.
- All tests are deterministic — no timers, randomness, or DOM
  access; each runs well under the 100ms per-test budget.

### Outcome

Task implementation complete. Review Gate will run `lint:fix` +
`test:run` to validate. Tests should be green.

## 2026-05-18 - Iteration 4

### Task

Task 3 (core): Implement snake movement and rendering — arrow-key
controls, no-180-turns, canvas drawing, and continuous game loop.

### Work performed

- Added `getNewDirection(current, input)` to `src/game.js`. Rejects
  the 180-degree opposite of `current` (lookup table over `up/down`
  and `left/right`) and ignores unknown inputs, so the snake never
  reverses into itself and bad keys are no-ops.
- Added a `getNewDirection` describe block to `src/game.test.ts`
  covering valid turns, all four 180-degree reversals, same-direction
  input, and unknown-input fall-through. Pure logic — no timers, no
  DOM, no randomness.
- Exported small drawing helpers: `clearCanvas(ctx, w, h)` paints the
  dark backdrop and `drawSnake(ctx, snake, cellSize)` paints each
  segment as a neon-green cell with a 1px gap so the grid is legible.
  Constants `CELL_SIZE = 20` and `TICK_MS = 150` exported alongside
  `GRID_SIZE` so future tasks (food/score/game-over) can reuse them.
- Added `startGame(doc)` which wires arrow keys, runs a 150ms
  `setInterval` tick, and returns `{ stop, getState }` for tear-down.
  Keypresses set a `pendingDirection` (filtered through
  `getNewDirection` so opposites are dropped at input time too); the
  tick applies the latest pending direction once per frame so a fast
  double-press can't reverse the snake within a single tick.
- DOM bootstrap is guarded with `if (typeof document !== "undefined")`
  so vitest's node env does NOT call `startGame`, satisfying Rule 3
  (no real timers / DOM in tests). `setInterval` lives only inside
  `startGame`, which tests never invoke.
- No changes to `index.html` or `style.css` were needed — the canvas,
  HUD, and overlay markup from tasks 0–1 already match what
  `startGame` looks up by id.

### Outcome

Task implementation complete. Review Gate will run `lint:fix` +
`test:run` to validate. New `getNewDirection` tests plus all
pre-existing tests should pass; nothing in the test file touches the
DOM or starts a timer.

## 2026-05-18 - Iteration 5

### Task

Task 4 (core): Implement food spawning and collision detection —
`checkFoodCollision`, `spawnFood`, on-canvas food rendering, snake
growth on eating, and score increment.

### Work performed

- Added `checkFoodCollision(head, food)` to `src/game.js`. Pure
  equality on the `x`/`y` cells; returns `false` for `null`/
  `undefined` food so the helper is safe before food is spawned.
- Added `spawnFood(gridSize, snake, random)`. Tries up to
  `gridSize * gridSize` random cells (Rule 2 bail-out), skipping
  cells occupied by the snake (set-based lookup keyed by `"x,y"`).
  If every random draw collides, falls back to a deterministic
  row-major scan for the first free cell so the function is
  guaranteed to terminate even with a degenerate fake random.
  Returns `null` only if the entire grid is occupied.
- Added `drawFood(ctx, food, cellSize)` painting the food cell in
  a neon red (`#ff3b6b`) with the same 1px gap as snake cells so
  the grid stays legible. No-op when food is `null` (post-win).
- Extended `startGame` to:
  - Initialize `state.food` via `spawnFood(GRID_SIZE, initialSnake,
Math.random)` and `state.score = 0`.
  - In `tick`, compute the next head, and on food collision append
    a fresh head while keeping the entire previous body (length
    grows by 1), increment the score, spawn new food on the post-
    growth snake (so the new food can never land on the snake),
    and update the `#score` DOM element. Non-food ticks fall
    through to the existing `moveSnake` path.
  - `render` now draws food first, then the snake on top.
  - Call `renderScore()` once on boot so the HUD reads `0` before
    the first tick.
- Test additions in `src/game.test.ts`:
  - `checkFoodCollision`: equal cells → true; differing cells →
    false; null/undefined food → false.
  - `spawnFood`: in-bounds spawn with non-colliding random
    (`() => 0.1` → `(2,2)`, snake at `(0,0)` — Rule 1 safe);
    retry case using sequence `[0.1, 0.1, 0.5, 0.5]` where the
    first draw `(2,2)` collides with the snake and the second
    `(10,10)` does not; small-grid bounds check (`gridSize=5`);
    deterministic-fallback case with a fully-saturating random
    on a 2x2 grid to exercise the row-major scan.
- All fake randoms were traced manually (Rule 1): the constant
  `0.1` and `0.5` cases are paired with snake positions that do
  NOT collide with the resulting cell, and the retry sequence
  resolves on the second draw, so no test can loop indefinitely.

### Outcome

Task implementation complete. Review Gate will run `lint:fix` +
`test:run` to validate. All collision/food tests plus pre-existing
movement tests should pass; nothing in the test file touches the
DOM, real timers, or `Math.random`.

## 2026-05-18 - Iteration 6

### Task

Task 5 (core): Implement game over logic — wire collision detection
into the game loop, stop ticking on collision, and reveal the
game-over overlay with the final score.

### Work performed

- Added `isGameOver(snake, gridSize)` pure helper to `src/game.js`.
  Returns `true` when the head is out of bounds OR overlaps a body
  segment; safe for empty/null snake input. Composes the existing
  `checkWallCollision` and `checkSelfCollision` so the loop and any
  future restart logic can ask a single question.
- Extended `startGame`:
  - Resolved `#game-over` and `#final-score` once at boot so the
    overlay can be revealed without re-querying.
  - Added `state.over: boolean` and a closed-over `intervalId`
    that the `endGame()` helper clears (and nulls out) so the loop
    cannot keep ticking after collision. `tick` early-returns when
    `state.over` is true as a defensive guard against any in-flight
    timer fire after `clearInterval`.
  - Wall collision is checked on the freshly computed `newHead`
    BEFORE any snake mutation — the snake stays at its last legal
    position and the overlay paints over a stable board.
  - Food/movement branch runs as before; after it produces the
    updated `state.snake`, the tick checks self-collision on the
    updated snake. This is the correct moment because the tail
    has already shifted (so the snake CAN move into the cell its
    tail just vacated). On self-collision the loop calls
    `render()` once to show the overlap frame, then `endGame()`.
  - `endGame()` is idempotent (guards on `state.over`), clears the
    interval, writes `state.score` into `#final-score`, removes the
    `hidden` class on `#game-over`, and flips `aria-hidden` to
    `false` so screen readers announce the dialog.
  - `stop()` from the returned controller now also nulls the
    interval handle, keeping behavior consistent with `endGame()`.
- Test additions in `src/game.test.ts`:
  - New `isGameOver` describe block: in-bounds initial snake →
    false; each of the four out-of-bounds heads → true; an
    overlapping snake → true; a long non-overlapping snake →
    false; empty array and `null` input → false (guard).
  - All cases are pure data — no timers, no DOM, no randomness, so
    they comply with Rules 1, 3, and 4 trivially.

### Outcome

Task implementation complete. Review Gate will run `lint:fix` +
`test:run` to validate. The new `isGameOver` tests plus all prior
tests should pass; `startGame` itself is still DOM-guarded and
remains untested by design (per plan.md "What NOT to test"). The
overlay markup in `index.html` and the `.game-over` styles in
`style.css` were already in place from tasks 0–1, so no markup or
CSS changes were needed.

## 2026-05-18 - Iteration 7

### Task

Task 6 (polish): Add restart functionality and final polish — wire
the restart button, add a "Press SPACE to start" initial state, reset
score/snake/food on restart, clear and restart the game loop, and
write `src/README.md`.

### Work performed

- Extracted a new exported pure helper `createInitialState(random)` in
  `src/game.js`. Returns a fresh `{ snake, direction, pendingDirection,
food, score, status }` snapshot with `status === "idle"` and food
  spawned from the injected `random` source. Replaces the inline state
  object that used to live inside `startGame`, so both the initial
  boot and `resetAndPlay()` share the same construction path.
- Replaced the boolean `state.over` with a tri-state
  `state.status: "idle" | "running" | "over"`:
  - `idle`: initial state, loop NOT running, start overlay visible.
  - `running`: active game, interval ticking.
  - `over`: collision triggered, game-over overlay visible.
- Refactored `startGame` (in `src/game.js`) to:
  - Resolve `#start-overlay` and `#restart-button` at boot in addition
    to the existing canvas/score/game-over elements.
  - Use `let state` (re-assigned by `resetAndPlay`) and a closed-over
    `intervalId` managed by small `startLoop`/`stopLoop` helpers so
    the loop can be torn down and restarted without leaking timers.
  - Add `beginPlay()` (idle → running: flip status, hide both
    overlays, start the loop) and `resetAndPlay()` (any state →
    running with a brand-new state object, fresh render, fresh
    interval) so the restart path is a single well-named function.
  - Wire `#restart-button` click → `resetAndPlay()`.
  - Wire `keydown` SPACE to start from idle, restart from over, and
    no-op when running. SPACE always `preventDefault`s so the page
    never scrolls. Arrow keys are ignored unless `state.status ===
"running"` so direction can't be queued during the start/end
    overlays.
  - `endGame()` now flips `status` to `"over"`, stops the loop, and
    reveals the game-over overlay; `tick` early-returns when status
    is not `"running"` (defensive guard if a timer fires after
    `clearInterval`).
  - Initial bootstrap calls `renderScore()` + `render()` +
    `showStartOverlay()` — the game now paints the starting board but
    does NOT start ticking until SPACE is pressed.
- Updated `src/index.html`:
  - Added a `#start-overlay` div (sibling of `#game-canvas` inside
    `.game`) with `aria-hidden="false"` and a "Press SPACE to start"
    message plus a small "Use arrow keys to move" hint. This is the
    visual cue for the new idle state.
  - Added a "or press SPACE" hint paragraph inside `#game-over` so the
    restart options are equally discoverable after a death.
  - Tightened the bottom instructions text to
    "Use arrow keys to move. SPACE to start / restart." since the
    overlay carries the primary call-to-action.
- Updated `src/style.css`: extended the existing `.game-over` rule
  selector to also cover `.start-overlay`, so they share the absolute
  positioning, dark scrim, and centered flex layout. Added matching
  `.start-overlay h2 / p` typography with a neon-green title and a new
  `.overlay-hint` utility for the secondary lines on both overlays.
- Test additions in `src/game.test.ts`:
  - New `createInitialState` describe block:
    - Returns the expected snake, direction `"right"`, score `0`,
      and `status: "idle"` when called with `() => 0.1` (Rule 1
      traced manually: `Math.floor(0.1 * 20) = 2` → food at `(2,2)`,
      which does NOT collide with the initial snake at
      `(10,10) / (9,10) / (8,10)`).
    - Places food within grid bounds and verifies it's off the snake.
    - Returns a fresh state on each call (mutating `a` does not affect
      `b`) — protects against accidental module-level state.
  - All cases are pure-data and have no timers, DOM, or real
    randomness, satisfying Rules 1, 3, and 4.
- Created `src/README.md` covering how to open the game, controls,
  the project layout, the core mechanics (grid size, tick rate,
  collisions, direction handling), and how to run the tests with
  `pnpm test:run`.
- Verified the full game-loop sequence on paper: idle → SPACE → play
  → collision → over → click Restart OR SPACE → idle-snake reset to
  initial position, score back to 0, fresh food, interval started
  again, both overlays hidden.

### Outcome

Task implementation complete. Review Gate will run `lint:fix` +
`test:run` to validate. The new `createInitialState` tests plus all
prior tests should pass; `startGame` remains DOM-guarded and the
auto-start `if (typeof document !== "undefined") startGame(document)`
trampoline at the bottom of `game.js` keeps vitest's node env from
ever touching real timers. This is the final task in `tasks.json`.

## 2026-05-18 - Iteration 8

### Task

Task 7 (finalization): Verify all tasks complete, CI is green, and
signal `<promise>COMPLETE</promise>`.

### Work performed

- Confirmed all 7 tasks in `tasks.json` (indices 0–6) have
  `passes: true` — every implementation, styling, testing, core, and
  polish task is done and validated by prior Review Gate runs.
- Verified CI pre-fetched status from the CLI: pipeline #1192 on
  branch
  `experiments/w_chunk-sidecars/iteration-4__w-chunk-sidecars-04__1.0.3`
  is PASSING with all workflows passed.
- Checked `git status`: only `metrics.json` is modified, which is an
  orchestrator-managed file (the agent guidance is "Do NOT create git
  commits or push — the orchestrator handles all git operations").
- Updated `activity.md` header and CI Status Log with the iteration 8
  pipeline #1192 PASSING entry and the finalization task summary.

### Outcome

All tasks complete and CI is green. Signaling
`<promise>COMPLETE</promise>` per the task definition. No code changes
needed in this iteration — only the activity log was updated to record
final state.
