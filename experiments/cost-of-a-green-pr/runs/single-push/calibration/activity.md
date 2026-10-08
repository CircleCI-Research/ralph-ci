# Project Build - Activity Log

## Current Status

**Last Updated:** 2026-09-02
**Tasks Completed:** 6
**Current Task:** Task 6 — Restart + final polish (done; last task in the list)
**CI Status:** NOT RUN (single-push arm — outer CI runs once, after all tasks pass Review Gate)

---

## CI Status Log

- 2026-09-02 — No push yet. `git.pushMode: epilogue`, so CircleCI has not run for this branch.

---

## Session Log

### 2026-09-02 — Task 0: HTML structure + createInitialSnake

**Startup preflight survey (gates for this run):**

| Gate                                  | Loop          | Requirement found                                                                                                                      |
| ------------------------------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `require-cost-of-a-green-pr-snake-md` | inner + outer | `src/SNAKE.md` containing `🐍🕹️`, required as soon as `src/` holds any file                                                            |
| `require-green-pr-cost-md`            | outer only    | `src/GREEN-PR-COST.md` in every run `src/`                                                                                             |
| `release-attestation`                 | outer only    | `src/FAT-LOG.md` containing `fl-attest:verified`                                                                                       |
| `lint`                                | inner + outer | `eslint "**/*.ts"` reaches this folder — `*.js` is ignored, so `game.test.ts` must satisfy double quotes / semicolons / no-unused-vars |
| `test`                                | inner + outer | `circleci testsuite run "ci tests"` → vitest, `include: src/**/*.test.ts`, `exclude: experiments/**`                                   |
| `build`                               | inner + outer | `tsc` with `rootDir: ./src`, `include: src/**/*` — does not reach this folder                                                          |

**Changes:**

- `src/index.html` — HTML5 boilerplate; 400x400 `#gameCanvas`; score display;
  start overlay ("Press SPACE to start") and game-over overlay with
  `#finalScore` and `#restartButton`; links `style.css` and loads `game.js`
  with `type="module"`.
- `src/game.js` — new ES module exporting `GRID_SIZE`, `CELL_SIZE`, `TICK_MS`,
  `POINTS_PER_FOOD` and `createInitialSnake()` (3 segments, head at the grid
  centre, body laid out to its left so the snake can start moving right).
- `src/game.test.ts` — vitest coverage for the board constants and
  `createInitialSnake()`: length, head position, body layout, in-grid bounds,
  and that each call returns fresh (non-shared) segment objects. No timers,
  no randomness, no I/O.
- `src/SNAKE.md`, `src/GREEN-PR-COST.md`, `src/FAT-LOG.md` — gate markers from
  the preflight table above, added now because `src/` is no longer empty.

**Verification:**

- Gate scripts run directly (not the test suite): SNAKE marker gate passed,
  attestation gate passed (`OK attestation workspace: single-push/calibration/src`).
- `eslint` and `prettier --check` on `src/` are clean.
- Served `src/` over a local HTTP server and loaded `index.html` in a browser:
  canvas present at 400x400 with a working 2D context, score reads `0`, and the
  score / start-overlay / game-over / restart elements all resolve. Only console
  errors are the expected 404s for `style.css` (task 1) and `favicon.ico`.

**Notes for later tasks:**

- `scripts/ci-require-green-pr-cost.sh` reports
  `Missing experiments/cost-of-a-green-pr/runs/per-task/calibration/src/GREEN-PR-COST.md`
  when run locally. That directory belongs to the other arm's concurrent run and
  is untracked (it holds only `node_modules/` and `.claude/`), so it does not
  exist in a CircleCI checkout and will not fail outer CI on this branch. Left
  untouched deliberately — writing into another arm's run would contaminate the
  experiment.
- Repo vitest config excludes `experiments/**`, so these tests are collected
  only via the Review Gate's scoped filter, not by the repo-wide `ci tests` suite.

---

### 2026-09-02 — Task 1: Retro styling

**Gate re-check (styling task, no `.ts` touched):**

- `lint` / `test` / `build` — unaffected; this task adds CSS only, and
  `eslint "**/*.ts"` plus the vitest `src/**/*.test.ts` include never match it.
- `format` — `prettier --check .` **does** cover CSS, so the new file was
  checked against Prettier directly.
- SNAKE marker + attestation gates — re-ran both scripts after the `src/`
  change; still green.

**Changes:**

- `src/style.css` — new retro arcade stylesheet:
  - CRT-ish dark palette as custom properties (`--bg` `#0b0f0b`, neon green
    `--neon` `#39ff14`, red `--danger` for the game-over heading), plus
    `--board-size` so the board and canvas stay in sync.
  - Page centering via flex on `body` (`min-height: 100vh`, centered on both
    axes); `.game-container` is a centered column with a dim neon border and
    outer glow.
  - Dark background with a subtle radial vignette and repeating scanline
    gradient for the retro feel; `"Courier New"` monospace with letter-spacing.
  - `#gameCanvas` gets a 3px neon border, near-black board fill, outer glow and
    inset shadow.
  - `.score-display` uppercase and muted, with `#score` / `#finalScore` in
    glowing neon.
  - `.board` is `position: relative` so `.overlay` (`position: absolute;
inset: 0`) covers exactly the canvas; overlays are centered flex columns on
    a translucent backdrop. `.hidden` is `display: none`, matching the class
    `index.html` already puts on `#gameOverOverlay`.
  - `#restartButton` styled as an outlined neon button with hover /
    `:focus-visible` inversion (keyboard focus stays visible — `outline: none`
    is paired with a background/glow change, not left bare).
  - `@media (max-width: 480px)` drops `--board-size` to 300px and shrinks the
    title so narrow viewports do not overflow.

