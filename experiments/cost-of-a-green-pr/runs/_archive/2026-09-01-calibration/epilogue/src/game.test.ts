import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
// A namespace import keeps the @ts-expect-error on the specifier line, which
// is where TypeScript reports the missing declarations for plain-JS game.js.
// @ts-expect-error - game.js is plain JS without type declarations
import * as game from "./game.js";

const {
  createInitialSnake,
  moveSnake,
  checkWallCollision,
  checkSelfCollision,
  checkFoodCollision,
  spawnFood,
  getNewDirection,
  createInitialState,
  restartState,
  startState,
  overlayState,
  applyInput,
  step,
  drawSnake,
  drawFood,
  render,
  formatScore,
  gameOverMessage,
  START_MESSAGE,
  DIRECTIONS,
  KEY_DIRECTIONS,
  COLORS,
  GRID_SIZE,
  TICK_MS,
  POINTS_PER_FOOD,
} = game;

type Segment = { x: number; y: number };
type Direction = { x: number; y: number };

const UP: Direction = DIRECTIONS.UP;
const DOWN: Direction = DIRECTIONS.DOWN;
const LEFT: Direction = DIRECTIONS.LEFT;
const RIGHT: Direction = DIRECTIONS.RIGHT;

// Deterministic stand-in for Math.random. Math.floor(0.1 * 20) === 2, so food
// lands at (2, 2) — a cell the centred snake never reaches in these tests, so
// the first spawn attempt always succeeds and no test can eat by accident.
const foodAtTwoTwo = () => 0.1;

// Every state-transition test builds its state through this rather than
// calling createInitialState() bare, which would place food with Math.random
// and could drop it right in front of the snake.
const initialState = () => createInitialState(foodAtTwoTwo);

// Feeds a fixed list of values to code that calls random() repeatedly, one
// value per call, then zeros forever. Used to force a spawn retry.
function randomSequence(values: number[]) {
  let index = 0;
  return () => values[index++] ?? 0;
}

describe("GRID_SIZE", () => {
  it("is a 20x20 board as specified in the plan", () => {
    expect(GRID_SIZE).toBe(20);
  });
});

describe("DIRECTIONS", () => {
  it("uses canvas coordinates, where UP decreases y", () => {
    expect(UP).toEqual({ x: 0, y: -1 });
    expect(DOWN).toEqual({ x: 0, y: 1 });
    expect(LEFT).toEqual({ x: -1, y: 0 });
    expect(RIGHT).toEqual({ x: 1, y: 0 });
  });
});

describe("createInitialSnake", () => {
  it("returns a snake of length 3", () => {
    expect(createInitialSnake()).toHaveLength(3);
  });

  it("places every segment inside the grid", () => {
    for (const segment of createInitialSnake() as Segment[]) {
      expect(segment.x).toBeGreaterThanOrEqual(0);
      expect(segment.x).toBeLessThan(GRID_SIZE);
      expect(segment.y).toBeGreaterThanOrEqual(0);
      expect(segment.y).toBeLessThan(GRID_SIZE);
    }
  });

  it("lays the body out horizontally behind the head", () => {
    const [head, ...tail] = createInitialSnake() as Segment[];
    tail.forEach((segment, index) => {
      expect(segment.y).toBe(head.y);
      expect(segment.x).toBe(head.x - (index + 1));
    });
  });

  it("starts near the middle of the board", () => {
    const [head] = createInitialSnake() as Segment[];
    expect(head).toEqual({ x: 10, y: 10 });
  });

  it("returns a fresh array and fresh segments on each call", () => {
    const first = createInitialSnake() as Segment[];
    const second = createInitialSnake() as Segment[];
    expect(first).not.toBe(second);
    expect(first[0]).not.toBe(second[0]);
    first[0].x = 0;
    expect(second[0].x).toBe(10);
  });
});

describe("moveSnake", () => {
  it("advances the head one cell in the given direction", () => {
    const snake = createInitialSnake() as Segment[];
    expect((moveSnake(snake, RIGHT) as Segment[])[0]).toEqual({ x: 11, y: 10 });
    expect((moveSnake(snake, LEFT) as Segment[])[0]).toEqual({ x: 9, y: 10 });
    expect((moveSnake(snake, UP) as Segment[])[0]).toEqual({ x: 10, y: 9 });
    expect((moveSnake(snake, DOWN) as Segment[])[0]).toEqual({ x: 10, y: 11 });
  });

  it("keeps its length and drops the tail when not growing", () => {
    const snake = createInitialSnake() as Segment[];
    const moved = moveSnake(snake, RIGHT) as Segment[];
    expect(moved).toHaveLength(snake.length);
    expect(moved).toEqual([
      { x: 11, y: 10 },
      { x: 10, y: 10 },
      { x: 9, y: 10 },
    ]);
    // The old tail at (8, 10) is gone.
    expect(moved).not.toContainEqual({ x: 8, y: 10 });
  });

  it("keeps the tail and grows by one when growing", () => {
    const snake = createInitialSnake() as Segment[];
    const moved = moveSnake(snake, RIGHT, true) as Segment[];
    expect(moved).toHaveLength(snake.length + 1);
    expect(moved).toEqual([
      { x: 11, y: 10 },
      { x: 10, y: 10 },
      { x: 9, y: 10 },
      { x: 8, y: 10 },
    ]);
  });

  it("does not mutate the snake it was given", () => {
    const snake = createInitialSnake() as Segment[];
    const before = JSON.parse(JSON.stringify(snake));
    moveSnake(snake, UP);
    moveSnake(snake, DOWN, true);
    expect(snake).toEqual(before);
  });

  it("returns fresh segment objects rather than aliasing the input", () => {
    const snake = createInitialSnake() as Segment[];
    const moved = moveSnake(snake, RIGHT) as Segment[];
    expect(moved[1]).not.toBe(snake[0]);
    moved[1].x = -5;
    expect(snake[0].x).toBe(10);
  });

  it("walks the whole body forward over successive moves", () => {
    let snake = createInitialSnake() as Segment[];
    for (let i = 0; i < 3; i += 1) snake = moveSnake(snake, DOWN) as Segment[];
    expect(snake).toEqual([
      { x: 10, y: 13 },
      { x: 10, y: 12 },
      { x: 10, y: 11 },
    ]);
  });
});

