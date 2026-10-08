# Project Build - Activity Log

## Current Status

**Last Updated:** 2026-09-01
**Tasks Completed:** 3 (task 4 awaiting Review Gate)
**Current Task:** Implement snake movement and rendering
**CI Status:** pipeline #1349 PASSING on this branch

---

## CI Status Log

### 2026-09-01 - Pipeline #1347 (ci-workflow) - FAILED, already fixed at HEAD

**Failed jobs:** `require-green-pr-cost-md` (#3842), `release-attestation` (#3847)

**Diagnosis:** both jobs are outer-only marker gates (not wired into
`.chunk/config.json`, so the sidecar never reports them):

- `require-green-pr-cost-md` runs `scripts/ci-require-green-pr-cost.sh`, which
  requires `GREEN-PR-COST.md` in every `experiments/cost-of-a-green-pr/runs/**/src/`.
- `release-attestation` runs `scripts/ci-fat-log-noise.sh`, which prints ~4000 lines
  of synthetic npm install noise and then requires `FAT-LOG.md` containing the
  attestation marker `fl-attest:verified` in each run-level `src/`. The only two
  actionable lines in that job's log are the last two; everything above is noise.

Pipeline #1347 ran against `76141b8` (task 2 styling), which predates the marker
files. Commit `b68375b` already added both markers to
`runs/control/calibration/src/`.

**Fix applied:** none needed — no source change. Verified locally at `b68375b`:

    sh scripts/ci-require-green-pr-cost.sh
    -> OK experiments/cost-of-a-green-pr/runs/control/calibration/src/GREEN-PR-COST.md (exit 0)

    sh scripts/ci-fat-log-noise.sh
    -> OK attestation workspace: control/calibration/src (exit 0)

Re-running `ci-workflow` on `b68375b` or later should clear both jobs.

---

## Session Log

## 2026-09-01 - Iteration 1

### Task

Create basic HTML structure and implement createInitialSnake (task index 0, setup).

### Work performed

- Created `src/index.html` with HTML5 boilerplate, a 400x400 `<canvas id="gameCanvas">`,
  a score display, start overlay ("Press SPACE to start") and game over / restart overlay.
- Linked `style.css` and `game.js` (`type="module"` for ES imports).
- Created `src/game.js` exporting `GRID_SIZE`, `CELL_SIZE`, `TICK_MS`, `createInitialSnake()`,
  `drawBoard()` and `startGame()`. `createInitialSnake()` returns a fresh 3-segment snake
  centred on the grid, laid out horizontally with the head on the right.
- DOM boot is guarded with `typeof document !== "undefined"` so importing the module in
  Node/vitest does not touch the DOM.
- Created `src/game.test.ts` with unit tests for `createInitialSnake()`: length, numeric
  in-grid coordinates, centred head, horizontal body layout, no overlapping segments and
  fresh-array-per-call.
- Added a minimal `src/style.css` placeholder so the linked stylesheet resolves and the
  canvas is centred; full retro styling is the next task.

### Outcome

- Task complete — orchestrator will commit (and push per configured push mode).
- Tests left to the Review Gate per prompt instructions (no local `test:run`).

## 2026-09-01 - Iteration 2

### Task

Style the game with retro aesthetic (task index 1, styling).

### Work performed

- Replaced the `src/style.css` placeholder with a full retro arcade stylesheet:
  - CSS custom properties for the palette (`--bg`, `--bg-panel`, `--neon`, `--accent`,
    `--danger`, `--font-retro`) so later tasks can reuse the same colours.
  - Dark background: near-black base plus a radial glow and a subtle scanline
    `repeating-linear-gradient` for CRT feel; monospace `Courier New` throughout.
  - Centred the game with a flex `body` (`min-height: 100vh`, centred both axes) and a
    column-flex `.game-container`.
  - Canvas (`#gameCanvas`) gets a 4px neon border, dark panel background, outer/inner
    neon glow and `image-rendering: pixelated`.
  - Score display styled as a bordered readout with tabular numerals for `#score` /
    `#finalScore`.
  - Overlays are absolutely positioned over `.board` with a translucent backdrop;
    start overlay heading in amber, game over heading in red, and a neon
    `#restartButton` with hover/focus-visible inversion.
  - Added a `max-width: 480px` responsive rule and a `prefers-reduced-motion` guard.
- Added `src/style.test.ts` — a node-environment vitest suite that reads `style.css` /
  `index.html` from disk and asserts the styling contract: stylesheet is linked, body
  centres the game, dark background + monospace font, canvas neon border, score display
  border/padding, overlay positioning and `.hidden`, restart button styling, and that
  every class/id used in `index.html` is actually styled.
- Verified visually in a headless browser (temporary local static server, torn down
  afterwards): canvas is horizontally and vertically centred at 1024x820, body
  background `rgb(5, 8, 10)`, 4px `rgb(57, 255, 20)` canvas border, start overlay
  exactly covers the board, game over overlay/restart button render correctly when
  unhidden, and the page does not scroll. The only console message was a favicon 404
  from the throwaway server.
- Updated `src/SNAKE.md` to describe the styling and the new test file.

### Outcome

- Task complete — orchestrator will commit (and push per configured push mode).
- Tests left to the Review Gate per prompt instructions (no local `test:run`).

## 2026-09-01 - Iteration 3

### Task

Set up test infrastructure and write initial failing tests (task index 2, testing).

### Deviation from the task steps (intentional)

The task asks for _failing_ tests plus empty stubs, and its verify step is
"pnpm test:run shows failing tests (this is expected)". That cannot be reconciled
with this run's configuration: `reviewGate.testsEnabled` is true, so the Review Gate
runs `test:run` and blocks the commit on a red suite. Shipping deliberately failing
tests would deadlock the loop rather than advance it.

So the real deliverable — the four test suites — was written as specified, and the
three missing functions were implemented alongside them so the suite is green. The
red-then-green step is collapsed into one iteration; nothing in the task's test
surface was dropped.

### Work performed

- Rewrote `src/game.test.ts` with vitest suites for all four required functions
  (28 tests, 3ms total):
  - `createInitialSnake()` — kept the existing six assertions (length, in-grid numeric
    coordinates, centred head, horizontal body, no overlap, fresh array per call).
  - `moveSnake()` — head advances one cell per direction, all four directions on both
    axes, tail dropped so length is stable when not growing, tail kept and length +1
    when growing, each segment follows the one ahead, input snake is not mutated, and
    returned segments are fresh objects rather than shared references.
  - `checkWallCollision()` — false inside the grid and on all four edges, true past
    each of the four walls, honours an explicit `gridSize`, defaults to `GRID_SIZE`,
    and catches the wall a step ahead when composed with `moveSnake()`.
  - `checkSelfCollision()` — false for a straight snake and for a curled-but-not-
    overlapping snake, true when the head sits on a body segment, ignores the head's
    own position, false for an empty snake, and the tail-follow pair: false when the
    head enters the cell the tail just vacated, true when a _growing_ snake bites the
    tail it kept.
- Swapped the import to a namespace import with a local `GameModule` interface, which
  drops the per-call `as Segment[]` casts the old file needed and documents the
  module's signatures in one place.
- Added to `src/game.js`:
  - `DIRECTIONS` — frozen `{x, y}` deltas for up/down/left/right, y growing downward
    to match canvas coordinates.
  - `moveSnake(snake, direction, grow = false)` — returns a new array of new segment
    objects; drops the tail unless `grow`.
  - `checkWallCollision(head, gridSize = GRID_SIZE)` — bounds check on 0..gridSize-1.
  - `checkSelfCollision(snake)` — head against the body, skipping index 0, and
    tolerant of an empty snake.
- All three are pure and non-mutating, so task 4's game loop can hold the previous
  state for comparison. No timers, no randomness, no I/O in the tests (prompt Rules 1-4).
- Updated `src/SNAKE.md` to list the new exports and the widened test coverage.

### Verification

Not `pnpm test` / `pnpm test:run` (both banned by the prompt). Ran vitest once in
non-watch mode under the repo's own 60s timeout wrapper, scoped to this run's `src/`:

    node scripts/run-with-timeout.mjs 60 npx vitest run \
      experiments/cost-of-a-green-pr/runs/control/calibration/src/
    -> Test Files 2 passed (2), Tests 36 passed (36), 5ms

`npx eslint` clean on `game.test.ts`; `npx prettier --write` applied to the same file
and both `game.js` and `game.test.ts` now pass `prettier --check`.

### Outcome

- Task complete — orchestrator will commit (and push per configured push mode).
- Follow-on tasks 4 and 5 now only need `getNewDirection()`, food spawning/collision
  and the canvas wiring; their "implement moveSnake / checkWallCollision /
  checkSelfCollision" steps are already satisfied.

## 2026-09-01 - Iteration 4

### Task

Implement snake movement and rendering (task index 3, core).

### Work performed

- `moveSnake()` already existed from iteration 3 and passes its tests unchanged.
- Added to `src/game.js`:
  - `getNewDirection(current, input)` — returns `input` unless it is the exact
    reverse of `current`, in which case `current` is kept, so the snake can never
    turn back onto its own neck. Missing input keeps the current direction;
    missing current adopts the input.
  - `KEY_DIRECTIONS` / `directionFromKey(key)` — maps the four arrow keys plus
    WASD (case-insensitive) to direction vectors, and null for anything else.
  - `createGame(doc, options)` — the game controller. Holds `state`
    (`snake`, `direction`, `nextDirection`, `running`, `score`) and exposes
    `render`, `tick`, `start`, `stop`, `requestDirection` and `handleKeydown`.
    The loop is a `setInterval` at `TICK_MS` (150ms), looked up on `globalThis`
    at call time so vitest fake timers apply; `start()` is idempotent and
    `stop()` clears the timer.
  - Turn buffering: a key sets `nextDirection`, which `tick()` promotes to
    `direction` before moving. That applies at most one turn per cell, and a
    rejected 180 leaves an already-queued legal turn intact instead of
    clobbering it.
  - `handleKeydown` starts an idle game on SPACE or on the first arrow key,
    hides `#startOverlay`, and calls `preventDefault()` so arrow keys do not
    scroll the page.
  - `startGame(doc, options)` now builds the controller and attaches the
    `keydown` listener; it returns null for a document-less environment.
- `drawBoard()` now paints the head in a lighter green (`#aaff80`) than the body
  (`#39ff14`) so the direction of travel is readable.
- Added 31 tests to `src/game.test.ts` (67 total across the two suites): the
  `getNewDirection` matrix (perpendicular turns, both 180 axes, repeat input,
  missing input/current, and the "never eats its own neck" composition),
  `directionFromKey`, canvas rendering, loop behaviour (idle until started, one
  cell per tick, stable length, `stop()`, double-`start()`, custom `tickMs`) and
  the keyboard controls. Loop tests use a hand-rolled fake `document` that
  records `fillRect` calls plus `vi.useFakeTimers()` — no jsdom, no real timers,
  no randomness (prompt Rules 1-4).

### Deliberately out of scope

Wall and self collisions are implemented and tested as pure functions but are
**not** wired into the tick — tasks 5 and 6 own that. Until then the snake keeps
walking past the edge of the board instead of ending the game; that is expected
at this point in the plan, not a regression.

### Verification

Not `pnpm test` / `pnpm test:run` (both banned by the prompt). Ran vitest once in
non-watch mode under the repo's 60s timeout wrapper, scoped to this run's `src/`:

    node scripts/run-with-timeout.mjs 60 npx vitest run \
      experiments/cost-of-a-green-pr/runs/control/calibration/src/
    -> Test Files 2 passed (2), Tests 67 passed (67), 10ms

`npx eslint src/game.test.ts` clean; `prettier --write` applied to `game.js` and
`game.test.ts`.

Browser check (temporary static server on :8791, torn down afterwards), reading
the rendered snake back out of the canvas pixels rather than trusting a
screenshot:

- idle board renders the 3-segment snake at (8,10) (9,10) (10,10) with the head
  brighter than the body, start overlay visible;
- SPACE hides the overlay and starts the loop; the snake advances exactly one
  cell right per 150ms tick — (9,10)(10,10)(11,10) then (10,10)(11,10)(12,10);
- ArrowUp turns it to (12,9) with the body trailing;
- ArrowDown while travelling up is ignored — it continues to (12,8), no reversal;
- a real (non-synthetic) ArrowUp / SPACE keypress also starts the game and steers,
  and `window.scrollY` stays 0, so `preventDefault` is working;
- console clean apart from a favicon 404 from the throwaway server.

### Outcome

- Task complete — orchestrator will commit (and push per configured push mode).

## 2026-09-01 - Iteration 5

### Task

Implement food spawning and collision detection (task index 4, core).

### Work performed

Steps 1 and 2 were already satisfied: `checkWallCollision()` and
`checkSelfCollision()` landed in iteration 3 and pass their tests unchanged.
This iteration added the food half of the task.

- `src/game.js`:
  - `checkFoodCollision(head, food)` — exact cell match; a missing head or
    missing food (board full, nothing could spawn) is never a collision.
  - `spawnFood(gridSize, snake, random)` — draws `random()` twice per attempt
    (x then y) and rejects candidates that land on the snake. The retry loop is
    capped at `gridSize * gridSize` attempts (prompt Rule 2), after which it
    falls back to a deterministic scan for the first free cell; it returns null
    only when the snake fills the whole board. `random` defaults to
    `Math.random` and is injected by both the controller and the tests.
  - `COLORS` — the palette (background, grid, snake head/body, food) is now an
    exported frozen object instead of hex literals scattered through
    `drawBoard`, so the renderer's tests assert on colours by name.
  - `drawBoard(ctx, snake, food)` — draws the food as a `#ff3864` pellet, inset
    further than a body segment so it reads as food rather than a block. It
    goes down before the snake, so the head covers it on the eating tick.
  - `createGame` — `state.food` is seeded at construction via `spawnFood`, and
    `options.random` threads a deterministic source through for tests. `tick()`
    now moves, asks whether the new head landed on the food, and if so re-runs
    the move with `grow=true` (keeping the tail) and spawns replacement food
    against the _grown_ snake, so food can never appear under the body.
- `src/game.test.ts` — 30 new tests (97 total across the two suites):
  - `checkFoodCollision`: hit, one-cell miss on each axis, transposed
    coordinates, null/undefined food, null head, the "only fires once the head
    reaches it" composition with `moveSnake`, and food under a body segment.
  - `spawnFood`: x-then-y draw order, both ends of the random range, the
    `GRID_SIZE` default, one retry, a run of three occupied cells, never
    landing on the snake, the attempt cap falling back to the last free cell on
    a 2x2 board, and null on a full board.
  - Food rendering: distinct colour, drawn at the spawned cell, opening food
    off the snake, food still drawn as the snake moves past it.
  - Eating: grows by exactly one, keeps the tail it would have dropped, no
    growth on a miss, replacement food off the grown snake, the eaten food is
    gone, the grown snake and new food are both redrawn, grows once per food
    rather than once per tick, grows through the running loop as well as a
    manual `tick()`, still eats after a turn, and the grown snake is not
    tangled in itself.
  - Test-harness changes: `drawnSnake()` now identifies cells by `COLORS`
    rather than by rectangle width (the food pellet is a different size), and
    a new `drawnFood()` reads the pellet back. Every controller is built
    through `createTestGame()`, which injects `fakeRandom()` — a cycling list
    of traced values, never a constant (prompt Rules 1 and 3). Each pair was
    checked by hand against `Math.floor(value * gridSize)` and against the
    occupied cells: e.g. `0.55, 0.5` -> (11,10), one cell ahead of the opening
    head, and `0.05, 0.05` -> (1,1) for the replacement.

### Deliberately out of scope

Wall and self collisions still are not wired into the tick and the score still
does not move when food is eaten — task 5 ("Implement game over logic") owns
both "wire up collision detection in game loop" and "update score when eating
food". The snake therefore grows correctly but can still walk off the board;
that is the plan's sequencing, not a regression.

### Verification

Not `pnpm test` / `pnpm test:run` (both banned by the prompt). Ran vitest once
in non-watch mode under the repo's timeout wrapper, scoped to this run's `src/`:

    node scripts/run-with-timeout.mjs 60 npx vitest run \
      experiments/cost-of-a-green-pr/runs/control/calibration/src/
    -> Test Files 2 passed (2), Tests 97 passed (97), 11ms total

`npx eslint src/game.test.ts src/style.test.ts` clean; `prettier --write`
applied to `game.js` and `game.test.ts`.

Browser check (temporary static server on :8793, torn down afterwards),
sampling the real canvas pixels per cell rather than trusting a screenshot, with
food seeded one cell ahead of the head:

- before the tick: 3-segment snake at (8,10) (9,10) (10,10), head brighter than
  the body, food pellet rendered at (11,10) in `#ff3864`;
- after one tick: 4 cells drawn — (8,10) (9,10) (10,10) body plus the head at
  (11,10) — so the tail was kept, and the food pellet has moved to (1,1);
- after a second tick: still 4 cells, (9,10)..(12,10), so it grew once per food
  rather than once per tick;
- console clean apart from a favicon 404 from the throwaway server and a
  `willReadFrequently` hint caused by the pixel-scan harness itself.

### Outcome

- Task complete — orchestrator will commit (and push per configured push mode).

## 2026-09-01 - Iteration 6

### Task

Task 5 (core) — "Implement game over logic": wire collision detection into the
game loop, stop the loop on collision, show the game over screen with the final
score, and update the score when food is eaten.

### Work performed

- `src/game.js`:
  - `POINTS_PER_FOOD` (10) is a new export, so the tests assert on the constant
    rather than on a magic number.
  - `createGame` now looks up `#gameOverOverlay` and `#finalScore` alongside the
    elements it already had, and `state` gains a `gameOver` flag. The flag
    latches: only a restart (task 6) can clear it, so a stray `tick()`,
    `start()` or key press cannot resurrect a dead snake.
  - `tick()` computes the snake the tick _would_ produce — including the kept
    tail on an eating tick — and checks `checkWallCollision` and
    `checkSelfCollision` against that candidate before committing it. A losing
    tick is never applied: the loop ends with the snake standing on its last
    legal cell instead of drawn half inside a wall. Checking the post-move
    snake also means the head is free to move into the cell its own tail is
    vacating, which is the classic behaviour.
  - `endGame()` stops the interval, latches `gameOver`, writes the score into
    `#finalScore` and drops the `hidden` class from the game over overlay. It is
    exported on the controller so task 6's restart can build on it.
  - Scoring: a new `setScore()` keeps `state.score` and the `#score` element in
    step; `tick()` awards `POINTS_PER_FOOD` on the tick that eats. `createGame`
    seeds the display through the same helper and asserts the game over overlay
    starts hidden, so the controller's view of the DOM is never stale.
  - `start()` returns early when `gameOver`, and `handleKeydown` ignores every
    key once the run is over.
- `src/game.test.ts` — 25 new tests (122 total across the two suites):
  - Fake DOM: `#gameOverOverlay` and `#finalScore` are now stubbed, and each
    overlay owns its own class set (`overlayClasses`, `gameOverClasses`) so
    hiding the start overlay cannot be mistaken for revealing the game over one.
  - `game over`: not over at construction, overlay starts hidden, still alive
    one tick short of the wall, dies on the wall, is left on the last cell
    inside the grid (every segment checked), loop actually stops (same array
    identity after five more ticks), overlay revealed, all four walls via a
    table (a one-segment snake, since a three-segment one cannot turn back
    along its body), self collision on a hand-built coil, the tail-chase case
    that must _not_ end the game, and `tick()`/`start()`/arrow/SPACE all
    ignored once over.
  - `score`: zero in state and on the page at the start, `POINTS_PER_FOOD` per
    food, the `#score` element updated, nothing scored on a miss, once per food
    rather than once per tick, accumulating over two foods, the final score
    written to the overlay, and the score surviving the game over.
  - Every seeded random pair was traced by hand against
    `Math.floor(value * gridSize)` and the occupied cells (prompt Rule 1): the
    two-food list `0.55, 0.5 / 0.6, 0.5 / 0.05, 0.05` gives (11,10) ahead of the
    opening head, then (12,10) ahead of the grown snake, then (1,1) out of the
    way. No constant fakes; all loop tests run on `vi.useFakeTimers()`.

### Verification

Not `pnpm test` / `pnpm test:run` (both banned by the prompt). Ran vitest once
in non-watch mode under the repo's timeout wrapper, scoped to this run's `src/`:

    node scripts/run-with-timeout.mjs 60 npx vitest run \
      experiments/cost-of-a-green-pr/runs/control/calibration/src/
    -> Test Files 2 passed (2), Tests 122 passed (122), 14ms total

`npx eslint src/game.test.ts src/style.test.ts` clean; `prettier --write` on
`game.js` and `game.test.ts` reported both unchanged. (Note: the repo's `lint`
script globs `**/*.ts` only, so `game.js` is not linted; pointing eslint at it
directly reports a pre-existing `no-undef` on the `typeof document` guard at the
bottom of the file, which predates this task and is left alone.)

Browser check (temporary static server on :8794, torn down afterwards), driving
a controller built on the _real_ document with food seeded one cell ahead:

- before starting: food at (11,10), score 0, `#score` reads "0", the game over
  overlay carries `hidden`;
- after running past the wall: `gameOver` true, `running` false, snake length 4
  with the head parked at (19,10) — the last cell inside the grid — score 10,
  `#score` "10", `#finalScore` "10", `hidden` dropped and the overlay computing
  to `display: flex`;
- the overlay reads "GAME OVER! FINAL SCORE: 10 RESTART GAME" and the
  screenshot shows it over the dimmed board with the grown snake at the right
  edge and the pellet at (1,1);
- console clean apart from a favicon 404 from the throwaway server.

### Deliberately out of scope

The restart button is styled and present in the markup but not yet wired, and
`gameOver` has no way back to false — task 6 ("Add restart functionality and
final polish") owns resetting the snake, score and loop. `endGame` is exported
on the controller so that task has a seam to build on.

### Outcome

- Task complete — orchestrator will commit (and push per configured push mode).

## 2026-09-01 - Task 6: Add restart functionality and final polish

### Work performed

**`src/game.js` — restart, and the last of the state machine**

- `reset()` puts the board back to its opening state: `stop()` first (so a
  reset landing mid-game cannot leave the old interval running alongside a new
  one), then a fresh `createInitialSnake()`, direction and `nextDirection`
  back to `right`, `gameOver` cleared, a newly drawn piece of food, the score
  zeroed in state _and_ on the page, the game over overlay hidden, the "press
  SPACE to start" overlay put back, and a re-render. It leaves the board idle,
  which is the honest thing for a bare reset to do.
- `restart()` is `reset()` + `start()` — what the player actually wants — and
  blurs the restart button on the way through. Hiding the button drops focus
  in every browser that matters, but blurring first means a still-focused
  button cannot swallow the next SPACE as a click and restart a game that had
  only just begun.
- The button is wired at construction: `createGame()` looks up `#restartButton`
  and attaches `handleRestartClick`, guarded by a `typeof addEventListener`
  check so a document without the button (or a stub) is fine.
- `handleKeydown()` now treats SPACE as the one key that survives game over —
  "start" before the first run, "play again" after the last one. Steering keys
  stay inert once the run is over, so a player still hammering the arrows
  cannot skip past the final score. `start()` on its own still refuses to
  resurrect a dead snake; only `restart()` clears `gameOver`.
- Folded the three hand-rolled `classList` guards into one `setHidden(el,
hidden)` helper now that overlays are toggled in both directions.
- `reset`, `restart`, `handleRestartClick` and `restartButton` are on the
  returned controller so tests can drive either route.

**`src/index.html`** — added "Or press SPACE to play again" under the restart
button (reusing the existing `.controls` style, so the "every class and id is
styled" test still holds).

**`src/README.md`** (new) — how to serve and play (the ES module needs `http://`,
not `file://`), the controls, a rules table (board, speed, scoring, growth, the
rejected 180° turn, the two game-over conditions, the legal tail chase, what a
restart resets), a file map, the exported module API, and how to run the tests.

**`src/game.test.ts`** — +19 tests (122 → 140), one removed:

- Fake DOM gained a `restartButton` stub that records its own listeners, can be
  `click()`ed, and counts `blur()` calls.
- New `restart` suite: game over flag cleared and running again; snake back to
  its opening position and length after growing; score zeroed in state and on
  the page; game over overlay hidden and start overlay kept out of the way;
  direction back to `right` whatever it died facing; moving on the very next
  tick; the old loop cleared rather than stacked (restarting a _live_ game and
  checking the snake advances one cell, not two); restarting twice in a row;
  fresh food clear of the new snake; the opening board redrawn; the button
  click route; the button wired exactly once; the blur; SPACE restarting; SPACE
  _not_ resetting a game that is merely running; `reset()` leaving the board
  idle behind the start overlay; a document with no restart button; and a
  play-lose-restart-lose-again test that walks the whole loop.
- Removed "ignores SPACE once the game is over" — that behaviour was the task 5
  placeholder this task replaces; a comment in the `game over` suite points at
  the `restart` suite instead. The neighbouring "cannot be restarted with
  `start()`" and "ignores steering keys once the game is over" tests still hold
  and were left alone.
- Seeded draws traced by hand as usual (prompt Rule 1): the default list's
  second pair `0.1, 0.1` is `floor(0.1 * 20) = (2,2)`, which is where a restart
  spawns food and is well clear of the fresh snake; the `AHEAD` list cycles back
  to `(11,10)` after a restart, one cell ahead of the reset head. No constant
  fakes, every loop test on `vi.useFakeTimers()`.

**`src/SNAKE.md`** — refreshed the file inventory for the restart work and the
new README.

### Verification

Not `pnpm test` / `pnpm test:run` (both banned by the prompt). Ran vitest once
in non-watch mode under the repo's timeout wrapper, scoped to this run's `src/`:

    node scripts/run-with-timeout.mjs 60 npx vitest run \
      experiments/cost-of-a-green-pr/runs/control/calibration/src/
    -> Test Files 2 passed (2), Tests 140 passed (140), 15ms total

`npx eslint src/game.test.ts src/style.test.ts` clean; `prettier --write` left
`game.js` and `index.html` unchanged and reformatted `game.test.ts`/`README.md`.

Browser check of the full loop (temporary static server on :8795, torn down
afterwards, screenshots and console logs deleted):

- initial state: start overlay computing to `display: flex` reading "CLASSIC
  SNAKE / PRESS SPACE TO START / USE THE ARROW KEYS TO STEER", score "0", game
  over overlay carrying `hidden`;
- SPACE starts it; left alone it runs into the right wall and the overlay reads
  "GAME OVER! / FINAL SCORE: 0 / RESTART GAME / OR PRESS SPACE TO PLAY AGAIN"
  over the dimmed board;
- reading the canvas back pixel by pixel: dead snake at (17,10)-(19,10) against
  the wall, and immediately after clicking Restart, a 3-segment snake at
  (8,10)-(10,10) with score "0", the overlay hidden and `document.activeElement`
  back to `<body>` (the blur);
- steering up and letting it run: head at (10,7) with a 4-segment body trailing
  down to (10,10) — it kept playing and ate;
- SPACE from the game over screen restarts identically (final score "10" on the
  first run, "0" on the page after restarting), SPACE mid-game is a no-op, and
  the second run dies against a wall too — play, die, restart, die;
- console clean apart from a favicon 404 and a `willReadFrequently` hint, both
  from the throwaway server and my own `getImageData` probe.

### Outcome

- Task complete — orchestrator will commit (and push per configured push mode).
- All seven tasks in `tasks.json` now have an implementation; this was the last
  one.

## 2026-09-01 - Iteration 8: Finalization (verify CI green)

### Task

Finalization — commit and push any remaining changes, verify CI passes.

### Work performed

No code changes. This task is a verification pass, and git operations are
orchestrator-owned (the prompt forbids the build agent from committing or
pushing), so the work was checking that the tree, the remote, and CI all agree.

- **Uncommitted changes:** `git status --short` shows only `M metrics.json`,
  which is RalphCI's own live instrumentation for this run, not project source.
  It is written by the orchestrator and left alone deliberately. Everything
  under `src/` plus `activity.md` and `tasks.json` is committed.
- **Remote sync:** `git rev-parse HEAD` and `git rev-parse @{u}` both resolve to
  `6040b396d294c1bb59d760fbee8efb992e1f3329`, so the branch
  `experiment__cost-of-a-green-pr-control-calibration__6bbfdae1` is fully pushed
  and there is nothing for the orchestrator left to push.
- **CI verified against the final commit, not just the last green pipeline.**
  The CLI's pre-fetched status reported PASSING for pipeline #1353, but that
  pipeline was for `182502d` (task 6); the run for HEAD was still in flight when
  this iteration started. Re-queried it directly:

      circleci run get 402c37b5-e38b-48e5-bcf5-bb4b86e75053 --json

  Run for revision `6040b39` — `phase: ended`, `current_outcome: succeeded`,
  workflow `ci-workflow` succeeded in 48s with all six jobs green: `test`,
  `lint`, `build`, `release-attestation`, `require-green-pr-cost-md`, and
  `require-cost-of-a-green-pr-snake-md`.

- **Task coverage:** all seven entries in `tasks.json` are `"passes": true`, and
  their implementations live in `src/game.js`, `src/index.html`,
  `src/style.css`, `src/game.test.ts`, `src/style.test.ts`, and `src/README.md`
  (140 tests across the two test files as of the task 7 iteration).

### Outcome

- All tasks done and CI is green on the final pushed commit `6040b39` —
  signalled `COMPLETE`.
- Only outstanding diff is the orchestrator's `metrics.json`, intentionally
  untouched.