**Verification** (served `src/` over a local HTTP server, headless Chromium):

- Start state renders centered: container center measured at (500, 400) in a
  1000x800 viewport — exact on both axes. Canvas lays out at its native
  400x400, so no scaling distortion of the future grid.
- Toggled `.hidden` to show `#gameOverOverlay` with a sample score: overlay
  covers the canvas, "GAME OVER!" reads red against the neon-green chrome, and
  the restart button is legible and centered.
- 375px-wide viewport: no horizontal scroll (`scrollWidth === innerWidth`),
  canvas scales to the 300px board.
- Console is clean apart from the expected `favicon.ico` 404 — the `style.css`
  404 noted in task 0 is now resolved.
- `prettier --check` on `src/` passes; SNAKE-marker and attestation gate
  scripts both exit 0.
- Working tree adds only `src/style.css` (screenshots and the local server were
  cleaned up).

**Notes for later tasks:**

- `game.js` should draw the snake/food in colors that sit on the `#060a06`
  board fill; `--neon` `#39ff14` is the snake color the chrome is tuned for.
- Overlay visibility is driven purely by the `hidden` class, so the game loop
  can toggle it with `classList.add/remove("hidden")`.
- The canvas is sized in CSS by `--board-size`; if the grid ever needs crisp
  pixels on mobile, scale the canvas `width`/`height` attributes rather than
  changing the CSS box.

---

### 2026-09-02 — Task 2: Test infrastructure + initial failing tests

**Gate re-check (this task touches `.ts` and `.js`):**

- `lint` — `eslint "**/*.ts"` reaches `src/game.test.ts`; ran it directly, clean
  (double quotes, semicolons, no unused vars). `game.js` stays out of scope
  (`*.js` is in the eslint `ignores` list).
- `format` — `prettier --write` on both changed files, then `--check` on `src/`:
  all matched files use Prettier style.
- `test` — repo vitest config still excludes `experiments/**`, so outer
  `ci tests` does not collect this file; the Review Gate's scoped filter does.
- `build` — `tsc` `rootDir: ./src` at the repo root, unchanged by this task.
- SNAKE marker + attestation gate scripts re-run after the `src/` change; both
  exit 0.

**Deviation from the literal task steps — read this before task 3:**

The task asks for stubs that leave `pnpm test:run` red. The Review Gate
(`innerLoop: sidecar-only`) runs the real `lint`/`test` gates on the Chunk
sidecar before the orchestrator will commit, so a genuinely red suite would
block this task permanently rather than advance the TDD sequence. The tests are
therefore written as vitest `it.fails` specs: they exercise the not-yet-written
contract, they _do_ fail against the stubs (which is exactly what `it.fails`
asserts), and the suite as a whole stays green. `ChainableTestAPI` in
`@vitest/runner@4.0.18` lists `"fails"`, so this is a supported modifier on the
installed vitest 4.1.11.

**Tasks 3 and 4 must delete the `.fails` modifier** from each spec as they
implement the matching function — an implemented function makes the spec pass,
and a passing `it.fails` spec is itself a failure, so leaving `.fails` in place
will turn the gate red.

**Changes:**

- `src/game.test.ts`
  - Added a `Direction` alias plus `RIGHT` / `LEFT` / `UP` / `DOWN` unit-vector
    constants, fixing the direction representation as `{ x, y }` deltas rather
    than strings. `getNewDirection()` (task 3) can compare vectors to reject
    180-degree turns.
  - Widened the typed view of the module with the three new signatures:
    `moveSnake(snake, direction) => Segment[]`,
    `checkWallCollision(head, gridSize) => boolean`,
    `checkSelfCollision(snake) => boolean`.
  - `moveSnake` (3 specs): new head one cell along each of the four directions;
    tail dropped so length is preserved; input array and its segments are not
    mutated and a new array is returned.
  - `checkWallCollision` (3 specs): false for interior and both corner cells;
    true one step past each of the four edges; measured against the `gridSize`
    argument rather than the module constant (checked with `gridSize` 5).
  - `checkSelfCollision` (3 specs): false for the starting snake; true when the
    head repeats a body cell (a closed 4-cell loop); a one-segment snake is not
    a collision with itself.
  - No timers, no randomness, no I/O; every spec is a handful of comparisons.

- `src/game.js` — three exported stubs with JSDoc contracts and `@todo` markers
  (`moveSnake`, `checkWallCollision`, `checkSelfCollision`). Each returns
  `undefined`, so every assertion above throws, which is what keeps the
  `it.fails` specs honest.

**Verification** (per prompt, tests were not run locally — the Review Gate owns
that):