describe("checkWallCollision", () => {
  it("is false for a head inside the grid", () => {
    expect(checkWallCollision({ x: 10, y: 10 }, GRID_SIZE)).toBe(false);
  });

  it("is false on the edge cells the snake can legally occupy", () => {
    expect(checkWallCollision({ x: 0, y: 0 }, GRID_SIZE)).toBe(false);
    expect(checkWallCollision({ x: 19, y: 19 }, GRID_SIZE)).toBe(false);
  });

  it("is true one cell past each wall", () => {
    expect(checkWallCollision({ x: -1, y: 10 }, GRID_SIZE)).toBe(true);
    expect(checkWallCollision({ x: 10, y: -1 }, GRID_SIZE)).toBe(true);
    expect(checkWallCollision({ x: 20, y: 10 }, GRID_SIZE)).toBe(true);
    expect(checkWallCollision({ x: 10, y: 20 }, GRID_SIZE)).toBe(true);
  });

  it("honours the gridSize it is given rather than the default", () => {
    expect(checkWallCollision({ x: 9, y: 9 }, 10)).toBe(false);
    expect(checkWallCollision({ x: 10, y: 9 }, 10)).toBe(true);
  });

  it("detects a snake driven off the right wall", () => {
    let snake = [{ x: 18, y: 5 }] as Segment[];
    snake = moveSnake(snake, RIGHT) as Segment[];
    expect(checkWallCollision(snake[0], GRID_SIZE)).toBe(false);
    snake = moveSnake(snake, RIGHT) as Segment[];
    expect(checkWallCollision(snake[0], GRID_SIZE)).toBe(true);
  });
});

describe("checkSelfCollision", () => {
  it("is false for a freshly created snake", () => {
    expect(checkSelfCollision(createInitialSnake())).toBe(false);
  });

  it("is false for a single-segment snake", () => {
    expect(checkSelfCollision([{ x: 3, y: 4 }])).toBe(false);
  });

  it("is true when the head sits on a body segment", () => {
    const snake: Segment[] = [
      { x: 5, y: 5 },
      { x: 5, y: 6 },
      { x: 6, y: 6 },
      { x: 6, y: 5 },
      { x: 5, y: 5 },
    ];
    expect(checkSelfCollision(snake)).toBe(true);
  });

  it("ignores overlaps that do not involve the head", () => {
    const snake: Segment[] = [
      { x: 1, y: 1 },
      { x: 2, y: 2 },
      { x: 3, y: 3 },
      { x: 2, y: 2 },
    ];
    expect(checkSelfCollision(snake)).toBe(false);
  });

  it("catches a 180-degree turn back onto the neck", () => {
    const snake = createInitialSnake() as Segment[];
    const turned = moveSnake(snake, LEFT) as Segment[];
    expect(turned[0]).toEqual({ x: 9, y: 10 });
    expect(checkSelfCollision(turned)).toBe(true);
  });
});

describe("checkFoodCollision", () => {
  it("is true when the head is on the food cell", () => {
    expect(checkFoodCollision({ x: 4, y: 7 }, { x: 4, y: 7 })).toBe(true);
  });

  it("is false when the head is anywhere else", () => {
    expect(checkFoodCollision({ x: 4, y: 7 }, { x: 5, y: 7 })).toBe(false);
    expect(checkFoodCollision({ x: 4, y: 7 }, { x: 4, y: 8 })).toBe(false);
    // The axes must both match; a swapped pair is a different cell.
    expect(checkFoodCollision({ x: 4, y: 7 }, { x: 7, y: 4 })).toBe(false);
  });

  it("is false when there is no food on the board", () => {
    expect(checkFoodCollision({ x: 4, y: 7 }, null)).toBe(false);
    expect(checkFoodCollision({ x: 4, y: 7 }, undefined)).toBe(false);
  });

  it("catches the head that a move has just placed on the food", () => {
    const food = { x: 11, y: 10 };
    const snake = createInitialSnake() as Segment[];
    expect(checkFoodCollision(snake[0], food)).toBe(false);
    const moved = moveSnake(snake, RIGHT) as Segment[];
    expect(checkFoodCollision(moved[0], food)).toBe(true);
  });
});

