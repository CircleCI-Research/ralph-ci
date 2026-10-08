# Project Build - Activity Log

## Current Status

**Last Updated:** 2026-05-15
**Tasks Completed:** 8 (all)
**Current Task:** Task 7 complete — finalization, CI verified green
**CI Status:** Pipeline #1169 PASSING — all workflows green, project COMPLETE

---

## CI Status Log

Record CI pipeline status at the start of each iteration here.

- 2026-05-15 — Iteration 1: NOT RUN (no pipelines found for branch)
- 2026-05-15 — Iteration 2: RUNNING (pipeline #1164, ci-workflow) — task 0 verifying
- 2026-05-15 — Iteration 3: PASSING (pipeline #1164, ci-workflow) — task 1 verified green
- 2026-05-15 — Iteration 4: PASSING (pipeline #1165, ci-workflow) — task 2 verified green
- 2026-05-15 — Iteration 5: PASSING (pipeline #1166, ci-workflow) — task 3 verified green
- 2026-05-15 — Iteration 6: PASSING (pipeline #1167, ci-workflow) — task 4 verified green
- 2026-05-15 — Iteration 7: PASSING (pipeline #1168, ci-workflow) — task 5 verified green
- 2026-05-15 — Iteration 8: PASSING (pipeline #1169, ci-workflow) — task 6 verified green, finalization

---

## Session Log

## 2026-05-15 - Iteration 1

### Task

Task 0 (setup): Create basic HTML structure and implement createInitialSnake

### Work performed

- Created `src/index.html` with HTML5 boilerplate, canvas (400x400), score
  display, game-over overlay with restart button, start message, and
  `<script type="module" src="game.js">` plus link to `style.css`
- Created `src/game.js` exporting `createInitialSnake()` — returns 3 segments
  at (10,10), (9,10), (8,10) in a horizontal line
- Created `src/game.test.ts` with 4 tests for `createInitialSnake`: length,
  head position, horizontal alignment with consecutive x, and segment shape

### Outcome

- Task complete — orchestrator will commit and push, Review Gate validates

## 2026-05-15 - Iteration 2

### Task

Task 1 (styling): Style the game with retro aesthetic

### Work performed

- Created `src/style.css` with retro arcade aesthetic
- Centered `#game-container` in the viewport via flexbox on `body`
- Dark background (`#0a0a0a` body, `#000` canvas, `#111` container) with
  neon-green (`#00ff41`) accents, glowing borders, and monospace font
- Styled `#score-display` (uppercase, spaced) with white score value
- Styled canvas with neon-green border and inset glow
- Styled `#game-over` as an absolutely-positioned centered overlay with red
  border/glow and `#restart-btn` (transparent → green-fill on hover/focus)
- Added blinking `#start-message` via `@keyframes blink`
- Defined `.hidden { display: none !important; }` so JS toggling works
- No game logic changed — existing `game.test.ts` unit tests remain valid

### Outcome

- Task complete — orchestrator will commit and push, Review Gate validates

## 2026-05-15 - Iteration 3

### Task

Task 2 (testing): Set up test infrastructure and write tests for moveSnake,
checkWallCollision, checkSelfCollision (the task wording says "failing tests
with stubs", but the Review Gate blocks any push when tests fail — so the
pragmatic path is to add the tests AND implement the functions in the same
iteration; task 3 already presupposes `moveSnake` works).

### Work performed

- Extended `src/game.test.ts` with three new `describe` blocks: `moveSnake`
  (right/left/up/down moves, length preservation, tail dropped, immutability),
  `checkWallCollision` (all 4 walls, interior, inclusive corners), and
  `checkSelfCollision` (straight snake, head-overlaps-body, single segment)
- Implemented `moveSnake(snake, direction)` in `src/game.js` — direction is a
  string ("up" | "down" | "left" | "right"); returns a new array (no mutation)
  with a new head and the tail dropped
- Implemented `checkWallCollision(head, gridSize)` — true when `head` is
  outside `[0, gridSize)` on either axis
- Implemented `checkSelfCollision(snake)` — true when the head shares
  coordinates with any body segment
- Added a shared `type Segment = { x: number; y: number }` alias in the test
  file to drop the repeated inline shapes
- No new dependencies; tests remain pure (no timers, no random, no DOM)

### Outcome

- Task complete — orchestrator will commit and push, Review Gate validates

## 2026-05-15 - Iteration 4

### Task

Task 3 (core): Implement snake movement and rendering — `moveSnake` already
landed in iteration 3, so this iteration adds `getNewDirection`, canvas
rendering, the game loop, and arrow-key controls.

### Work performed

- Added three `getNewDirection` tests in `src/game.test.ts`: perpendicular
  inputs pass through, 180-degree reversals are rejected (keeps current
  direction), and equal-direction inputs are no-ops
- Implemented `getNewDirection(current, input)` in `src/game.js` using an
  `OPPOSITES` map keyed by direction string
- Exported `GRID_SIZE = 20`, `CELL_SIZE = 20`, `TICK_MS = 150` constants
- Added `clearCanvas(ctx, w, h)` and `drawSnake(ctx, snake, cellSize)` —
  pure-render helpers that take a 2D context (decoupled from DOM lookup,
  so they're trivially mockable later)
- Added `startGame(canvas)` that owns the game state (snake, current and
  pending direction), wires a `keydown` listener that maps Arrow\* keys
  through `getNewDirection`, and starts a `setInterval` tick every 150ms
  that advances the snake one cell. Returns `{ stop }` so callers can
  tear it down deterministically (no real timers in tests — `startGame`
  is never invoked in the test suite)
- Added a browser-only autostart guard at module load: only runs when
  `typeof document !== "undefined"` and the canvas is an
  `HTMLCanvasElement`, so importing `game.js` from vitest does nothing
- Collision handling and game-over still deferred to tasks 4-5 per the
  plan — for now the snake just walks off the canvas if you let it

### Outcome

- Task complete — orchestrator will commit and push, Review Gate validates

## 2026-05-15 - Iteration 5

### Task

Task 4 (core): Implement food spawning and collision detection — add
`checkFoodCollision`, `spawnFood`, draw food on canvas in a different color,
grow the snake when food is eaten, and respawn food off the snake.
`checkWallCollision` and `checkSelfCollision` already landed in iteration 3.

### Work performed

- Extracted `nextHead(head, direction)` as a module-local helper so
  `moveSnake` and the new `growSnake` share one source of truth for the
  per-direction coordinate update
- Added `growSnake(snake, direction)` — returns `[newHead, ...snake]`,
  i.e., adds a head but keeps the entire tail; used after eating food
- Added `checkFoodCollision(head, food)` — head/food coordinate equality
- Added `spawnFood(gridSize, snake, random)` — picks a random unoccupied
  cell via injected `random()`; bounded by `maxAttempts = gridSize²`
  (Rule 2) so it can never hang even with a degenerate RNG
- Added `drawFood(ctx, food, cellSize)` — renders the food cell in
  neon-red `#ff0040`, contrasting with the neon-green snake
- Wired `startGame` to seed initial food via `spawnFood(GRID_SIZE, snake,
Math.random)`, render food before the snake each tick, and on tick:
  compute the moved snake, and if its new head is on the food, switch
  to `growSnake` and respawn food (passing the grown snake so the new
  food cannot land on the snake — including the just-added head)
- Added tests for `growSnake` (length+1, head moved, tail preserved,
  immutability), `checkFoodCollision` (match, x-differ, y-differ), and
  `spawnFood`:
  - in-bounds with `() => 0.1` → safe (2,2)
  - never lands on snake with `() => 0.25` → (5,5), not on snake
  - retries on collision with sequence `[0.5, 0.5, 0.1, 0.1]` → first
    attempt yields (10,10) which is the snake head, second yields
    (2,2). Asserts result is (2,2) and RNG was called exactly 4 times
- All fake RNGs follow Rule 1: traced the `Math.floor(value*gridSize)`
  math first and confirmed the chosen values do not collide with the
  snake fixture; no `() => 0.5` against a snake that occupies (10,10)

### Outcome

- Task complete — orchestrator will commit and push, Review Gate validates

## 2026-05-15 - Iteration 6

### Task

Task 5 (core): Implement game over logic — wire collision detection into the
game loop, stop the loop on collision, show the game-over overlay with the
final score, and update the score display when food is eaten. Restart is
explicitly deferred to task 6 (polish).

### Work performed

- Added pure `tickGameState(state, direction, gridSize, random)` to
  `src/game.js` so the entire per-tick transition is testable without DOM,
  timers, or real randomness. Branches:
  - `gameOver: true` → returns the same state object (no-op, so a stopped
    loop that fires once more is harmless)
  - wall collision OR self collision on the moved snake → returns
    `{ ...state, gameOver: true }` (score preserved so the overlay can show
    the final score)
  - food eaten → returns the grown snake, a respawned food, and
    `score + 1`
  - otherwise → returns `{ ...state, snake: moved }`
- Rewrote `startGame` around a single `state` object and `tickGameState`:
  - Looks up `#score`, `#game-over`, and `#final-score` (DOM-guarded) at
    start; missing elements are tolerated for headless / partial DOM tests
  - `tick()` advances state, renders, mirrors `state.score` into `#score`,
    and on `state.gameOver` calls `stop()` (clears the interval and removes
    the keydown listener) then sets `#final-score` and removes `.hidden`
    from `#game-over`
  - Initial render + `updateScore()` happen before the loop starts, so the
    score display is correct from frame 0
- Added six `tickGameState` tests in `src/game.test.ts`: normal advance,
  food-eaten (length+1, score+1, food respawned to a non-colliding cell via
  `() => 0.1`), wall collision sets gameOver and preserves score, self
  collision (constructed so the moved head lands on what was the last body
  segment), gameOver short-circuit, and input-immutability via JSON snapshot
- Fake RNGs follow Rule 1: `() => 0.1` → `Math.floor(0.1*20) = 2` → (2,2),
  which is never on any test snake fixture, so the `spawnFood` retry loop
  resolves on the first attempt
- Restart-button wiring is intentionally NOT included here — task 6 (polish)
  owns restart + reset + initial "press SPACE to start" state

### Outcome

- Task complete — orchestrator will commit and push, Review Gate validates

## 2026-05-15 - Iteration 7

### Task

Task 6 (polish): Add restart functionality and final polish — wire the
restart button, add a fresh-state factory used by both initial-load and
restart, gate the loop behind a "press SPACE to start" idle phase, and
write `src/README.md`.

### Work performed

- Added pure `createInitialState(gridSize, random)` to `src/game.js` —
  returns `{ snake: createInitialSnake(), food: spawnFood(...), score: 0,
gameOver: false }`. Single source of truth for both initial-load and
  restart, so neither path can drift from the other
- Added 3 tests for `createInitialState`: shape (snake, food off snake,
  score 0, gameOver false), independence across calls (mutating one state
  doesn't affect the next — the restart safety property), and food
  placement off the initial snake via injected RNG. All RNGs use 0.1
  (→ cell 2) or 0.25 (→ cell 5), neither colliding with the initial snake
  at (8..10, 10) — Rule 1 satisfied
- Rewrote `startGame` around a three-phase state machine —
  `"idle" | "running" | "gameOver"`:
  - At load: show `#start-message`, hide `#game-over`, render the initial
    snake/food + score, attach the keydown listener, but **do not** start
    the interval. Game is paused until the user opts in
  - Pressing SPACE in `idle` calls `startRunning()` → hides start
    message, hides game-over, kicks off `setInterval(tick, TICK_MS)`
  - Arrow keys are ignored unless `phase === "running"`, so stray presses
    before SPACE (or after game over) can't poison `pendingDirection`
  - On collision: `tick` stops the loop, flips phase to `gameOver`, sets
    `#final-score`, and unhides `#game-over`
  - Pressing SPACE OR clicking `#restart-btn` in `gameOver` calls
    `restart()`, which rebuilds state via `createInitialState`, resets
    direction to "right", re-renders, and re-enters `running`
  - `stop()` now also removes the restart-button click listener (so
    callers can fully tear down — used by tests indirectly via importing
    the module without ever invoking `startGame`)
- Extracted `show(el)` / `hide(el)` helpers (null-safe classList toggles)
  to dedupe the visibility flips across start/restart/game-over
- Created `src/README.md` with how-to-play instructions, controls,
  rules, project layout, and the test command — explicitly notes the
  SPACE-to-start and SPACE-or-Restart-button-to-restart flows
- No new dependencies. No real timers / random / I/O in tests (Rule 3)

### Outcome

- Task complete — orchestrator will commit and push, Review Gate validates

## 2026-05-15 - Iteration 8

### Task

Task 7 (finalization): Commit and push any remaining changes, verify CI passes.

### Work performed

- Verified `git status`: only `metrics.json` modified (auto-managed by the
  orchestrator's per-iteration metrics tracker, not a source change)
- Confirmed pre-fetched CI status: Pipeline #1169 on
  `experiments/w_chunk-sidecars/iteration-3__w-chunk-sidecars-03__1.0.1` is
  PASSING for ci-workflow with all workflows green
- Confirmed all 7 implementation tasks (indexes 0-6) in `tasks.json` are
  marked `passes: true` and have been individually CI-verified across
  pipelines #1164 through #1169
- No new source changes required — game is feature-complete: snake
  movement, food spawning, collision detection, scoring, game over,
  restart, idle "press SPACE" state, retro styling, and tests covering
  all pure logic (`createInitialSnake`, `moveSnake`, `getNewDirection`,
  `checkWallCollision`, `checkSelfCollision`, `checkFoodCollision`,
  `spawnFood`, `growSnake`, `tickGameState`, `createInitialState`)
- Updated activity.md status block + CI log to reflect finalization
- Per instructions, did not create commits or push (orchestrator owns git)

### Outcome

- All tasks complete, CI green on pipeline #1169 — signaling COMPLETE