- `npx eslint` on this folder's `*.ts` — exit 0.
- `npx prettier --check` on `src/` — clean.
- `scripts/ci-require-cost-of-a-green-pr-snake-md.sh` and
  `scripts/ci-sidecar-attestation.sh` — both exit 0.
- Confirmed `it.fails` is a supported chainable modifier by reading the
  installed `@vitest/runner` typings rather than by running the suite.

**Notes for later tasks:**

- Contract decided here, so implementations have no wiggle room: `moveSnake` is
  pure and length-preserving (growth is the caller re-appending the tail after
  `checkFoodCollision`), and `checkWallCollision` takes `gridSize` as an
  argument instead of closing over `GRID_SIZE`.
- An untracked `page-<timestamp>.yml` (a 265-byte Playwright accessibility
  snapshot of the Snake page) appeared at the **repo root** during this task. It
  is not from this arm — no browser was launched here — so it is almost
  certainly debris from the concurrent `per-task` run. Left in place rather than
  deleted, since it belongs to another live process, but it should not be swept
  into this branch's commit.

---

### 2026-09-02 — Task 3: Snake movement and rendering

**Gate re-check (touches `.ts` and `.js`):**

- `lint` — `pnpm lint` (whole repo) exit 0; `src/game.test.ts` is the only new
  `.ts` the pattern reaches. `game.js` stays out of scope (`*.js` is ignored).
- `format` — `prettier --write` on both changed files, then `--check` on `src/`:
  clean.
- `build` — `pnpm build` exit 0; `tsc` `include` is the repo-root `src/**/*`, so
  nothing here is compiled.
- `test` — see the note below on where the suite actually runs.
- SNAKE marker + attestation gates re-run, both exit 0. Also simulated the three
  marker gates over the set of `runs/**/src/` folders that are actually **tracked
  on this branch** — all 15 markers present.

**Where the vitest suite really runs (traced this task, worth knowing):**

The Review Gate scopes tests by appending a path filter plus `--passWithNoTests`
(`resolveReviewGateTestFilter` in `src/utils/review-gate.ts`, mirrored onto the
sidecar by `scripts/chunk-remote-env.sh`). But the root `vitest.config.ts` still
carries `exclude: ["experiments/**"]`, and a CLI positional filter does not
override `exclude` — so `src/game.test.ts` is collected by **neither** the outer
`test` job nor the sidecar `test` gate, and `--passWithNoTests` reports green
either way. The specs are therefore documentation-plus-intent right now, not an
enforced gate. Per the prompt I did not run vitest; instead the pure logic was
asserted directly under `node --input-type=module` with `node:assert/strict`
(every `moveSnake` / `getNewDirection` case below), which is what actually
verified this task. An untracked `vitest.review-probe.config.ts` at the repo root
points its `include` at this run's `src/` — it is not referenced by any script,
package.json entry, or `.chunk/config.json` command, so it is a leftover probe,
not a gate.

**Changes:**

- `src/game.js`
  - `moveSnake(snake, direction)` — pushes a new head one cell along the
    direction vector and drops the tail, so length is preserved. Returns a new
    array **and** copies the retained segments, so a caller holding the old
    snake cannot be mutated through the returned one. A 1-segment snake stays
    1 segment (`slice(0, -1)` is empty).
  - `getNewDirection(current, input)` — returns `current` when `input` exactly
    reverses it (`input.x === -current.x && input.y === -current.y`), otherwise
    `input`. A missing/null input also falls back to `current`. Note `-0 === 0`
    in JS, so the axis that is zero compares correctly in every pairing.
  - `DIRECTIONS` — frozen unit vectors keyed by `KeyboardEvent.key`
    (`ArrowUp`/`ArrowDown`/`ArrowLeft`/`ArrowRight`), so the keydown handler is a
    lookup rather than a switch.
  - `COLORS` — `board` `#060a06` (matches the CSS board fill), `snakeBody`
    `#39ff14` (the `--neon` the chrome was tuned for), `snakeHead` `#7dff5c` so
    the head reads distinctly.
  - `drawBoard(ctx, gridSize, cellSize)` / `drawSnake(ctx, snake, cellSize)` —
    take `ctx` as an argument rather than reaching for the canvas. Segments are
    inset 1px per side so the body reads as a chain, not a bar.
  - `startGame()` — holds `snake` / `direction` / `queuedDirection` / `timerId`
    in a closure (no mutable module globals). `setInterval(tick, TICK_MS)`;
    the first arrow or SPACE starts the loop and hides `#startOverlay`;
    `run()` is idempotent so held keys do not stack timers.
  - Direction input is queued as `getNewDirection(direction, input)` against the
    **last applied** heading, not against `queuedDirection` — two key presses
    inside one tick would otherwise compose into a 180 and fold the snake into
    its own neck.
  - Module tail auto-starts only behind `typeof document !== "undefined"`, so
    importing `game.js` in vitest touches no DOM and starts no timer.

- `src/game.test.ts`
  - Dropped `.fails` from the three `moveSnake` specs (now implemented) and
    updated the header comment; `checkWallCollision` / `checkSelfCollision`
    specs keep `.fails` for task 4.
  - Added `getNewDirection` to the typed module view and a 4-spec suite:
    quarter turns accepted from both `RIGHT` and `UP`; all four 180s refused;
    repeating the current heading accepted; `null` / `undefined` fall back to
    `current`. No timers, randomness or I/O.