describe("spawnFood", () => {
  it("places food inside the grid", () => {
    const food = spawnFood(GRID_SIZE, createInitialSnake(), foodAtTwoTwo);
    expect(food.x).toBeGreaterThanOrEqual(0);
    expect(food.x).toBeLessThan(GRID_SIZE);
    expect(food.y).toBeGreaterThanOrEqual(0);
    expect(food.y).toBeLessThan(GRID_SIZE);
  });

  it("draws x and y from separate calls to the injected random", () => {
    // floor(0.1 * 20) = 2 for x, floor(0.75 * 20) = 15 for y. A single shared
    // call would put the food on the diagonal instead.
    const food = spawnFood(GRID_SIZE, [], randomSequence([0.1, 0.75]));
    expect(food).toEqual({ x: 2, y: 15 });
  });

  it("retries until it finds a cell the snake does not occupy", () => {
    const snake: Segment[] = [
      { x: 2, y: 2 },
      { x: 3, y: 2 },
    ];
    // (2, 2) is the snake's head, so the first attempt is rejected and the
    // second — (0, 0) — is taken.
    const random = randomSequence([0.1, 0.1, 0.0, 0.0]);
    expect(spawnFood(GRID_SIZE, snake, random)).toEqual({ x: 0, y: 0 });
  });

  it("falls back to a scan when the random keeps hitting occupied cells", () => {
    // A constant random is normally banned in these tests, but that is exactly
    // the input this bail-out exists for. The search is capped at
    // gridSize * gridSize = 4 attempts, so it cannot spin.
    const snake: Segment[] = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
    ];
    expect(spawnFood(2, snake, () => 0)).toEqual({ x: 1, y: 1 });
  });

  it("returns null when every cell is taken", () => {
    const snake: Segment[] = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
    ];
    expect(spawnFood(2, snake, () => 0)).toBeNull();
  });

  it("does not mutate the snake it was given", () => {
    const snake = createInitialSnake() as Segment[];
    const before = JSON.parse(JSON.stringify(snake));
    spawnFood(GRID_SIZE, snake, foodAtTwoTwo);
    expect(snake).toEqual(before);
  });
});

