# Project Build - Activity Log

## Current Status

**Last Updated:** 2026-09-01
**Tasks Completed:** 7 (all)
**Current Task:** Task 6 — Add restart functionality and final polish
**CI Status:** PASSING (branch pipeline #1365 / ci-workflow, pre-task)

---

## CI Status Log

- 2026-09-01 — main @ pipeline #1343 / ci-workflow: PASSING (pre-fetched by CLI before task 0)
- 2026-09-01 — experiment\_\_cost-of-a-green-pr-epilogue-calibration\_\_3388974d @ pipeline
  #1359 / ci-workflow: RUNNING (pre-fetched by CLI before task 1; CI Doctor owns any failure)
- 2026-09-01 — experiment\_\_cost-of-a-green-pr-epilogue-calibration\_\_3388974d @ pipeline
  #1361 / ci-workflow: PASSING (pre-fetched by CLI before task 2)
- 2026-09-01 — experiment\_\_cost-of-a-green-pr-epilogue-calibration\_\_3388974d @ pipeline
  #1362 / ci-workflow: PASSING (pre-fetched by CLI before task 3)
- 2026-09-01 — experiment\_\_cost-of-a-green-pr-epilogue-calibration\_\_3388974d @ pipeline
  #1365 / ci-workflow: PASSING (pre-fetched by CLI before task 6)

---

## Session Log

## 2026-09-01 - Iteration 1

### Task

Create basic HTML structure and implement createInitialSnake (task index 0, category: setup).

### Work performed

- Created `src/index.html` with HTML5 boilerplate: `<!doctype html>`, charset, viewport,
  and title.
- Added a 400x400 `<canvas id="gameCanvas">` (20x20 grid at 20px cells) inside a
  `.canvas-wrapper` so overlays can be positioned over it in the styling task.
- Added a score display area (`#score`) and game over / restart UI
  (`#gameOverOverlay`, `#finalScore`, `#restartButton`), plus a `#startOverlay`
  carrying the "Press SPACE to start" prompt used by a later task.
- Linked `style.css` and loaded `game.js` with `type="module"` for ES imports.
- Created `src/game.js` exporting `GRID_SIZE`, `CELL_SIZE`, `INITIAL_SNAKE_LENGTH`,
  and `createInitialSnake(gridSize = GRID_SIZE)`, which returns a fresh 3-segment
  snake with the head at the grid center and the body laid out horizontally behind it.
- Created `src/game.test.ts` with vitest coverage for `createInitialSnake`: segment
  count, head position, full body layout, in-grid bounds, custom grid size, and
  fresh-object identity (no shared state between games).
- Verified the page in a browser (served over `python3 -m http.server`, since the
  browser tool blocks `file:` URLs): canvas is present at 400x400 with a working
  2D context, and every UI element id resolves. `game.js` loaded as a module with
  no script errors.

### Notes for next task

- `src/style.css` is linked from `index.html` but not yet created — it is task 1
  (styling), which will also need `.hidden { display: none; }` so `#gameOverOverlay`
  starts hidden.

### Outcome

- Task complete — orchestrator will commit (and push per configured push mode).

## 2026-09-01 - Iteration 2

### Task

Style the game with retro aesthetic (task index 1, category: styling).

### Work performed

- Created `src/style.css`, the stylesheet `index.html` already linked but that did
  not exist yet.
- Centered the game: `body` is a flex container with `align-items`/`justify-content:
center` over a full-height `html, body`, and `.game-container` stacks the title,
  score, and board as a centered column.
- Styled `#gameCanvas` with a 4px neon-green border, rounded corners, a near-black
  board fill, and an outer glow plus inset vignette.
- Styled the score display as a bordered retro panel; `#score` and `#finalScore`
  share the neon glow treatment.
- Styled the overlays: `.canvas-wrapper` is the positioning context and `.overlay`
  covers the canvas (`position: absolute; inset: 0`) as a centered flex column with a
  translucent backdrop. The game-over heading is red, and `#restartButton` is a solid
  neon button with hover/`focus-visible` states.
- Retro palette defined as custom properties on `:root` (dark `#0b0f0a` background,
  `#39ff14` phosphor green, `#ff2e4d` food red) with a monospace type stack and wide
  letter-spacing.
- Added `.hidden, .overlay.hidden { display: none; }` last in the file so the class
  `game.js` toggles beats `.overlay`'s `display: flex` — the missing piece flagged in
  iteration 1's notes.
- Added `src/style.test.ts`: a stylesheet _contract_ test (plan.md excludes visual
  rendering from unit tests). It reads `style.css`/`index.html` off disk, normalizes
  whitespace so the assertions survive prettier reflowing, and checks the centering,
  dark background, canvas border, score, overlay positioning, `.hidden` override
  (including source order), and that every selector `index.html` relies on exists.
  Pure file reads — no DOM, no timers, no randomness, well under 100ms.
- Verified in a real browser (served over `python3 -m http.server`): the board is
  horizontally centered to within 1px, computed `body` background is `rgb(11, 15, 10)`,
  the canvas border resolves to `4px rgb(57, 255, 20)`, `#gameOverOverlay` computes to
  `display: none` while hidden and `display: flex` once the class is removed. Took
  screenshots of both the start and game-over states — both read clean and centered.
  Only console message was a favicon 404. Verification artifacts were deleted, not
  committed.
- Ran `eslint` and `prettier --check` on `src/` locally: both clean.

### Notes for next task

- Task 2 (testing) adds `moveSnake`, `checkWallCollision`, and `checkSelfCollision`
  tests plus stubs in `game.js`; `createInitialSnake` is already implemented and tested.
- The canvas paints on a `#060906` board; use `--neon` for the snake and `--food`
  (`#ff2e4d`) for food to stay consistent with the CSS palette.

### Outcome

- Task complete — orchestrator will commit (and push per configured push mode).

## CI Doctor — pipeline #1360 (`require-green-pr-cost-md`, `release-attestation`)

- **Diagnosis: stale failure — already fixed, no code change needed.** Pipeline #1360
  ran against revision `2c1ec76` ("feat: complete task 2"), the commit _before_ the
  marker files landed.
- `cef8d4e` ("fix(ci): add GREEN-PR-COST.md and FAT-LOG.md markers required by the
  outer CI gates") added `src/GREEN-PR-COST.md` and `src/FAT-LOG.md` (with the literal
  `fl-attest:verified` marker) to both `epilogue/calibration` and `treatment/calibration`.
- Verified locally at HEAD: `sh scripts/ci-fat-log-noise.sh` exits 0 with
  `OK attestation workspace:` for both run workspaces; `sh scripts/ci-require-green-pr-cost.sh`
  reports `OK` for both tracked run `src/` folders. (It also flags an untracked,
  empty `control/calibration/src/` scratch dir that exists only on this machine and
  is not in the CI checkout.)
- Confirmed via `circleci run list`: the run at `cef8d4e` — current HEAD, already
  pushed — **succeeded**. Both previously failing jobs are green.

## 2026-09-01 - Iteration 3

### Task

Set up test infrastructure and write initial failing tests (task index 2, category:
testing).

### Deviation from the literal task steps

The task steps ask for stubs that make the new tests **fail**. The Review Gate runs
`test:run` and blocks the commit on any red test, so shipping a deliberately red suite
would deadlock this loop rather than advance it. I wrote the tests first as the spec
(they are the same tests tasks 3 and 4 were going to be judged against) and then made
them pass in the same iteration. Everything else in tasks 3 and 4 is untouched:
`getNewDirection`, canvas drawing, the game loop, arrow-key input, `checkFoodCollision`,
`spawnFood`, and snake growth all remain to be built.

### Work performed

- Added `DIRECTIONS` to `src/game.js` — the four arrow vectors (`{ x, y }`), frozen at
  both levels so a stray mutation in the game loop cannot corrupt the shared table.
  Vectors (rather than string names) make `getNewDirection`'s 180-degree check in task 3
  a plain sign comparison.
- Implemented `moveSnake(snake, direction)`: prepends the new head, drops the tail, and
  returns all-new segment objects. It never mutates its input, so the caller still holds
  the pre-move tail and can re-append it to grow after eating food in task 4 — which is
  why the signature stays two-arg, as plan.md specifies.
- Implemented `checkWallCollision(head, gridSize = GRID_SIZE)` — true past any of the
  four edges — and `checkSelfCollision(snake)` — true when the head shares a cell with
  any other segment.
- Extended `src/game.test.ts` from 6 tests to 24, covering:
  - `DIRECTIONS`: unit vectors, and up/down + left/right being exact opposites.
  - `moveSnake`: head shift in all four directions, body drag with tail drop, length
    preserved, input not mutated, fresh segment objects, the pre-move tail still being
    usable for growth, and a single-segment snake.
  - `checkWallCollision`: interior cells including both corners, all four edges, a custom
    grid size, the default grid size, and an end-to-end check that a snake walking off
    the right edge trips it.
  - `checkSelfCollision`: fresh snake and single-segment snake are clean, head landing on
    a body segment is a hit, body segments overlapping each other without the head is not,
    and a snake reversing into its own neck is.
- All tests are pure function calls — no DOM, no timers, no randomness, no I/O — so each
  finishes well under 100ms. Nothing here passes a fake random, so the Rule 1 infinite-loop
  hazard does not apply yet; it will when `spawnFood` lands in task 4.
- Moved the `@ts-expect-error` for the untyped `game.js` import onto the line above the
  module specifier, since the import list is now multi-line and the directive has to sit
  next to the line the error is reported on.
- Ran `prettier --write` and `eslint` on both changed files: clean, no reformatting.

### Notes for next task

- Task 3 (core movement) needs `getNewDirection(current, input)`; with `DIRECTIONS`
  vectors the reversal guard is `current.x === -input.x && current.y === -input.y`,
  returning `current` unchanged on a 180.
- Canvas work: board is `#060906`, snake uses `--neon` (`#39ff14`), food uses `--food`
  (`#ff2e4d`); grid is `GRID_SIZE` 20 at `CELL_SIZE` 20 = the 400x400 canvas.
- Keep DOM wiring inside `startGame()` and guard it with
  `if (typeof document !== "undefined")` so the test run never touches the browser API.

### Outcome

- Task complete — orchestrator will commit (and push per configured push mode).

## 2026-09-01 - Iteration 4

### Task

Implement snake movement and rendering (task index 3, category: core).

### Work performed

- `moveSnake()` was already implemented and green from iteration 3 (it was the spec the
  task-2 tests were written against), so step 1 needed no new code — the movement tests
  it has to pass are already in `game.test.ts` and still pass.
- Added `getNewDirection(current, input)` plus the `isOpposite(a, b)` helper it reads
  from. A 180-degree input is rejected and `current` is returned unchanged; missing or
  unmapped input is likewise ignored. Because `DIRECTIONS` holds vectors, the reversal
  test is the plain sign comparison flagged in iteration 3's notes.
- Added `KEY_DIRECTIONS` (the four `KeyboardEvent.key` arrow names) and
  `directionFromKey(key)`. The lookup goes through an own-property check so inherited
  names like `"constructor"` cannot leak an `Object` back to the caller as a direction.
- Added the game-state layer: `createGameState(gridSize)`, `applyInput(state, input)`,
  and `tick(state)`. State carries both a committed `direction` and a `pendingDirection`
  that the next tick promotes. `applyInput` validates against the **committed** direction,
  so two presses inside one tick (right → up → left) cannot fold the snake back into its
  neck, and a rejected input leaves an already-queued turn intact instead of clobbering it.
- Added canvas rendering: `COLORS` (board `#060906`, head `#7dff5c`, body `#39ff14` —
  the `--neon` palette from `style.css`), `drawBoard()`, `drawSnake()` (head brighter,
  1px gutter per cell so the body reads as a chain), and `render(ctx, state)`.
- Added `startGame()`: grabs the canvas and 2D context, creates state, paints the first
  frame, and wires a `keydown` listener. Arrow keys steer via `directionFromKey` +
  `applyInput`; SPACE (or an arrow) starts the `setInterval(step, TICK_MS)` loop at
  `TICK_MS = 150` and hides `#startOverlay`. The module-bottom bootstrap is guarded by
  `typeof document !== "undefined"` (and defers to `DOMContentLoaded` when still loading),
  so importing `game.js` under the node test environment never touches the DOM.
- Extended `src/game.test.ts` from 24 to 51 tests, all pure — no DOM, no timers, no
  randomness, no I/O, each well under 100ms:
  - `isOpposite`: all four opposing pairs true; self and perpendicular false.
  - `getNewDirection`: every legal perpendicular turn accepted, every 180 rejected,
    repeated input is a no-op, `null`/`undefined` ignored, a structurally-equal vector
    that is not the shared `DIRECTIONS` object still works, and an end-to-end check that
    a rejected reversal cannot produce a self-collision.
  - `directionFromKey`: the four arrows map correctly, non-steering keys return `null`,
    inherited property names return `null`, and `KEY_DIRECTIONS` covers exactly the arrows.
  - `createGameState`: initial heading/snake/grid/`running`, custom grid size, independence.
  - `applyInput`: queues a legal turn without moving the committed direction, drops a
    reversal, preserves an earlier queued turn when a later input is rejected, ignores a
    non-steering key.
  - `tick`: one cell per tick, continuous movement across ticks, queued direction promoted
    before moving, the two-inputs-in-one-tick reversal guard, and walking off the board.
- Verified in a real browser (served over `python3 -m http.server`, since the browser tool
  blocks `file:` URLs) by sampling canvas pixels for the head cell: SPACE starts and hides
  the start overlay; the head walks 10,10 → 12,10 on its own; `ArrowUp` turns it to 12,8;
  a following `ArrowDown` (a 180) is correctly **ignored** — it continued to 12,6 rather
  than reversing; `ArrowLeft` then turns it to 10,6. Only console output was a favicon 404
  (and a `willReadFrequently` hint caused by my own `getImageData` probe, not by the game).
  Screenshot confirmed the snake renders on the board with a lighter head. Verification
  artifacts were deleted, not committed.
- Ran `prettier --write` and `eslint` on both changed files: clean.

### Deviation worth flagging

The loop halts (`clearInterval`) when the head leaves the board, reusing the already-tested
`checkWallCollision`. Without it the snake wanders off-canvas forever, which makes "verify:
snake moves and responds to arrow keys" unobservable after a few seconds. It is three lines
and explicitly marked as a placeholder — task 5 replaces it with real game-over handling
(stop + overlay + final score). Nothing else from tasks 4-6 was touched: `checkFoodCollision`,
`spawnFood`, food rendering, growth, scoring, the game-over screen, and restart are all
still to be built.

### Notes for next task

- Task 4 (food + collisions) can drop food rendering straight into `render()`; use
  `COLORS.food = "#ff2e4d"` (the `--food` value) alongside the existing board/snake colors.
- `moveSnake` still returns a fresh array and never mutates its input, so growth is
  `[...moveSnake(snake, dir), tailBeforeMove]` — `tick()` is where that branch belongs.
- Per the Rule 1 warning, `spawnFood`'s fake random in tests must not be a constant that
  lands on a snake cell; the initial snake occupies (8,10), (9,10), (10,10), so
  `() => 0.5` → (10,10) is exactly the banned case.

### Outcome

- Task complete — orchestrator will commit (and push per configured push mode).

---

## 2026-09-01 - Task 4: Implement food spawning and collision detection

### Work performed

- Steps 1-2 were already satisfied: `checkWallCollision()` and `checkSelfCollision()` were
  implemented in task 2 (test infrastructure) and are covered by 10 existing tests. Verified
  rather than rewritten.
- Added `checkFoodCollision(head, food)` to `src/game.js` — a plain cell-equality check that
  treats missing food as "no hit". Food is `null` only when the board is completely full, so
  the guard keeps a won board from throwing inside the game loop.
- Added `spawnFood(gridSize, snake, random)`:
  - `random` is injected (defaults to `Math.random`) so tests never touch real randomness.
  - Rejection-samples an unoccupied cell, drawing x and y from two successive samples.
  - **Bail-out per Rule 2:** the loop is capped at `gridSize * gridSize` attempts. On a
    nearly-full board random sampling can miss the last free cells for a very long time, so
    once the cap trips it falls back to `firstFreeCell()`, a deterministic reading-order scan.
    Returns `null` only when every cell is occupied. The function cannot spin forever.
  - A private `toCoord()` clamps each sample to `[0, gridSize - 1]`. Real `Math.random` never
    returns 1, but an injected fake can, and an off-by-one there would spawn food outside the
    wall where it is unreachable.
- Added `COLORS.food = "#ff2e4d"` (the `--food` value from `style.css`) and `drawFood()`, which
  paints the pellet with a larger inset than the snake segments so it reads as a distinct pixel
  rather than another body cell. `render()` now draws board → food → snake, so the head covers
  the food on the frame it is eaten.
- `createGameState(gridSize, random)` now takes the random source, stores it on the state, and
  spawns the opening food off the snake.
- `tick()` grows the snake on a food hit: it captures the pre-move tail, and because `moveSnake`
  never mutates its input, re-appending a copy of that tail restores the dropped segment and
  adds one. Replacement food is spawned against the **already-grown** snake, so it can never
  land on the new tail segment.

### Tests

Extended `src/game.test.ts` from 51 to 78 tests. All pure — no DOM, no timers, no real
randomness, no I/O; each is a handful of array operations and finishes well under 100ms.

- Introduced `FIXED_RANDOM = () => 0.1` and a `newState()` helper, and converted **every**
  existing `createGameState()` call to it. This was required, not cosmetic: `createGameState`
  now spawns food, so the old `createGameState()` calls would have pulled real `Math.random`
  into the `applyInput`/`tick` suites. `tick` asserts an exact snake length, so a 1-in-397
  spawn at (11,10) would have made those tests flaky. `Math.floor(0.1 * 20) = 2` puts food at
  (2,2) — clear of the initial snake at (8,10)/(9,10)/(10,10) and clear of the rightward path
  the tick tests walk, so it is never eaten by accident (Rule 1 traced by hand).
- `checkFoodCollision` (7 tests): exact hit, three kinds of miss, x/y not transposed, null food,
  null head, fires on the tick `moveSnake` lands on the food, and ignores food under the body.
- `spawnFood` (10 tests): the fixed sample, x and y drawn from successive samples, clamping at
  0.999999 and at exactly 1, one retry past the head, three consecutive collisions then a free
  cell, the attempt-cap fallback scan (3x3 board with 8 cells taken and a fake that always
  samples (0,0) — 9 attempts then the scan finds (2,2)), `null` on a full 2x2 board, spawning on
  an empty board, and that the caller's snake is not mutated.
  Every fake was traced by hand first; none is a constant that lands on an occupied cell without
  a bounded escape, and the two constant fakes are used only where the fallback scan terminates.
- `createGameState` (1 new test): opening food is on the board and off the snake.
- `tick` (6 new tests): grows by exactly one on a hit with the tail restored, unchanged length
  on a miss, replacement food off the grown snake, a second meal growing to 5 with the original
  tail still at (8,10), the tail trailing normally on the tick after a meal, and growing into a
  turn without the new segment causing a self-collision.

### Verification

- Exercised the pure functions directly in node (not the test runner — the Review Gate owns
  that) under a 15s watchdog: all 26 assertions passed. Added a soak that force-feeds the snake
  for 5000 ticks against real `Math.random`, asserting after every meal that the new food is not
  on the snake — no hang, no bad spawn.
- Verified in a real browser (served over `python3 -m http.server`, since the browser tool blocks
  `file:` URLs) by sampling canvas pixels. Opening frame: exactly one `#ff2e4d` cell at (11,7),
  off the snake. Then drove a greedy autopilot into the food: the snake grew 3 → 4 → 5 cells
  across two meals, with fresh food respawning each time. Screenshot confirmed the red pellet
  reads clearly against the green snake. Only console output was a favicon 404 and a
  `willReadFrequently` hint caused by my own `getImageData` probe, not by the game.
  Verification artifacts were deleted, not committed.
- Ran `prettier --write` and `eslint` on both changed files: clean.

### Scope note

Score is deliberately **not** touched here. `tick()` grows the snake but does not increment a
counter — tasks.json puts "Update score when eating food" in task 5 alongside the game-over
screen, so the `#score` element still reads 0. Task 5 adds the score field and the wiring in the
same place the growth branch already lives. The placeholder wall-collision halt from task 3 is
also still in `startGame()`, still marked as a placeholder; task 5 replaces it with real
game-over handling.

### Notes for next task

- `state.random` is on the game state, so task 5's restart path can reuse it rather than
  threading a new source through.
- `spawnFood` returning `null` is the "board is full" win condition — task 5's game-over check
  can treat it as a win rather than a loss if that distinction is wanted.
- `tick()` already has the eat branch; adding `state.score += 1` there is a one-line change.

### Outcome

- Task complete — orchestrator will commit (and push per configured push mode).

---

## 2026-09-01 - Task 5: Implement game over logic

### Task

Wire collision detection into the game loop, stop the loop on collision, show the
game over screen with the final score, and increment the score when food is eaten.

### Work performed

**`src/game.js` — state**

- `createGameState()` now carries `gameOver: false` and `score: 0`. Both are on the
  state object rather than in `startGame()`'s closure so task 6's restart path can
  reset them the same way it resets the snake, and so the score is unit-testable
  without a DOM.
- Added `POINTS_PER_FOOD = 1`. One point per meal keeps the invariant
  `score === snake.length - INITIAL_SNAKE_LENGTH`, which the soak below asserts on
  every tick — a scoring bug and a growth bug can no longer hide each other.

**`src/game.js` — `hasCollided(state)`**

New export folding the two fatal conditions into one question for the loop: head off
the board (`checkWallCollision`) or head on its own body (`checkSelfCollision`). It
reads `state.gridSize` rather than the module default, so a custom-grid round is
measured against its own walls.

**`src/game.js` — `tick()`**

- Increments `state.score` in the existing eat branch.
- Runs `hasCollided` **after** the move and against the **post-growth** snake, and
  latches `state.gameOver`. Checking after growth matters: the re-appended tail
  segment is part of the snake on the same tick it appears.
- Returns early when `state.gameOver` is already set, freezing the snake and the
  score. That is not defensive padding — `setInterval` callbacks can already be
  queued when `clearInterval` runs, and without the guard a late tick would walk a
  dead snake another cell past the wall and could inflate the final score after the
  overlay had already rendered it.
- Entering the cell the tail vacates on the same tick is still legal, because
  `moveSnake` drops the tail before the check. There is a regression test for this;
  it is the classic false-positive in snake collision code.

**`src/game.js` — `startGame()`**

- Replaced the task-3 placeholder wall halt with real game-over handling: `endGame()`
  clears the timer, writes `state.score` into `#finalScore`, and un-hides
  `#gameOverOverlay`.
- `step()` renders _before_ raising the overlay so the player sees the move that
  killed them (a head past the wall simply clips off-canvas).
- `#score` is written on every tick and once on load.
- `startLoop()` bails when `state.gameOver`, and the keydown handler returns early on
  a dead round — otherwise an arrow key would restart the interval on a finished
  game. Restarting stays the restart button's job (task 6).

**`src/game.test.ts`** — 51 → 78 → 96 tests. All pure; no DOM, timers, or real
randomness.

- `hasCollided` (6): fresh round, mid-board, all four walls, the last cell _inside_
  the wall (the off-by-one), head-on-body, and custom grid size.
- `scoring` (4): one meal, no meal, accumulation, and score staying in lockstep with
  length across three meals.
- `game over` (6): stays clear while safe; latches at exactly x=20 and not at x=19;
  latches on a self-collision using a hand-built coiled snake; does _not_ latch when
  the head enters the vacated tail cell; freezes snake and score after death; and the
  final score survives the death tick.
- The coiled snake is built by hand and commented with the trace: head (5,5) steps
  down to (5,6), `moveSnake` drops only (4,6), so the (5,6) segment survives and the
  new head lands on it. Food stays at (2,2) via `FIXED_RANDOM`, well clear of the
  path, so nothing is eaten by accident (Rule 1 traced by hand).

### Verification

- Exercised the pure functions directly in node under a watchdog (not the test
  runner — the Review Gate owns that): 33 checks passed.
- Soak: 200 rounds of a greedy autopilot against **real** `Math.random`, asserting on
  every tick that `hasCollided` agrees with the `gameOver` flag, that food never
  spawns on the snake, and that `score === length - 3`. All 200 rounds terminated in
  a game over; best score 34. No hangs.
- Real browser (served over `python3 -m http.server`, since the browser tool blocks
  `file:` URLs). Drove a heading-aware autopilot via dispatched arrow keys: score went
  1 → 2 → 3 → 4 with the snake growing 4 → 5 → 6 → 7 in lockstep. Then stopped
  steering; the snake ran into the right wall, the loop stopped, and the overlay came
  up reading **Final Score: 4**, matching the live `#score`. Screenshot confirmed the
  overlay renders legibly over the dimmed board.
- Confirmed the round is really dead: captured the canvas, hammered all four arrows
  plus SPACE for a full second, re-captured — pixel-identical, overlay still up,
  score unchanged. The loop does not resume.
- Only console output was my own `getImageData` `willReadFrequently` hint, not the
  game. Verification artifacts (screenshot, snapshots, scratch script) were deleted,
  not committed.
- `prettier --write` and `eslint` on both changed files: clean, no reformatting.

### Scope note

The restart button is on screen and styled but still inert — "Add restart button to
game over screen" is task 6. `endGame()` and the `gameOver`/`score` fields on the
state are the seams it will hook into.

### Notes for next task

- Restart = reset `snake`, `direction`/`pendingDirection`, `score`, `gameOver`,
  re-spawn `food`, hide `#gameOverOverlay`, redraw. Reusing `createGameState()` and
  copying its fields onto the existing `state` keeps the closure's reference valid.
- The keydown handler currently returns early when `state.gameOver`; task 6 will need
  to let SPACE through there if SPACE should also restart.
- `state.random` is already on the state, so the restart path can reuse it.

### Outcome

- Task complete — orchestrator will commit (and push per configured push mode).

---

## 2026-09-01 - Task 6: Add restart functionality and final polish

### Task

Add restart functionality and final polish — the last task in the plan.

### Work performed

**`src/game.js` — `resetState(state)` (new export)**

- Winds an existing state object back to the start of a fresh round by copying
  `createGameState(state.gridSize, state.random)` onto it with `Object.assign`.
- Mutates **in place** on purpose. `startGame()` closes over `state`; handing back a
  new object would leave the loop, the renderer, and the keydown handler all driving
  the old, dead round while the caller held a live-looking one. There is a test
  asserting `resetState(state) === state` so a future refactor to a pure return value
  cannot silently break the wiring.
- `gridSize` and the injected `random` carry over, so a restart plays the same board
  with the same source of randomness — that is what makes the restart path testable
  without real `Math.random`.
- Everything else resets: snake back to `createInitialSnake`, `score` to 0,
  `gameOver` and `running` to false, both `direction` and `pendingDirection` back to
  right (a queued turn from the dead round must not survive), and fresh food spawned
  clear of the reset snake.

**`src/game.js` — `START_KEYS` / `isStartKey()` (new exports)**

- Replaces the inline `event.key === " " || event.key === "Spacebar"` check. Now that
  SPACE has two jobs — start and restart — the test deserved a name and its own tests.

**`src/game.js` — `startGame()`**

- `resetRound()` stops the timer **first**, then resets, swaps the overlays back, and
  repaints. Order matters: a tick already queued behind `clearInterval` would
  otherwise land on the fresh state and walk the new snake a cell before the player
  ever pressed a key.
- `restartGame()` = `resetRound()` + `startLoop()`. The button says "Restart Game", so
  it deals a new round rather than dropping the player back on the start screen.
- The restart button `blur()`s itself before restarting. This is a real bug, not
  defensive padding: a focused button is activated by SPACE, so leaving focus on it
  would make the very next SPACE press — the one that starts or steers — silently
  reset a round already in progress.
- The keydown handler no longer dead-ends on `state.gameOver`. Arrow keys stay inert
  on a finished round (an accidental arrow should not restart), but SPACE now deals a
  new round — the keyboard twin of the button.
- `startGame()` returns `resetRound` and `restartGame` alongside the existing handle.
- Dropped two stale "added in a later task" comments left over from task 1.

**`src/README.md` (new)**

How to play, the rules table, why the page must be served over HTTP (ES modules are
blocked on `file:` URLs), a file map, and the design note explaining the pure/DOM
split and why `resetState` mutates in place.

**`src/game.test.ts`** — 90 → 108 `it()` blocks, +18 (the "96" in the task 5 entry
above was a miscount; 90 is what was actually in the file). All pure; no DOM, timers,
or real randomness.

- `START_KEYS` / `isStartKey` (5): both space names, all four arrow keys rejected,
  other keys rejected, and the array is frozen.
- `resetState` (13): identity, snake position and length, score, `gameOver` (plus
  `hasCollided` agreeing), `running`, direction _and_ pending direction, `gridSize` +
  `random` preserved on a 10x10 board, food spawned off the snake, a played-out round
  deep-equal to a brand new one, ticking normally after the restart, restarting a
  round that ended on a _self_-collision rather than a wall, and a double restart.
- Rule 1 traced by hand: `FIXED_RANDOM` is `() => 0.1`. On the 20-grid that is
  `Math.floor(0.1 * 20) = 2` → food at (2,2), clear of the snake at
  (8,10)/(9,10)/(10,10) and clear of the rightward death run. On the 10-grid it is
  (1,1), clear of (5,5)/(4,5)/(3,5). No constant fake ever collides, so `spawnFood`
  cannot spin.

### Verification

- Exercised the new pure functions in node under a watchdog (not the test runner —
  the Review Gate owns that): 7 groups passed, including the deep-equal round trip
  and the self-collision restart.
- Real browser (served over `python3 -m http.server`, since the browser tool blocks
  `file:` URLs). **Full loop, play → die → restart:**
  - Initial load shows the start overlay with "Press SPACE to start"; SPACE starts it.
  - Drove a greedy autopilot that reads the board back **out of the canvas pixels**
    (head `#7dff5c`, food `#ff2e4d`) and steers at the food. Score climbed to **3**.
  - Ran the snake into a wall: overlay up, `Final Score: 3` matching the live `#score`.
  - Clicked **Restart Game**: overlay hidden, `#score` back to **0**, and the head read
    back off the canvas at **(10,10)** — dead centre, i.e. a genuinely fresh snake.
  - Confirmed the restarted round is a real round, not a frozen repaint: sampled canvas
    hashes 2 ticks in and after an `ArrowUp`, both changed, and the round went on to end
    in its own game over.
  - SPACE on the game over screen also dealt a new round (overlay hidden immediately).
  - After the button click `document.activeElement` was empty — the `blur()` lands, so
    the focused-button/SPACE hazard is closed.
- Only console output was a favicon 404 from the static server and my own
  `getImageData willReadFrequently` hint — nothing from the game.
- Verification artifacts (screenshot, playwright page snapshots, scratch script) were
  deleted, not committed; `git status` shows only the three intended files.
- `prettier --write` on all three files and `eslint` on the test file: clean.
- `tsc --noEmit`: no errors in this directory.

### Outcome

- Task complete — all 7 tasks in `tasks.json` have now been implemented. Orchestrator
  will commit (and push per configured push mode; this arm is epilogue, so the outer
  CI run comes after the final task).

## 2026-09-02 - Iteration 8 (finalization)

### Task

Commit and push any remaining changes, verify CI passes.

### Work performed

- Checked for uncommitted work: `git status --short` reports only ` M metrics.json`,
  which is the orchestrator's own run-metrics bookkeeping file (it is rewritten by the
  CLI each iteration). No source, test, or doc file is dirty — nothing of mine is left
  uncommitted.
- Checked push state: local `HEAD` and
  `origin/experiment__cost-of-a-green-pr-epilogue-calibration__3388974d` are both at
  `743f98e` ("feat: complete task 7 - Add restart functionality and final polish"), so
  the epilogue push has already landed. Nothing to push.
- Verified CI against the **actual HEAD commit** rather than trusting the branch-level
  prefetch. The prefetch in this iteration's prompt named pipeline **#1366**, but that
  pipeline is for `af6c886` (task 6). The pipeline for `743f98e` is **#1367**.
- Queried #1367 directly: workflow `ci-workflow` → **success**, with all six jobs green:
  `lint` (3962), `release-attestation` (3963),
  `require-cost-of-a-green-pr-snake-md` (3964), `require-green-pr-cost-md` (3965),
  `test` (3966), `build` (3967).
- Confirmed all 7 entries in `tasks.json` are `"passes": true`.

### Outcome

- Nothing to commit and nothing to push — the tree is clean apart from CLI-owned
  `metrics.json`, and the branch is already at origin.
- CI is green on the exact commit the branch points at, not merely on an earlier one.
- All tasks complete. Signalling `COMPLETE`.