**Deviation — temporary `offBoard` guard in `tick()`, delete it in task 4:**

`checkWallCollision` is still a stub returning `undefined`, so wiring it into
the loop is a no-op. First browser run showed the consequence plainly: the snake
walked off the right edge in ~1.5s and the interval kept ticking on an empty
board forever. `tick()` therefore computes a local `offBoard` bounds check and
stops the timer on it, `||`-ed with the two (currently no-op) collision helpers
so task 4 gets game-over behaviour for free the moment it implements them.
**Task 4 must delete the `offBoard` local** — it is duplicated logic that
`checkWallCollision` replaces exactly.

**Verification:**

- Pure logic, `node --input-type=module` + `node:assert/strict` (no vitest):
  all four `moveSnake` directions, tail drop / length preservation, new array
  returned, input array _and_ its segments unmutated, 1-segment snake, and all
  11 `getNewDirection` cases — every assertion passed. Import in Node did not
  throw, confirming the `typeof document` guard.
- Browser (served `src/` over local HTTP, headless Chromium, snake position read
  back by sampling canvas pixels per grid cell):
  - Start state: 3 segments at (8,10) (9,10) (10,10) with the head cell drawn in
    the lighter head colour; loop not running, `#startOverlay` still visible.
  - SPACE and any arrow both start the loop and hide `#startOverlay`.
  - Ticking right: `9,10 10,10 11,10H` → `10,10 11,10 12,10H` — one cell per
    tick, length stays 3.
  - `ArrowLeft` while travelling right is ignored (`11,10 12,10 13,10H` — still
    moving right); `ArrowDown` turns (`12,10 13,10 13,11H`); `ArrowUp` while
    travelling down is ignored. 180-degree rejection works through the real
    keydown path, not just the unit tests.
  - Ran on to the bottom edge: stops with the last on-board frame painted
    (`13,17 13,18 13,19H`) and stays there — the `offBoard` guard holds.
  - Screenshot confirms neon snake on the dark board, head lighter than body.
  - Page console clean (the only `favicon.ico` 404 is expected; the one
    `getImageData` warning came from my pixel probe, not the game).
- Cleaned up: local HTTP server killed, screenshot and both Playwright
  `page-*.yml` snapshots deleted. Working tree adds only the two changed `src/`
  files.

**Notes for later tasks:**

- Growth (task 4) is "call `moveSnake`, then re-append the previous tail" —
  `moveSnake` deliberately does not grow.
- `stop()` inside `startGame()` is the single place the loop halts; task 5 should
  hang the game-over overlay and final score off it rather than adding a second
  path.
- Food rendering should use a colour outside the green ramp so the pixel-sampling
  check above keeps distinguishing snake from food.
- The `per-task/calibration/src/` folder on this machine holds only `.claude/`
  and `node_modules/` from the concurrent arm, and nothing under it is tracked on
  this branch — so `scripts/ci-require-green-pr-cost.sh` fails **locally** on it
  while passing in CI. Do not "fix" it by adding marker files to another arm's
  folder.

---

### 2026-09-02 — Task 4: Food spawning and collision detection

**Gate re-check (touches `.ts` and `.js`):**

- `lint` — `pnpm lint` (whole repo) exit 0; `npx eslint` scoped to this folder's
  `*.ts` also exit 0.
- `format` — `prettier --write` on both changed files reported them already
  formatted, then `--check` on `src/`: clean.
- `build` — `pnpm build` exit 0. Also typechecked `game.test.ts` standalone with
  the repo's flags (`--strict --moduleResolution bundler`): clean. (A `TS2578