// The stylesheet itself is not visually testable in a node environment, but we
// can guard the contract between index.html and style.css: every class/id the
// markup relies on must actually be styled, so a rename can never silently
// leave the board unstyled.
describe("style.css", () => {
  const dir = dirname(fileURLToPath(import.meta.url));
  const css = readFileSync(join(dir, "style.css"), "utf8");
  const html = readFileSync(join(dir, "index.html"), "utf8");

  it("styles every hook the markup uses", () => {
    const hooks = [".game", ".game__score", ".game__board", "#canvas"];
    for (const hook of hooks) {
      expect(html).toContain(hook.slice(1));
      expect(css).toContain(hook);
    }
  });

  it("centers the game on the page", () => {
    expect(css).toMatch(/body\s*{[^}]*justify-content:\s*center/);
    expect(css).toMatch(/body\s*{[^}]*align-items:\s*center/);
  });

  it("gives the canvas a border and the page a dark background", () => {
    expect(css).toMatch(/#canvas\s*{[^}]*border:/);
    expect(css).toMatch(/--bg:\s*#0b0f0a/);
  });

  it("keeps the overlay hidden when the hidden attribute is set", () => {
    expect(css).toMatch(/\.game__overlay\[hidden\]\s*{\s*display:\s*none/);
  });
});

describe("getNewDirection", () => {
  it("accepts a perpendicular turn", () => {
    expect(getNewDirection(RIGHT, UP)).toEqual(UP);
    expect(getNewDirection(RIGHT, DOWN)).toEqual(DOWN);
    expect(getNewDirection(UP, LEFT)).toEqual(LEFT);
    expect(getNewDirection(UP, RIGHT)).toEqual(RIGHT);
  });

  it("rejects a 180-degree turn and keeps the current direction", () => {
    expect(getNewDirection(RIGHT, LEFT)).toEqual(RIGHT);
    expect(getNewDirection(LEFT, RIGHT)).toEqual(LEFT);
    expect(getNewDirection(UP, DOWN)).toEqual(UP);
    expect(getNewDirection(DOWN, UP)).toEqual(DOWN);
  });

  it("accepts the direction the snake is already travelling", () => {
    expect(getNewDirection(RIGHT, RIGHT)).toEqual(RIGHT);
    expect(getNewDirection(UP, UP)).toEqual(UP);
  });

  it("falls back to the current direction when there is no input", () => {
    expect(getNewDirection(RIGHT, undefined)).toEqual(RIGHT);
    expect(getNewDirection(RIGHT, null)).toEqual(RIGHT);
  });

  it("takes the input when there is no current direction", () => {
    expect(getNewDirection(undefined, UP)).toEqual(UP);
  });

  it("never lets a rejected turn eat the snake's own neck", () => {
    const snake = createInitialSnake() as Segment[];
    const direction = getNewDirection(RIGHT, LEFT) as Direction;
    const moved = moveSnake(snake, direction) as Segment[];
    expect(checkSelfCollision(moved)).toBe(false);
  });
});

describe("KEY_DIRECTIONS", () => {
  it("maps each arrow key to its direction vector", () => {
    expect(KEY_DIRECTIONS.ArrowUp).toEqual(UP);
    expect(KEY_DIRECTIONS.ArrowDown).toEqual(DOWN);
    expect(KEY_DIRECTIONS.ArrowLeft).toEqual(LEFT);
    expect(KEY_DIRECTIONS.ArrowRight).toEqual(RIGHT);
  });

  it("has no binding for other keys", () => {
    expect(KEY_DIRECTIONS[" "]).toBeUndefined();
    expect(KEY_DIRECTIONS.Enter).toBeUndefined();
  });
});

describe("createInitialState", () => {
  it("starts a centred snake travelling right", () => {
    const state = initialState();
    expect(state.snake).toEqual(createInitialSnake());
    expect(state.direction).toEqual(RIGHT);
    expect(state.pendingDirection).toEqual(RIGHT);
  });

  it("returns a fresh state each call", () => {
    const first = initialState();
    const second = initialState();
    expect(first).not.toBe(second);
    expect(first.snake).not.toBe(second.snake);
  });

  it("spawns food through the injected random", () => {
    expect(initialState().food).toEqual({ x: 2, y: 2 });
  });

  it("never starts with the food underneath the snake", () => {
    const state = initialState();
    expect(state.snake).not.toContainEqual(state.food);
  });

  it("starts unscored and in play", () => {
    const state = initialState();
    expect(state.score).toBe(0);
    expect(state.gameOver).toBe(false);
  });

  it("waits on the title card instead of moving on its own", () => {
    expect(initialState().started).toBe(false);
  });
});

describe("applyInput", () => {
  it("queues a legal turn without moving the snake", () => {
    const state = initialState();
    const turned = applyInput(state, UP);
    expect(turned.pendingDirection).toEqual(UP);
    expect(turned.direction).toEqual(RIGHT);
    expect(turned.snake).toEqual(state.snake);
  });

  it("ignores a reversal", () => {
    const state = initialState();
    expect(applyInput(state, LEFT)).toBe(state);
  });

  it("does not mutate the state it was given", () => {
    const state = initialState();
    applyInput(state, DOWN);
    expect(state.pendingDirection).toEqual(RIGHT);
  });

  // Two keys inside one tick are the classic way to reverse into your own
  // neck: turn up, then immediately left while still travelling right.
  it("keeps an already-queued turn when an illegal one follows it", () => {
    let state = initialState();
    state = applyInput(state, UP);
    state = applyInput(state, LEFT);
    expect(state.pendingDirection).toEqual(UP);
    expect(checkSelfCollision(step(state).snake)).toBe(false);
  });

  it("lets a second legal turn replace the first", () => {
    let state = initialState();
    state = applyInput(state, UP);
    state = applyInput(state, DOWN);
    expect(state.pendingDirection).toEqual(DOWN);
  });
});

describe("step", () => {
  it("advances the snake one cell along the current direction", () => {
    const state = step(initialState());
    expect((state.snake as Segment[])[0]).toEqual({ x: 11, y: 10 });
    expect(state.snake).toHaveLength(3);
  });

  it("commits the queued direction as the travelled one", () => {
    const state = step(applyInput(initialState(), UP));
    expect(state.direction).toEqual(UP);
    expect((state.snake as Segment[])[0]).toEqual({ x: 10, y: 9 });
  });

  it("keeps moving in the committed direction on later ticks", () => {
    let state = applyInput(initialState(), DOWN);
    state = step(state);
    state = step(state);
    expect((state.snake as Segment[])[0]).toEqual({ x: 10, y: 12 });
    expect(state.direction).toEqual(DOWN);
  });

  it("does not mutate the state it was given", () => {
    const state = initialState();
    const before = JSON.parse(JSON.stringify(state));
    step(state);
    expect(JSON.parse(JSON.stringify(state))).toEqual(before);
  });

  it("only reopens a reversal once the turn has been committed", () => {
    let state = applyInput(initialState(), UP);
    state = step(state);
    // Travelling up now, so LEFT is a legal turn rather than a reversal.
    state = applyInput(state, LEFT);
    expect(state.pendingDirection).toEqual(LEFT);
  });

  it("ticks at a playable interval", () => {
    expect(TICK_MS).toBeGreaterThanOrEqual(60);
    expect(TICK_MS).toBeLessThanOrEqual(250);
  });
});

describe("step — eating", () => {
  it("leaves the snake and the food alone on a tick that eats nothing", () => {
    const state = initialState();
    const next = step(state, foodAtTwoTwo);
    expect(next.snake).toHaveLength(3);
    // Same object, not just an equal one: nothing respawned.
    expect(next.food).toBe(state.food);
  });

  it("grows the snake by one when the head reaches the food", () => {
    const state = { ...initialState(), food: { x: 11, y: 10 } };
    // floor(0.25 * 20) = 5 → the replacement lands at (5, 5), well clear.
    const next = step(state, () => 0.25);
    expect(next.snake).toHaveLength(4);
    expect((next.snake as Segment[])[0]).toEqual({ x: 11, y: 10 });
    // Growing keeps the tail the snake would otherwise have dropped.
    expect(next.snake).toContainEqual({ x: 8, y: 10 });
    expect(next.food).toEqual({ x: 5, y: 5 });
  });

  it("spawns the replacement food clear of the grown snake", () => {
    const state = { ...initialState(), food: { x: 11, y: 10 } };
    // (10, 10) is still under the grown snake, so the first attempt is
    // rejected and the second — (1, 1) — is taken.
    const next = step(state, randomSequence([0.5, 0.5, 0.05, 0.05]));
    expect(next.food).toEqual({ x: 1, y: 1 });
    expect(next.snake).not.toContainEqual(next.food);
  });

  it("grows again on a second helping", () => {
    const state = { ...initialState(), food: { x: 11, y: 10 } };
    // First tick eats at (11, 10) and respawns at (12, 10), directly ahead;
    // the second tick eats that and respawns at (1, 1).
    const random = randomSequence([0.6, 0.5, 0.05, 0.05]);
    const after = step(step(state, random), random);
    expect(after.snake).toHaveLength(5);
    expect((after.snake as Segment[])[0]).toEqual({ x: 12, y: 10 });
    expect(after.food).toEqual({ x: 1, y: 1 });
  });

  it("does not mutate the state it was given", () => {
    const state = { ...initialState(), food: { x: 11, y: 10 } };
    const before = JSON.parse(JSON.stringify(state));
    step(state, () => 0.25);
    expect(JSON.parse(JSON.stringify(state))).toEqual(before);
  });

  it("only eats the food that lies on the head's next cell", () => {
    // Food one cell behind the head: travelling right must not eat it.
    const state = { ...initialState(), food: { x: 9, y: 10 } };
    const next = step(state, foodAtTwoTwo);
    expect(next.snake).toHaveLength(3);
    expect(next.food).toEqual({ x: 9, y: 10 });
  });
});

describe("step — collisions", () => {
  // Each case puts the head on the last legal cell of a wall and points it
  // straight at that wall, so the very next tick is the fatal one.
  const walls = [
    {
      name: "right",
      snake: [
        { x: 19, y: 10 },
        { x: 18, y: 10 },
        { x: 17, y: 10 },
      ],
      direction: RIGHT,
    },
    {
      name: "left",
      snake: [
        { x: 0, y: 10 },
        { x: 1, y: 10 },
        { x: 2, y: 10 },
      ],
      direction: LEFT,
    },
    {
      name: "top",
      snake: [
        { x: 10, y: 0 },
        { x: 10, y: 1 },
        { x: 10, y: 2 },
      ],
      direction: UP,
    },
    {
      name: "bottom",
      snake: [
        { x: 10, y: 19 },
        { x: 10, y: 18 },
        { x: 10, y: 17 },
      ],
      direction: DOWN,
    },
  ];

  for (const wall of walls) {
    it(`ends the game when the snake leaves the ${wall.name} wall`, () => {
      const state = {
        ...initialState(),
        snake: wall.snake,
        direction: wall.direction,
        pendingDirection: wall.direction,
      };
      const next = step(state, foodAtTwoTwo);
      expect(next.gameOver).toBe(true);
    });
  }

  it("leaves the snake on the board rather than half off it", () => {
    const state = {
      ...initialState(),
      snake: [
        { x: 19, y: 10 },
        { x: 18, y: 10 },
        { x: 17, y: 10 },
      ],
    };
    const next = step(state, foodAtTwoTwo);
    expect(next.snake).toEqual(state.snake);
    expect(checkWallCollision((next.snake as Segment[])[0], GRID_SIZE)).toBe(
      false,
    );
  });

  it("keeps playing on the last cell before the wall", () => {
    const state = {
      ...initialState(),
      snake: [
        { x: 18, y: 10 },
        { x: 17, y: 10 },
        { x: 16, y: 10 },
      ],
    };
    const next = step(state, foodAtTwoTwo);
    expect(next.gameOver).toBe(false);
    expect((next.snake as Segment[])[0]).toEqual({ x: 19, y: 10 });
  });

  // Travelling left along the top of a coiled body, then turning down into
  // the segment below the head. The tail at (4, 6) is dropped by the move,
  // but (5, 6) is not, so the head lands on live body.
  it("ends the game when the head runs into its own body", () => {
    const state = {
      ...initialState(),
      snake: [
        { x: 5, y: 5 },
        { x: 6, y: 5 },
        { x: 6, y: 6 },
        { x: 5, y: 6 },
        { x: 4, y: 6 },
      ],
      direction: LEFT,
      pendingDirection: DOWN,
    };
    const next = step(state, foodAtTwoTwo);
    expect(next.gameOver).toBe(true);
    expect(next.snake).toEqual(state.snake);
  });

  // The same coil one segment shorter, so the cell the head turns into is the
  // tail. A non-growing move vacates it first, which makes the turn legal —
  // checking collision before the move would wrongly kill the snake here.
  it("lets the head follow the cell its tail is vacating", () => {
    const state = {
      ...initialState(),
      snake: [
        { x: 5, y: 5 },
        { x: 6, y: 5 },
        { x: 6, y: 6 },
        { x: 5, y: 6 },
      ],
      direction: LEFT,
      pendingDirection: DOWN,
    };
    const next = step(state, foodAtTwoTwo);
    expect(next.gameOver).toBe(false);
    expect((next.snake as Segment[])[0]).toEqual({ x: 5, y: 6 });
    expect(next.snake).toHaveLength(4);
  });

  it("survives a full lap of the board's edge", () => {
    // A short snake hugging the wall turns along it rather than into it.
    let state = {
      ...initialState(),
      snake: [
        { x: 19, y: 10 },
        { x: 18, y: 10 },
        { x: 17, y: 10 },
      ],
    };
    state = applyInput(state, DOWN);
    for (let i = 0; i < 5; i += 1) state = step(state, foodAtTwoTwo);
    expect(state.gameOver).toBe(false);
    expect((state.snake as Segment[])[0]).toEqual({ x: 19, y: 15 });
  });

  it("does not mutate the state it was given", () => {
    const state = {
      ...initialState(),
      snake: [
        { x: 19, y: 10 },
        { x: 18, y: 10 },
        { x: 17, y: 10 },
      ],
    };
    const before = JSON.parse(JSON.stringify(state));
    step(state, foodAtTwoTwo);
    expect(JSON.parse(JSON.stringify(state))).toEqual(before);
  });

  it("freezes the state once the game is over", () => {
    const dead = { ...initialState(), gameOver: true };
    // Same object back, so a timer tick that lands after the loop stops
    // cannot walk a dead snake into a wall.
    expect(step(dead, foodAtTwoTwo)).toBe(dead);
  });
});

describe("step — scoring", () => {
  it("scores nothing on a tick that eats nothing", () => {
    expect(step(initialState(), foodAtTwoTwo).score).toBe(0);
  });

  it("scores a helping of food", () => {
    const state = { ...initialState(), food: { x: 11, y: 10 } };
    // floor(0.25 * 20) = 5 → the replacement lands at (5, 5), well clear.
    expect(step(state, () => 0.25).score).toBe(POINTS_PER_FOOD);
  });

  it("adds up across helpings", () => {
    const state = { ...initialState(), food: { x: 11, y: 10 } };
    // Respawns at (12, 10), directly ahead, so the next tick eats too.
    const random = randomSequence([0.6, 0.5, 0.05, 0.05]);
    const after = step(step(state, random), random);
    expect(after.score).toBe(2 * POINTS_PER_FOOD);
  });

  it("holds the score across ticks that eat nothing", () => {
    const state = { ...initialState(), food: { x: 11, y: 10 } };
    const fed = step(state, () => 0.25);
    expect(step(fed, foodAtTwoTwo).score).toBe(POINTS_PER_FOOD);
  });

  it("keeps the score the player earned on the fatal tick", () => {
    const state = {
      ...initialState(),
      snake: [
        { x: 19, y: 10 },
        { x: 18, y: 10 },
        { x: 17, y: 10 },
      ],
      score: 3 * POINTS_PER_FOOD,
    };
    const next = step(state, foodAtTwoTwo);
    expect(next.gameOver).toBe(true);
    expect(next.score).toBe(3 * POINTS_PER_FOOD);
  });

  it("awards a round number of points rather than a length count", () => {
    expect(POINTS_PER_FOOD).toBeGreaterThan(0);
    expect(Number.isInteger(POINTS_PER_FOOD)).toBe(true);
  });
});

// The DOM writes these strings verbatim, so pinning them here is what keeps
// the score line and the game over screen honest without a browser.
describe("score and game over text", () => {
  const dir = dirname(fileURLToPath(import.meta.url));
  const html = readFileSync(join(dir, "index.html"), "utf8");

  it("labels the score", () => {
    expect(formatScore(0)).toBe("Score: 0");
    expect(formatScore(120)).toBe("Score: 120");
  });

  it("matches the score already sitting in the markup", () => {
    // The static markup and the first repaint must agree, or the score line
    // would flicker to a different wording on the opening frame.
    expect(html).toContain(formatScore(0));
  });

  it("reports the final score on the game over screen", () => {
    const message = gameOverMessage(4 * POINTS_PER_FOOD);
    expect(message).toContain("40");
    expect(message.toLowerCase()).toContain("game over");
  });

  it("reports a zero score rather than omitting it", () => {
    expect(gameOverMessage(0)).toContain("0");
  });

  it("says something other than the start prompt", () => {
    expect(html).toContain("Press SPACE to start");
    expect(gameOverMessage(0)).not.toContain("Press SPACE to start");
  });
});

// Canvas *visuals* are out of test scope per the plan, but the grid-to-pixel
// arithmetic these functions do is ordinary logic worth pinning. A recording
// stub stands in for the 2D context — no DOM, no canvas, no I/O.
type DrawCall = { x: number; y: number; w: number; h: number; fill: string };

function recordingContext() {
  const calls: DrawCall[] = [];
  return {
    calls,
    fillStyle: "",
    fillRect(x: number, y: number, w: number, h: number) {
      calls.push({ x, y, w, h, fill: this.fillStyle });
    },
  };
}

describe("drawSnake", () => {
  it("maps each segment onto its grid cell", () => {
    const ctx = recordingContext();
    drawSnake(
      ctx,
      [
        { x: 0, y: 0 },
        { x: 3, y: 7 },
      ],
      20,
    );
    expect(ctx.calls).toHaveLength(2);
    expect(ctx.calls[0]).toMatchObject({ x: 0, y: 0, w: 19, h: 19 });
    expect(ctx.calls[1]).toMatchObject({ x: 60, y: 140, w: 19, h: 19 });
  });

  it("paints the head in a brighter colour than the body", () => {
    const ctx = recordingContext();
    drawSnake(ctx, createInitialSnake(), 20);
    expect(ctx.calls[0].fill).toBe(COLORS.head);
    expect(ctx.calls[1].fill).toBe(COLORS.body);
    expect(ctx.calls[2].fill).toBe(COLORS.body);
  });

  it("keeps a whole 20x20 board inside a 400px canvas", () => {
    const ctx = recordingContext();
    const cellSize = 400 / GRID_SIZE;
    drawSnake(ctx, [{ x: GRID_SIZE - 1, y: GRID_SIZE - 1 }], cellSize);
    const [call] = ctx.calls;
    expect(call.x + call.w).toBeLessThanOrEqual(400);
    expect(call.y + call.h).toBeLessThanOrEqual(400);
  });
});

describe("drawFood", () => {
  it("paints the food cell in a colour of its own", () => {
    const ctx = recordingContext();
    drawFood(ctx, { x: 3, y: 7 }, 20);
    expect(ctx.calls).toEqual([
      { x: 60, y: 140, w: 19, h: 19, fill: COLORS.food },
    ]);
  });

  it("uses a colour distinct from the snake and the board", () => {
    expect(COLORS.food).not.toBe(COLORS.head);
    expect(COLORS.food).not.toBe(COLORS.body);
    expect(COLORS.food).not.toBe(COLORS.board);
  });

  it("draws nothing when there is no food", () => {
    const ctx = recordingContext();
    drawFood(ctx, null, 20);
    expect(ctx.calls).toHaveLength(0);
  });
});

describe("render", () => {
  it("clears the board, then draws the food, then the snake", () => {
    const ctx = recordingContext();
    render(ctx, initialState(), 400, 400, 20);
    expect(ctx.calls[0]).toEqual({
      x: 0,
      y: 0,
      w: 400,
      h: 400,
      fill: COLORS.board,
    });
    // Food at (2, 2) with a 20px cell, drawn before the snake so the head
    // paints over it on the tick it is eaten.
    expect(ctx.calls[1]).toEqual({
      x: 40,
      y: 40,
      w: 19,
      h: 19,
      fill: COLORS.food,
    });
    expect(ctx.calls[2].fill).toBe(COLORS.head);
    expect(ctx.calls).toHaveLength(2 + createInitialSnake().length);
  });

  it("still draws the board and snake when the board is full of snake", () => {
    const ctx = recordingContext();
    const state = { ...initialState(), food: null };
    render(ctx, state, 400, 400, 20);
    expect(ctx.calls).toHaveLength(1 + createInitialSnake().length);
    expect(ctx.calls[1].fill).toBe(COLORS.head);
  });
});

describe("restartState", () => {
  it("puts the snake back at its starting position and length", () => {
    const state = restartState(foodAtTwoTwo);
    expect(state.snake).toEqual(createInitialSnake());
    expect(state.snake).toHaveLength(createInitialSnake().length);
  });

  it("resets the score to zero", () => {
    expect(restartState(foodAtTwoTwo).score).toBe(0);
  });

  it("clears the game over flag and skips the title card", () => {
    // The player has just asked for another go; making them press SPACE
    // again to confirm it would be asking twice.
    const state = restartState(foodAtTwoTwo);
    expect(state.gameOver).toBe(false);
    expect(state.started).toBe(true);
  });

  it("faces right again, whichever way the last game was going", () => {
    const state = restartState(foodAtTwoTwo);
    expect(state.direction).toEqual(RIGHT);
    expect(state.pendingDirection).toEqual(RIGHT);
  });

  it("spawns food clear of the snake through the injected random", () => {
    const state = restartState(foodAtTwoTwo);
    expect(state.food).toEqual({ x: 2, y: 2 });
    expect(state.snake).not.toContainEqual(state.food);
  });

  it("returns a fresh state each call", () => {
    const first = restartState(foodAtTwoTwo);
    const second = restartState(foodAtTwoTwo);
    expect(first).not.toBe(second);
    expect(first.snake).not.toBe(second.snake);
  });

  it("carries nothing over from the finished round", () => {
    const finished = {
      ...initialState(),
      snake: [
        { x: 19, y: 10 },
        { x: 18, y: 10 },
        { x: 17, y: 10 },
        { x: 16, y: 10 },
      ],
      direction: UP,
      pendingDirection: UP,
      score: 5 * POINTS_PER_FOOD,
      started: true,
      gameOver: true,
    };
    const fresh = restartState(foodAtTwoTwo);
    expect(fresh.snake).not.toEqual(finished.snake);
    expect(fresh.score).toBe(0);
    expect(fresh.gameOver).toBe(false);
    expect(fresh.direction).toEqual(RIGHT);
    // The finished round is a value like any other and is left intact.
    expect(finished.score).toBe(5 * POINTS_PER_FOOD);
  });
});

describe("startState", () => {
  it("begins play from the title card", () => {
    const state = startState(initialState(), foodAtTwoTwo);
    expect(state.started).toBe(true);
    expect(state.gameOver).toBe(false);
    expect(state.snake).toEqual(createInitialSnake());
  });

  it("leaves a game already in play exactly as it was", () => {
    // SPACE mid-game must not reset the round out from under the player.
    const playing = { ...initialState(), started: true };
    expect(startState(playing, foodAtTwoTwo)).toBe(playing);
  });

  it("restarts a finished game rather than resuming it", () => {
    const finished = {
      ...initialState(),
      snake: [
        { x: 19, y: 10 },
        { x: 18, y: 10 },
        { x: 17, y: 10 },
        { x: 16, y: 10 },
      ],
      score: 3 * POINTS_PER_FOOD,
      started: true,
      gameOver: true,
    };
    const next = startState(finished, foodAtTwoTwo);
    expect(next.gameOver).toBe(false);
    expect(next.started).toBe(true);
    expect(next.score).toBe(0);
    expect(next.snake).toEqual(createInitialSnake());
  });

  it("does not mutate the state it was given", () => {
    const state = initialState();
    startState(state, foodAtTwoTwo);
    expect(state.started).toBe(false);
  });
});

// The overlay is the whole of the title card and the game over screen, so
// this is where the three phases — idle, in play, over — get pinned.
describe("overlayState", () => {
  it("shows the start prompt before the first tick", () => {
    const view = overlayState(initialState());
    expect(view.hidden).toBe(false);
    expect(view.message).toBe(START_MESSAGE);
    expect(view.showRestart).toBe(false);
  });

  it("gets out of the way once the game is in play", () => {
    const playing = startState(initialState(), foodAtTwoTwo);
    expect(overlayState(playing).hidden).toBe(true);
  });

  it("stays out of the way for every tick of a running game", () => {
    let state = startState(initialState(), foodAtTwoTwo);
    // Five ticks straight down the middle: no wall, and the food sits at
    // (2, 2) where this snake never goes.
    for (let tick = 0; tick < 5; tick += 1) {
      state = step(state, foodAtTwoTwo);
      expect(overlayState(state).hidden).toBe(true);
    }
    expect(state.gameOver).toBe(false);
  });

  it("offers the restart button with the final score when the game is over", () => {
    const over = {
      ...initialState(),
      started: true,
      gameOver: true,
      score: 4 * POINTS_PER_FOOD,
    };
    const view = overlayState(over);
    expect(view.hidden).toBe(false);
    expect(view.showRestart).toBe(true);
    expect(view.message).toBe(gameOverMessage(4 * POINTS_PER_FOOD));
  });

  it("puts the restart button away again once a new game starts", () => {
    const view = overlayState(restartState(foodAtTwoTwo));
    expect(view.showRestart).toBe(false);
    expect(view.hidden).toBe(true);
  });
});

// The point of the task: a player can lose and play again without a reload.
describe("a full round — play, die, restart", () => {
  it("scores, ends, and comes back clean", () => {
    // Food one cell ahead of the head, three cells from the right wall.
    let state = {
      ...initialState(),
      started: true,
      snake: [
        { x: 18, y: 10 },
        { x: 17, y: 10 },
        { x: 16, y: 10 },
      ],
      food: { x: 19, y: 10 },
    };
    // floor(0.25 * 20) = 5 → the replacement food lands at (5, 5), clear of
    // the snake and of everything this round touches.
    const random = () => 0.25;

    state = step(state, random);
    expect(state.score).toBe(POINTS_PER_FOOD);
    expect(state.snake).toHaveLength(4);
    expect(overlayState(state).hidden).toBe(true);

    state = step(state, random);
    expect(state.gameOver).toBe(true);
    expect(state.score).toBe(POINTS_PER_FOOD);
    expect(overlayState(state).showRestart).toBe(true);

    // Dead stays dead until something restarts it.
    expect(step(state, random)).toBe(state);

    state = restartState(foodAtTwoTwo);
    expect(state.score).toBe(0);
    expect(state.snake).toEqual(createInitialSnake());
    expect(overlayState(state).hidden).toBe(true);

    state = step(state, foodAtTwoTwo);
    expect((state.snake as Segment[])[0]).toEqual({ x: 11, y: 10 });
    expect(state.gameOver).toBe(false);
    expect(state.score).toBe(0);
  });
});

// The markup carries the start prompt and the restart button; both have to
// agree with what the module writes into them.
describe("start and restart chrome", () => {
  const dir = dirname(fileURLToPath(import.meta.url));
  const html = readFileSync(join(dir, "index.html"), "utf8");
  const css = readFileSync(join(dir, "style.css"), "utf8");

  it("shows the same start prompt the first repaint writes", () => {
    expect(html).toContain(START_MESSAGE);
    expect(overlayState(initialState()).message).toBe(START_MESSAGE);
  });

  it("ships a restart button that starts out hidden", () => {
    expect(html).toMatch(/<button[^>]*id="restart"[^>]*hidden/);
  });

  it("styles the restart button and honours its hidden attribute", () => {
    expect(css).toContain(".game__restart");
    expect(css).toMatch(/\.game__restart\[hidden\]\s*{\s*display:\s*none/);
  });
});

describe("README", () => {
  const dir = dirname(fileURLToPath(import.meta.url));
  const readme = readFileSync(join(dir, "README.md"), "utf8");

  it("documents the controls the game actually binds", () => {
    expect(readme).toContain(START_MESSAGE);
    expect(readme).toMatch(/arrow/i);
    expect(readme).toMatch(/restart/i);
  });
});