unused @ts-expect-error` appears only if you add `--allowJs`, which the repo
  config does not — the directive is still needed under the real settings.)
- SNAKE marker gate — exit 0, all 5 tracked run `src/` folders verified.
- Attestation gate — exit 0.
- Per the prompt, vitest was **not** run; see the verification section for what
  was actually executed instead.

**Changes:**

- `src/game.js`
  - `checkWallCollision(head, gridSize)` — implemented. Cells run
    `0..gridSize-1`, so the first cell past any edge is a hit. Measures against
    the `gridSize` argument, never the module `GRID_SIZE`.
  - `checkSelfCollision(snake)` — implemented as `[head, ...body]` then
    `body.some(...)`. Only segments _behind_ the head count, so a 1-segment
    snake is never a collision.
  - `checkFoodCollision(head, food)` — new. `Boolean(food) && same cell`, so a
    null food (board full) is never a collision rather than a TypeError.
  - `spawnFood(gridSize, snake, random = Math.random)` — new. Samples random
    free cells, **capped at `gridSize * gridSize` attempts** (plan rule 2),
    then falls back to a deterministic scan for the first free cell, and only
    returns `null` when the snake covers every cell. The cap plus the scan is
    what makes a nearly-full board terminate instead of spinning.
  - `drawFood(ctx, food, cellSize)` — new; a filled circle inscribed in the
    cell. No-ops on a null food.
  - `COLORS.food` — `#ff4d4d` (the `--danger` red from style.css), deliberately
    outside the green ramp so food never reads as a body segment, on screen or
    to a pixel probe (task 3's note asked for exactly this).
  - `startGame()` — holds `food` in the closure alongside `snake`/`direction`,
    seeded with `spawnFood(GRID_SIZE, snake)`; `render()` draws food _under_ the
    snake so a head overlapping food still reads as the head.
  - `tick()` — **deleted the temporary `offBoard` local** as task 3 required;
    the real `checkWallCollision` replaces it exactly. Collisions are checked
    before eating; on a food hit the tail `moveSnake` dropped is re-appended
    (growth) and `spawnFood` is re-run against the _grown_ body.

- `src/game.test.ts`
  - Dropped `.fails` from all six `checkWallCollision` / `checkSelfCollision`
    specs (both are implemented now) and updated the header comment. No
    `it.fails(` call sites remain in the file.
  - Added `checkFoodCollision` and `spawnFood` to the typed module view, plus a
    `fakeRandom(...values)` helper — a deterministic `Math.random` stand-in that
    yields values in order then repeats the last. `spawnFood` draws twice per
    attempt (x then y), which the helper's doc comment spells out.
  - `checkFoodCollision` — 3 specs: hit, three near-misses, and null/undefined
    food.
  - `spawnFood` — 6 specs: draw-to-cell mapping (`0.5, 0.05` → `{10, 1}`); the
    `0.999` boundary must floor to 19, not round up to 20; a redraw when the
    first cell is under the snake; a 2x2 board with 3 cells taken and a random
    source stuck on the occupied `(0,0)` — this is the spec that pins the
    bail-out, and it must return `{1, 1}` via the scan; a full 2x2 board
    returning `null`; and no mutation of the caller's snake.
  - Per plan rule 1, the one constant-random spec was traced by hand
    (`Math.floor(0 * 2) = 0`, always occupied) and only exists because the
    production loop is capped — it is the regression test for that cap.

**Verification:**

- Pure logic, `node --input-type=module` + `node:assert/strict` (no vitest):
  all 9 `checkWallCollision` cases, 4 `checkSelfCollision` cases (including a
  2-segment snake stacked on itself), 5 `checkFoodCollision` cases, and all 7
  `spawnFood` cases — every assertion passed. Plus two extra sweeps not in the
  spec file: 500 real-random `spawnFood` draws against a 30-segment snake (food
  never landed on the body, never left the grid), and a 399-of-400-cells-taken
  board, which resolved to the single free cell in **0.093 ms** — the capped
  loop plus scan, comfortably inside plan rule 4's 100 ms.
- Growth arithmetic used by `tick()` asserted directly: `moveSnake` then
  re-append the saved tail turns a 3-snake into the expected 4-snake, and the
  grown snake does not self-collide.
- Browser (served `src/` over local HTTP, headless Chromium, board read back by
  sampling one pixel per grid cell and classifying head / body / food by colour):
  - Start state: 3 segments at (8,10) (9,10) (10,10), food drawn at (7,11) —
    off the snake — start overlay still visible.
  - **Growth:** autopiloted the snake onto four successive food cells. Length
    went 3 → 4 → 5 → 6 → 7, exactly one segment per food, and the replacement
    food was off the snake every time (checked against the full occupied set,
    not just the head).
  - **Wall collision:** drove straight right without turning. The snake stopped
    with the head at (19,10) — the last on-board frame — and was still at
    (19,10) six ticks later, so the interval is cleared, not merely stalled.
    This is the real `checkWallCollision` doing the work; the `offBoard` local
    it replaced is gone.
  - **Self collision:** grew to 5 segments, straightened out, then made three
    clockwise turns from (14,9). Head went (13,9) → (13,8), and the third turn
    put it back on its own neck: the board froze with the head still **on** the
    board at (13,8) and unchanged 6 ticks later — so this is the self-collision
    path, not the wall path.
  - Screenshot confirms a red circle for food against the green square snake
    with its lighter head.
  - Page console clean: only the expected `favicon.ico` 404, plus
    `getImageData` warnings from my own pixel probe, not from the game.
- Cleaned up: local HTTP server killed; screenshot, Playwright `page-*.yml`
  snapshots and `console-*.log` files deleted. `git status` shows only the two
  intended `src/` files modified.

**Notes for later tasks:**

- Task 5 owns scoring and the game-over UI. `tick()` already carries two
  `@todo task 6` markers at the exact insertion points: one where the collision
  branch calls `stop()` (hang `#gameOverOverlay` + `#finalScore` there) and one
  inside the food branch (bank `POINTS_PER_FOOD`, update `#score`). Note those
  comments say "task 6" — they are 1-indexed against the task list's own
  numbering, and they mean the _next_ task, this list's index 5.
- `stop()` inside `startGame()` is still the single place the loop halts — keep
  it that way rather than adding a second exit path.
- Task 6's restart must reset `food` as well as `snake` / `direction` / score,
  via `spawnFood(GRID_SIZE, snake)` after the snake is rebuilt — otherwise the
  new snake can start on top of the old food.
- `spawnFood` returning `null` is a real (if unreachable-in-practice) state: the
  win condition. `checkFoodCollision` and `drawFood` both already tolerate it,
  so nothing downstream needs a null guard.

---

### 2026-09-02 — Task 5: Game over logic and scoring

**Gate re-check (touches `.ts` and `.js`):**

- `lint` — `pnpm lint` (whole repo) exit 0; `eslint` scoped to this folder's
  `*.ts` also exit 0.
- `format` — `prettier --check` on `src/`: clean (no rewrite needed).
- `build` — `pnpm build` exit 0; `game.test.ts` also typechecked standalone
  under the repo's flags (`--strict --moduleResolution bundler`): clean.
- SNAKE marker gate — exit 0 (all 5 tracked run `src/` folders).
- Attestation gate — exit 0.
- `require-green-pr-cost` — still the known **local-only** exit 1 from task 0:
  the only missing folder is `runs/per-task/calibration/src/`, which is
  untracked (`git ls-files` on it is empty), so it does not exist in a CircleCI
  checkout. Left untouched — it belongs to the other arm's concurrent run.
- Per the prompt, vitest was **not** run; see verification below for what was
  actually executed instead.

**Changes:**

- `src/game.js`
  - `getNextScore(score, ateFood)` — new pure export. Returns
    `score + POINTS_PER_FOOD` when food was eaten, otherwise the score
    unchanged, so the loop can pipe every tick through one function instead of
    branching around the score.
  - `startGame()` — now also resolves `#gameOverOverlay`, `#score` and
    `#finalScore`, and holds `score` (0) plus an `isGameOver` flag in the
    closure next to `snake` / `direction` / `food`.
  - `showScore()` — pushes the running total into `#score`.
  - `endGame()` — calls the existing `stop()` (still the single place the loop
    halts), sets `isGameOver`, writes `#finalScore` and removes `hidden` from
    `#gameOverOverlay`. It deliberately does not re-render, so the last
    on-board frame stays painted and the player can see where they died.
  - `tick()` — both `@todo task 6` markers are gone: the collision branch now
    calls `endGame()` instead of bare `stop()`, and the food branch banks
    `getNextScore(score, true)` and repaints `#score`. Collisions are still
    checked before eating.
  - `run()` — bails out when `isGameOver`, so an arrow key or SPACE after death
    cannot restart the interval on a dead board. Carries a `@todo task 7` note
    (next task's restart clears the flag).
  - Initial `showScore()` alongside the first `render()`, so the display starts
    in sync with the closure's `score`.

- `src/game.test.ts`
  - Added `getNextScore` to the typed module view.
  - `getNextScore` — 3 specs: banks `POINTS_PER_FOOD` on a food tick (from 0 and
    from 30), leaves the score alone on a non-food tick, and accumulates
    correctly when folded over a run of ticks. Pure arithmetic, no timers, no
    randomness, no I/O; each is far inside plan rule 4's 100 ms.

**Verification:**

- Pure logic, `node --input-type=module` + `node:assert/strict` (no vitest):
  9 `getNextScore` cases including both boundaries, a falsy `ateFood`, repeated
  calls (no hidden state) and a 12-food fold that lands on 120. All passed.
- Browser (served `src/` over local HTTP, headless Chromium, board read back by
  sampling one pixel per grid cell and classifying head / body / food by
  colour):
  - Start state: score `0`, `#gameOverOverlay` still carrying `hidden`, snake at
    (8,10) (9,10) (10,10), food off the snake.
  - **Scoring:** autopiloted onto three successive food cells — length went
    3 → 4 → 5 → 6 and `#score` read `10`, `20`, `30` in lockstep, one helping
    per segment, replacement food off the body every time.
  - **Wall game over:** fresh load, straight right with no turns. The snake
    stopped with the head at (19,10) — the last on-board frame — the overlay
    lost `hidden` and rendered (`display` is not `none`, non-zero box), and
    `#finalScore` matched `#score`. Board unchanged 600 ms later.
  - **Self-collision game over:** fresh load, ate 4 food (`#score` `40`),
    walked the head back to (10,10) so no wall was in reach, then a tight
    clockwise square. The board froze with the head at (11,10) — well inside
    the grid, so this is the self-collision path, not the wall path — overlay
    shown, `#finalScore` `40`. Still frozen 700 ms later.
  - **Dead stays dead:** after a game over, `ArrowLeft`, SPACE and `ArrowUp`
    were all dispatched; the snake did not move for a further 900 ms, so the
    `isGameOver` guard in `run()` really does keep the interval cleared.
  - Screenshot confirms the overlay: red "GAME OVER!", "Final Score: 40", the
    restart button, and the header score also reading 40.
  - Page console clean: 0 errors on the final load; the one `getImageData`
    warning is from my pixel probe, not the game.
- Cleaned up: local HTTP server killed; screenshot, Playwright `page-*.yml`
  snapshots and the stray `src/.cache/` npm cache (created by an `npx` call in
  this session — it made the SNAKE gate fail locally by adding
  `node_modules/*/src` folders under a run) all deleted. `git status` shows only
  the two intended `src/` files modified.

**Notes for later tasks:**

- Task 6 (restart) must reset **five** things and then unhide nothing but the
  board: `snake = createInitialSnake()`, `direction` / `queuedDirection` back to
  `ArrowRight`, `food = spawnFood(GRID_SIZE, snake)` after the snake is rebuilt,
  `score = 0` followed by `showScore()`, and `isGameOver = false` — the last one
  is what lets `run()` start the interval again. Add `hidden` back to
  `#gameOverOverlay` before restarting.
- `#restartButton` is already in `index.html` and styled; only its click handler
  is missing. SPACE already routes to `run()`, so wiring restart into the same
  reset function covers both entry points.
- `endGame()` is now the single game-over path, and `stop()` is still the single
  place the interval is cleared — keep both single.
- `getNextScore` is deliberately a two-argument pure function rather than
  `score + POINTS_PER_FOOD` inline, so any future scoring rule (combo bonus,
  speed multiplier) has one place to live and one place to test.

---

### 2026-09-02 — Task 6: Restart functionality and final polish

**Gate re-check (touches `.ts`, `.js` and a new `.md`):**

- `lint` — `pnpm lint` (whole repo) exit 0.
- `format` — `prettier --write` on `src/`: only the new `README.md` was
  rewritten (table padding); `prettier --check src/` now clean. Markdown _is_
  covered by `prettier --check .`, so the new file had to go through it.
- `build` — `pnpm build` exit 0; `game.test.ts` also typechecked standalone
  under the repo's flags (`--strict --moduleResolution bundler`): clean.
- SNAKE marker gate — exit 0 (all 5 tracked run `src/` folders).
- Attestation gate + FAT-LOG noise gate — both exit 0.
- `require-green-pr-cost` — still the known **local-only** exit 1 carried since
  task 0: the single missing folder is `runs/per-task/calibration/src/`, which
  is untracked (`git ls-files` on it is empty), so it does not exist in a
  CircleCI checkout. Left untouched — it belongs to the other arm's run.
- Per the prompt, vitest was **not** run; see verification below.

**Changes:**

- `src/game.js`
  - `createInitialState(random = Math.random)` — new pure export returning the
    whole opening position: `snake`, `direction`, `queuedDirection`, `food`
    (spawned against the _rebuilt_ snake), `score` 0 and `isGameOver` false.
    This is the seam the task needed: first load and restart now read the board
    out of the same function, so "start" and "restart" cannot drift apart, and
    every call allocates fresh objects so a restart can never alias the dead
    run's snake.
  - `startGame()` — seeds all six closure variables from one
    `createInitialState()` call instead of building them inline, and resolves
    `#restartButton`.
  - `restart()` — `stop()` first (a restart can never leave two intervals on
    the same board), then reassign every field from a new
    `createInitialState()`, re-`hidden` the game-over overlay, `showScore()`,
    `render()`, `run()`. Clearing `isGameOver` is what lets `run()` arm the
    interval again.
  - Key handling — SPACE now branches: `restart()` when the game is over,
    `run()` otherwise. Arrow keys deliberately still do **not** resurrect a
    dead board (they fall through to `run()`, which bails on `isGameOver`).
  - `#restartButton` click handler — `blur()` before `restart()`. Without it a
    focused button treats the next SPACE as a click, which would silently reset
    a game that is already in progress.
  - The `@todo task 7` marker in `run()` is gone; no `@todo` markers remain in
    the file.

- `src/game.test.ts`
  - Added `createInitialState` to the typed module view.
  - `createInitialState` — 6 specs: opens with `createInitialSnake()`; heads
    right with nothing else queued; score 0 and `isGameOver` false; food on the
    board and off the snake; food re-drawn when the first draw lands on the
    snake's head (the restart-specific bug this guards is a new snake dealt on
    top of its own food); and fresh objects each call, proved by mutating one
    state and showing the next is untouched. All pure — the injected
    `fakeRandom` keeps them deterministic, no timers, no I/O, each far inside
    plan rule 4's 100 ms.

- `src/README.md` — new: how to play (SPACE to start, arrows to steer, 10
  points per food, restart button or SPACE), why it must be served over HTTP
  rather than opened as `file://` (ES module imports), a file table, the rules
  in numbers, the pure-vs-DOM split in `game.js`, and the test conventions.

**Verification:**

- Static gates as above. Pure logic is covered by the new specs; the loop
  behaviour below was driven in a real browser.
- Browser (served `src/` over local HTTP, headless Chromium, board read back by
  sampling one pixel per grid cell and classifying head / body / food by
  colour):
  - **Initial state:** start overlay visible with "Press SPACE to start",
    score `0`, game-over overlay `display: none`, snake at (8,10) (9,10)
    (10,10), food off the snake.
  - **Play:** SPACE started the loop and hid the start overlay; autopiloted
    onto three food — length 3 → 6, `#score` `10` → `20` → `30`, replacement
    food off the body every time.
  - **Die:** drove into the left wall. Head stopped at (0,0), overlay shown
    (`display: flex`, restart button 187px wide), `#finalScore` `30`, board
    byte-identical 700 ms later.
  - **Restart by button:** probed on the frame after `click()` — score `0`,
    overlay hidden again, snake back to exactly (8,10) (9,10) (10,10), fresh
    food off the snake, `document.activeElement` back to `BODY` (the `blur()`
    landed), and the head then advanced rightwards, so the loop is live.
  - **Restart by SPACE:** same result from the game-over screen — 3 segments at
    (10,10), score `0`, overlay hidden.
  - **SPACE mid-game is a no-op:** with the game genuinely running (checked
    `over() === false` at the time), SPACE left length, head cell and score
    unchanged — no stray reset.
  - **Arrows after death stay dead:** ArrowUp / ArrowLeft / ArrowDown on a
    game-over board left it byte-identical 600 ms later, overlay still up.
  - **No interval leak:** five death/restart cycles alternating button and
    SPACE, then six head samples one `TICK_MS` apart — every step was exactly
    one cell (`[1,1,1,1,1]`). Two live intervals would have shown 2s.
  - Screenshots confirm both screens: red "GAME OVER!" with "Final Score: 30"
    and the restart button, and the restarted board back at score 0.
  - Page console clean: only the expected `favicon.ico` 404 plus one
    `getImageData` warning from my own pixel probe.
- Cleaned up: local HTTP server killed; screenshots, Playwright `page-*.yml`
  snapshots and `console-*.log` files deleted.

**Notes:**

- This is the last task in `tasks.json`. `git status` for this folder shows
  exactly the three intended files: modified `src/game.js`, modified
  `src/game.test.ts`, new `src/README.md`.
- Two untracked paths appeared at the **repo root** during this session that
  are not mine: `probe-harness.mjs` (header comment: "Temporary review probe:
  step-by-step trace of startGame() against a fake DOM") and `probe-head/`,
  whose `src/game.js` and `src/game.test.ts` are byte-identical to this arm's
  files at HEAD. Both were written while this session was running, so a
  concurrent process still owns them; they were left in place rather than
  raced. They are untracked scratch and should not go into the commit — worth
  a look before the epilogue push if the orchestrator stages with `git add -A`.
- `endGame()` is still the single game-over path, `stop()` the single place the
  interval is cleared, and `createInitialState()` is now the single place a new
  board is dealt. Keep all three single.

---

### 2026-09-02 — Task 7 (finalization): Verify the epilogue push is green

**Nothing to build.** All seven implementation tasks in `tasks.json` are
`passes: true`, and this arm is `pushMode: epilogue`, so the orchestrator had
already committed each task locally and made the single unlock push. This entry
records the verification, not new code.

**Uncommitted changes — none that belong to the run:**

- `git status` for this folder is clean. Every deliverable is tracked and
  committed: `src/index.html`, `src/style.css`, `src/game.js`,
  `src/game.test.ts`, `src/README.md`, plus the three marker files
  (`SNAKE.md`, `GREEN-PR-COST.md`, `FAT-LOG.md`) and the run metadata.
- `git status --ignored` shows only harness scratch, correctly ignored:
  `.cache/`, `.ralphci/` and the 1.4 MB `LIVE-console.log`.
- The two probe paths flagged in the task 6 entry (`probe-harness.mjs`,
  `probe-head/`) are gone — the concurrent process that owned them cleaned up.
- Two untracked files remain at the **repo root**, neither of them run output:
  `vitest.review-fb80897.config.ts` (written by the Review Gate to scope vitest
  at this arm's `src/**/*.test.ts` — harness-owned, left in place) and a stray
  Playwright accessibility snapshot `page-2026-09-02T07-12-09-027Z.yml`, which
  I deleted as disposable, consistent with the cleanup in every earlier task.
  Neither was committed.

**Push state:** local `HEAD` and
`origin/experiment__cost-of-a-green-pr-single-push-calibration__d3246832` are
both `fb80897`, with an empty `origin/<branch>..HEAD` — all seven task commits
(`511b62b` → `fb80897`) went out in the one epilogue push. No new commit was
created for this task, deliberately: this replicate is calibrating the CI cost
of a _single_ push, so an extra commit would add an extra pipeline and skew the
arm's own measurement.

**CI verification** — read back from CircleCI against the exact HEAD SHA, not
from the pre-fetched banner:

- Run `8adce35d` on revision `fb80897`, created 2026-09-02 07:10 UTC —
  `phase: ended`, `current_outcome: succeeded`.
- Workflow `ci-workflow` (`801ba005`) ended `succeeded` at 07:11:38 UTC, 53 s
  wall clock. All six jobs succeeded: `lint`, `build`, `test`,
  `release-attestation`, `require-cost-of-a-green-pr-snake-md` and
  `require-green-pr-cost-md`.

**Notes:**

- `require-green-pr-cost-md` passing on CI closes out the local-only exit 1
  carried in every entry since task 0, and this run finally pins down why. The
  single folder it complained about is
  `experiments/cost-of-a-green-pr/runs/per-task/calibration/src/`, which has
  **zero tracked files** (`git ls-files` on it returns nothing) and contains
  exactly one thing on disk: a stray `node_modules/` left by an npm call in the
  other arm's run. The gate walks working-tree `src/` folders, so locally it
  sees that scratch directory and demands a `GREEN-PR-COST.md` in it; a
  CircleCI checkout has no such folder at all. The gate was never failing on
  anything real — nothing had to change, and nothing was added to the other
  arm's run to silence it.
- Per the prompt, vitest was not run in this session; the `test` job on CI is
  the authority, and it is green.
