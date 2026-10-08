import { describe, it, expect, vi, afterEach } from "vitest";
// @ts-expect-error - game.js is plain JS without type declarations
import * as gameModule from "./game.js";

interface Segment {
  x: number;
  y: number;
}

type Direction = Segment;

interface GameState {
  snake: Segment[];
  direction: Direction;
  nextDirection: Direction;
  running: boolean;
  gameOver: boolean;
  score: number;
  food: Segment | null;
}

interface Game {
  state: GameState;
  render(): void;
  tick(): void;
  start(): void;
  stop(): void;
  endGame(): void;
  reset(): void;
  restart(): void;
  requestDirection(direction: Direction): boolean;
  handleKeydown(event: unknown): void;
  handleRestartClick(event?: unknown): void;
}

interface GameOptions {
  tickMs?: number;
  random?: () => number;
}

interface GameModule {
  GRID_SIZE: number;
  CELL_SIZE: number;
  TICK_MS: number;
  POINTS_PER_FOOD: number;
  COLORS: Record<
    "background" | "grid" | "snakeHead" | "snakeBody" | "food",
    string
  >;
  DIRECTIONS: Record<"up" | "down" | "left" | "right", Direction>;
  createInitialSnake(): Segment[];
  moveSnake(snake: Segment[], direction: Direction, grow?: boolean): Segment[];
  checkWallCollision(head: Segment, gridSize?: number): boolean;
  checkSelfCollision(snake: Segment[]): boolean;
  checkFoodCollision(
    head: Segment | null | undefined,
    food: Segment | null | undefined,
  ): boolean;
  spawnFood(
    gridSize: number | undefined,
    snake: Segment[],
    random: () => number,
  ): Segment | null;
  getNewDirection(
    current: Direction | null | undefined,
    input: Direction | null | undefined,
  ): Direction;
  directionFromKey(key: unknown): Direction | null;
  createGame(doc: unknown, options?: GameOptions): Game;
  startGame(doc: unknown, options?: GameOptions): Game | null;
}

const {
  GRID_SIZE,
  CELL_SIZE,
  TICK_MS,
  POINTS_PER_FOOD,
  COLORS,
  DIRECTIONS,
  createInitialSnake,
  moveSnake,
  checkWallCollision,
  checkSelfCollision,
  checkFoodCollision,
  spawnFood,
  getNewDirection,
  directionFromKey,
  createGame,
  startGame,
} = gameModule as GameModule;

const CENTRE = Math.floor(GRID_SIZE / 2);

describe("createInitialSnake", () => {
  it("returns a 3-segment snake", () => {
    expect(createInitialSnake()).toHaveLength(3);
  });

  it("returns segments with numeric coordinates inside the grid", () => {
    for (const segment of createInitialSnake()) {
      expect(typeof segment.x).toBe("number");
      expect(typeof segment.y).toBe("number");
      expect(segment.x).toBeGreaterThanOrEqual(0);
      expect(segment.x).toBeLessThan(GRID_SIZE);
      expect(segment.y).toBeGreaterThanOrEqual(0);
      expect(segment.y).toBeLessThan(GRID_SIZE);
    }
  });

  it("places the head near the centre of the grid", () => {
    const [head] = createInitialSnake();
    expect(head).toEqual({ x: CENTRE, y: CENTRE });
  });

  it("lays the body out horizontally behind the head", () => {
    const snake = createInitialSnake();
    expect(snake[1]).toEqual({ x: snake[0].x - 1, y: snake[0].y });
    expect(snake[2]).toEqual({ x: snake[0].x - 2, y: snake[0].y });
  });

  it("has no overlapping segments", () => {
    const snake = createInitialSnake();
    const keys = new Set(snake.map((s) => `${s.x},${s.y}`));
    expect(keys.size).toBe(snake.length);
  });

  it("returns a fresh array each call so mutations do not leak", () => {
    const first = createInitialSnake();
    first[0].x = 0;
    expect(createInitialSnake()[0].x).toBe(CENTRE);
  });
});

describe("moveSnake", () => {
  it("moves the head one cell in the given direction", () => {
    const snake = createInitialSnake();
    const moved = moveSnake(snake, DIRECTIONS.right);
    expect(moved[0]).toEqual({ x: CENTRE + 1, y: CENTRE });
  });

  it("moves up and down along the y axis (y grows downward)", () => {
    const snake = [{ x: 5, y: 5 }];
    expect(moveSnake(snake, DIRECTIONS.up)[0]).toEqual({ x: 5, y: 4 });
    expect(moveSnake(snake, DIRECTIONS.down)[0]).toEqual({ x: 5, y: 6 });
  });

  it("moves left and right along the x axis", () => {
    const snake = [{ x: 5, y: 5 }];
    expect(moveSnake(snake, DIRECTIONS.left)[0]).toEqual({ x: 4, y: 5 });
    expect(moveSnake(snake, DIRECTIONS.right)[0]).toEqual({ x: 6, y: 5 });
  });

  it("drops the tail so the length stays the same when not growing", () => {
    const snake = createInitialSnake();
    const moved = moveSnake(snake, DIRECTIONS.right);
    expect(moved).toHaveLength(snake.length);
    expect(moved).toEqual([
      { x: CENTRE + 1, y: CENTRE },
      { x: CENTRE, y: CENTRE },
      { x: CENTRE - 1, y: CENTRE },
    ]);
  });

  it("keeps the tail and grows by one segment when growing", () => {
    const snake = createInitialSnake();
    const moved = moveSnake(snake, DIRECTIONS.right, true);
    expect(moved).toHaveLength(snake.length + 1);
    expect(moved[moved.length - 1]).toEqual({ x: CENTRE - 2, y: CENTRE });
  });

  it("makes each segment follow the one ahead of it", () => {
    const snake = [
      { x: 5, y: 5 },
      { x: 4, y: 5 },
      { x: 3, y: 5 },
    ];
    expect(moveSnake(snake, DIRECTIONS.down)).toEqual([
      { x: 5, y: 6 },
      { x: 5, y: 5 },
      { x: 4, y: 5 },
    ]);
  });

  it("does not mutate the snake it was given", () => {
    const snake = createInitialSnake();
    const before = JSON.stringify(snake);
    moveSnake(snake, DIRECTIONS.up);
    moveSnake(snake, DIRECTIONS.left, true);
    expect(JSON.stringify(snake)).toBe(before);
  });

  it("returns fresh segment objects rather than shared references", () => {
    const snake = createInitialSnake();
    const moved = moveSnake(snake, DIRECTIONS.right);
    expect(moved[1]).toEqual(snake[0]);
    expect(moved[1]).not.toBe(snake[0]);
  });
});

describe("checkWallCollision", () => {
  it("is false for a head inside the grid", () => {
    expect(checkWallCollision({ x: CENTRE, y: CENTRE }, GRID_SIZE)).toBe(false);
  });

  it("is false on the grid edges", () => {
    expect(checkWallCollision({ x: 0, y: 0 }, GRID_SIZE)).toBe(false);
    expect(
      checkWallCollision({ x: GRID_SIZE - 1, y: GRID_SIZE - 1 }, GRID_SIZE),
    ).toBe(false);
  });

  it("is true past the left and top walls", () => {
    expect(checkWallCollision({ x: -1, y: 5 }, GRID_SIZE)).toBe(true);
    expect(checkWallCollision({ x: 5, y: -1 }, GRID_SIZE)).toBe(true);
  });

  it("is true past the right and bottom walls", () => {
    expect(checkWallCollision({ x: GRID_SIZE, y: 5 }, GRID_SIZE)).toBe(true);
    expect(checkWallCollision({ x: 5, y: GRID_SIZE }, GRID_SIZE)).toBe(true);
  });

  it("honours the gridSize argument", () => {
    expect(checkWallCollision({ x: 5, y: 5 }, 5)).toBe(true);
    expect(checkWallCollision({ x: 5, y: 5 }, 10)).toBe(false);
  });

  it("defaults to GRID_SIZE when no size is given", () => {
    expect(checkWallCollision({ x: GRID_SIZE - 1, y: 0 })).toBe(false);
    expect(checkWallCollision({ x: GRID_SIZE, y: 0 })).toBe(true);
  });

  it("detects the wall a step ahead of the snake", () => {
    const snake = [{ x: GRID_SIZE - 1, y: 5 }];
    const [head] = moveSnake(snake, DIRECTIONS.right);
    expect(checkWallCollision(head, GRID_SIZE)).toBe(true);
  });
});

describe("checkSelfCollision", () => {
  it("is false for a straight snake", () => {
    expect(checkSelfCollision(createInitialSnake())).toBe(false);
  });

  it("is false for a snake curled without overlapping", () => {
    expect(
      checkSelfCollision([
        { x: 5, y: 5 },
        { x: 4, y: 5 },
        { x: 4, y: 4 },
        { x: 5, y: 4 },
      ]),
    ).toBe(false);
  });

  it("is true when the head sits on a body segment", () => {
    expect(
      checkSelfCollision([
        { x: 5, y: 5 },
        { x: 5, y: 6 },
        { x: 4, y: 6 },
        { x: 4, y: 5 },
        { x: 5, y: 5 },
      ]),
    ).toBe(true);
  });

  it("ignores the head's own position", () => {
    expect(checkSelfCollision([{ x: 3, y: 3 }])).toBe(false);
  });

  it("is false for an empty snake", () => {
    expect(checkSelfCollision([])).toBe(false);
  });

  it("is false when the head moves into the vacated tail cell", () => {
    const snake = [
      { x: 5, y: 5 },
      { x: 4, y: 5 },
      { x: 4, y: 4 },
      { x: 5, y: 4 },
    ];
    expect(checkSelfCollision(moveSnake(snake, DIRECTIONS.up))).toBe(false);
  });

  it("is true when a growing snake bites the tail it kept", () => {
    const snake = [
      { x: 5, y: 5 },
      { x: 4, y: 5 },
      { x: 4, y: 4 },
      { x: 5, y: 4 },
    ];
    expect(checkSelfCollision(moveSnake(snake, DIRECTIONS.up, true))).toBe(
      true,
    );
  });
});

describe("checkFoodCollision", () => {
  it("is true when the head is on the food", () => {
    expect(checkFoodCollision({ x: 4, y: 7 }, { x: 4, y: 7 })).toBe(true);
  });

  it("is false when the head is one cell away on either axis", () => {
    expect(checkFoodCollision({ x: 4, y: 7 }, { x: 5, y: 7 })).toBe(false);
    expect(checkFoodCollision({ x: 4, y: 7 }, { x: 4, y: 8 })).toBe(false);
  });

  it("does not confuse the axes", () => {
    expect(checkFoodCollision({ x: 4, y: 7 }, { x: 7, y: 4 })).toBe(false);
  });

  it("is false when there is no food to eat", () => {
    expect(checkFoodCollision({ x: 4, y: 7 }, null)).toBe(false);
    expect(checkFoodCollision({ x: 4, y: 7 }, undefined)).toBe(false);
  });

  it("is false without a head", () => {
    expect(checkFoodCollision(null, { x: 4, y: 7 })).toBe(false);
  });

  it("only fires once the head actually reaches the food", () => {
    const snake = createInitialSnake();
    const food = { x: CENTRE + 1, y: CENTRE };
    expect(checkFoodCollision(snake[0], food)).toBe(false);
    expect(
      checkFoodCollision(moveSnake(snake, DIRECTIONS.right)[0], food),
    ).toBe(true);
  });

  it("ignores a cell that only the body covers", () => {
    const snake = createInitialSnake();
    expect(checkFoodCollision(snake[0], snake[1])).toBe(false);
  });
});

describe("spawnFood", () => {
  it("reads the random draws as x then y", () => {
    // floor(0.1 * 20) = 2, floor(0.2 * 20) = 4
    expect(spawnFood(20, [], fakeRandom([0.1, 0.2]))).toEqual({ x: 2, y: 4 });
  });

  it("stays inside the grid at both ends of the random range", () => {
    expect(spawnFood(20, [], fakeRandom([0, 0]))).toEqual({ x: 0, y: 0 });
    expect(spawnFood(20, [], fakeRandom([0.999, 0.999]))).toEqual({
      x: 19,
      y: 19,
    });
  });

  it("defaults to the module grid size", () => {
    expect(spawnFood(undefined, [], fakeRandom([0.999, 0.999]))).toEqual({
      x: GRID_SIZE - 1,
      y: GRID_SIZE - 1,
    });
  });

  it("redraws when the first candidate lands on the snake", () => {
    // (0.1, 0.2) -> (2,4) is occupied; (0.3, 0.35) -> (6,7) is free.
    const snake = [{ x: 2, y: 4 }];
    expect(spawnFood(20, snake, fakeRandom([0.1, 0.2, 0.3, 0.35]))).toEqual({
      x: 6,
      y: 7,
    });
  });

  it("skips over a run of occupied cells", () => {
    // The first three pairs hit the three body cells; the fourth is free.
    const draws = [0.5, 0.5, 0.45, 0.5, 0.4, 0.5, 0.55, 0.5];
    const food = spawnFood(GRID_SIZE, createInitialSnake(), fakeRandom(draws));
    expect(food).toEqual({ x: CENTRE + 1, y: CENTRE });
  });

  it("never returns a cell the snake occupies", () => {
    const snake = createInitialSnake();
    const occupied = snake.map((s) => `${s.x},${s.y}`);
    const draws = [0.5, 0.5, 0.45, 0.5, 0.4, 0.5, 0.15, 0.35];
    const food = spawnFood(GRID_SIZE, snake, fakeRandom(draws));
    expect(occupied).not.toContain(`${food?.x},${food?.y}`);
  });

  it("caps its retries and falls back to a free cell", () => {
    // A source stuck on (0,0) would spin forever without the attempt cap;
    // the fallback scan has to find the board's one remaining free cell.
    const snake = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
    ];
    expect(spawnFood(2, snake, fakeRandom([0]))).toEqual({ x: 0, y: 1 });
  });

  it("returns null when the snake fills the board", () => {
    expect(spawnFood(1, [{ x: 0, y: 0 }], fakeRandom([0]))).toBeNull();
  });
});

describe("getNewDirection", () => {
  it("accepts a perpendicular turn", () => {
    expect(getNewDirection(DIRECTIONS.right, DIRECTIONS.up)).toEqual(
      DIRECTIONS.up,
    );
    expect(getNewDirection(DIRECTIONS.up, DIRECTIONS.left)).toEqual(
      DIRECTIONS.left,
    );
  });

  it("rejects a 180-degree turn on the x axis", () => {
    expect(getNewDirection(DIRECTIONS.right, DIRECTIONS.left)).toEqual(
      DIRECTIONS.right,
    );
    expect(getNewDirection(DIRECTIONS.left, DIRECTIONS.right)).toEqual(
      DIRECTIONS.left,
    );
  });

  it("rejects a 180-degree turn on the y axis", () => {
    expect(getNewDirection(DIRECTIONS.up, DIRECTIONS.down)).toEqual(
      DIRECTIONS.up,
    );
    expect(getNewDirection(DIRECTIONS.down, DIRECTIONS.up)).toEqual(
      DIRECTIONS.down,
    );
  });

  it("keeps the current direction when the input repeats it", () => {
    expect(getNewDirection(DIRECTIONS.down, DIRECTIONS.down)).toEqual(
      DIRECTIONS.down,
    );
  });

  it("keeps the current direction when there is no input", () => {
    expect(getNewDirection(DIRECTIONS.left, null)).toEqual(DIRECTIONS.left);
    expect(getNewDirection(DIRECTIONS.left, undefined)).toEqual(
      DIRECTIONS.left,
    );
  });

  it("adopts the input when there is no current direction", () => {
    expect(getNewDirection(null, DIRECTIONS.up)).toEqual(DIRECTIONS.up);
  });

  it("never lets the snake eat its own neck", () => {
    const snake = createInitialSnake();
    const direction = getNewDirection(DIRECTIONS.right, DIRECTIONS.left);
    expect(checkSelfCollision(moveSnake(snake, direction))).toBe(false);
  });
});

describe("directionFromKey", () => {
  it("maps the four arrow keys", () => {
    expect(directionFromKey("ArrowUp")).toEqual(DIRECTIONS.up);
    expect(directionFromKey("ArrowDown")).toEqual(DIRECTIONS.down);
    expect(directionFromKey("ArrowLeft")).toEqual(DIRECTIONS.left);
    expect(directionFromKey("ArrowRight")).toEqual(DIRECTIONS.right);
  });

  it("maps WASD regardless of case", () => {
    expect(directionFromKey("w")).toEqual(DIRECTIONS.up);
    expect(directionFromKey("D")).toEqual(DIRECTIONS.right);
  });

  it("returns null for keys that do not steer", () => {
    expect(directionFromKey(" ")).toBeNull();
    expect(directionFromKey("Enter")).toBeNull();
    expect(directionFromKey(undefined)).toBeNull();
  });
});

// --- Fake DOM -------------------------------------------------------------
// The loop tests need a document, not a browser. These stubs record the fill
// rectangles the renderer draws and the listeners startGame() attaches, which
// is enough to assert on rendering and keyboard wiring in the node env.

interface FakeRect {
  x: number;
  y: number;
  w: number;
  h: number;
  fill: string;
}

function createFakeDocument() {
  const rects: FakeRect[] = [];
  const ctx = {
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 0,
    fillRect(x: number, y: number, w: number, h: number) {
      rects.push({ x, y, w, h, fill: ctx.fillStyle });
    },
    beginPath() {},
    moveTo() {},
    lineTo() {},
    stroke() {},
  };

  // One class set per overlay, so hiding the start overlay and revealing the
  // game over overlay cannot be confused for each other.
  const overlayClasses = new Set<string>();
  const gameOverClasses = new Set<string>();
  const classListFor = (classes: Set<string>) => ({
    add: (name: string) => classes.add(name),
    remove: (name: string) => classes.delete(name),
    contains: (name: string) => classes.has(name),
  });

  // The restart button records its own listeners and blur calls so the click
  // route into restart() can be driven without a browser.
  const buttonListeners: Record<string, ((event: unknown) => void)[]> = {};
  const restartButton = {
    blurred: 0,
    blur() {
      restartButton.blurred++;
    },
    addEventListener(type: string, handler: (event: unknown) => void) {
      (buttonListeners[type] ??= []).push(handler);
    },
    click(event: unknown = { preventDefault: vi.fn() }) {
      for (const handler of buttonListeners.click ?? []) handler(event);
    },
    listeners: buttonListeners,
  };

  const elements: Record<string, unknown> = {
    gameCanvas: { width: 400, height: 400, getContext: () => ctx },
    score: { textContent: "" },
    finalScore: { textContent: "" },
    startOverlay: { classList: classListFor(overlayClasses) },
    gameOverOverlay: { classList: classListFor(gameOverClasses) },
    restartButton,
  };

  const listeners: Record<string, ((event: unknown) => void)[]> = {};

  return {
    rects,
    listeners,
    overlayClasses,
    gameOverClasses,
    restartButton,
    score: elements.score as { textContent: string },
    finalScore: elements.finalScore as { textContent: string },
    getElementById: (id: string) => elements[id] ?? null,
    addEventListener(type: string, handler: (event: unknown) => void) {
      (listeners[type] ??= []).push(handler);
    },
    dispatch(type: string, event: unknown) {
      for (const handler of listeners[type] ?? []) handler(event);
    },
  };
}

/** Rectangles drawn on the last render pass (everything after the backdrop). */
function lastFrame(doc: ReturnType<typeof createFakeDocument>): FakeRect[] {
  const lastBoard = doc.rects.map((r) => r.fill).lastIndexOf(COLORS.background);
  return doc.rects.slice(lastBoard + 1);
}

/** The grid cell a drawn rectangle sits in, whatever its inset. */
function cellOf(rect: FakeRect): Segment {
  return {
    x: Math.floor(rect.x / CELL_SIZE),
    y: Math.floor(rect.y / CELL_SIZE),
  };
}

/** Snake cells drawn on the last render pass, in draw order. */
function drawnSnake(doc: ReturnType<typeof createFakeDocument>): Segment[] {
  return lastFrame(doc)
    .filter((r) => r.fill === COLORS.snakeHead || r.fill === COLORS.snakeBody)
    .map(cellOf);
}

/** The food cell drawn on the last render pass, or null if none was drawn. */
function drawnFood(doc: ReturnType<typeof createFakeDocument>): Segment | null {
  const rect = lastFrame(doc).find((r) => r.fill === COLORS.food);
  return rect ? cellOf(rect) : null;
}

/**
 * Deterministic stand-in for Math.random (prompt Rule 3 — never real
 * randomness). spawnFood() draws twice per attempt, x then y, so the list is
 * consumed as (x, y) pairs and cycles once exhausted. Every default pair maps
 * to a cell in the top-left corner that the snake never reaches in these
 * tests, so no draw is ever rejected: floor(0.05 * 20) = 1, and so on.
 */
function fakeRandom(values: number[] = [0.05, 0.05, 0.1, 0.1, 0.15, 0.15]) {
  let i = 0;
  return () => values[i++ % values.length];
}

/** createGame() with a seeded food source; `food` overrides the draw list. */
function createTestGame(
  doc: unknown = createFakeDocument(),
  options: { tickMs?: number; food?: number[] } = {},
): Game {
  return createGame(doc, {
    tickMs: options.tickMs,
    random: fakeRandom(options.food),
  });
}

function keyEvent(key: string) {
  return { key, preventDefault: vi.fn() };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("createGame rendering", () => {
  it("draws the initial snake on the canvas", () => {
    const doc = createFakeDocument();
    createTestGame(doc);
    expect(drawnSnake(doc)).toEqual(createInitialSnake());
  });

  it("paints the head in a different colour from the body", () => {
    const doc = createFakeDocument();
    createTestGame(doc);
    const cells = lastFrame(doc).filter((r) => r.w === CELL_SIZE - 2);
    expect(cells[0].fill).toBe(COLORS.snakeHead);
    expect(cells[1].fill).toBe(COLORS.snakeBody);
  });

  it("re-renders the snake after each tick", () => {
    const doc = createFakeDocument();
    const game = createTestGame(doc);
    game.tick();
    expect(drawnSnake(doc)).toEqual(game.state.snake);
  });

  it("initialises the score display to zero", () => {
    const doc = createFakeDocument();
    createTestGame(doc);
    expect(doc.score.textContent).toBe("0");
  });

  it("survives a document without a canvas", () => {
    const doc = { getElementById: () => null };
    expect(() => createTestGame(doc)).not.toThrow();
  });
});

describe("game loop", () => {
  it("does not move until it is started", () => {
    vi.useFakeTimers();
    const doc = createFakeDocument();
    const game = createTestGame(doc);
    vi.advanceTimersByTime(TICK_MS * 5);
    expect(game.state.snake).toEqual(createInitialSnake());
    expect(game.state.running).toBe(false);
  });

  it("moves one cell per tick once started", () => {
    vi.useFakeTimers();
    const doc = createFakeDocument();
    const game = createTestGame(doc);
    game.start();
    expect(game.state.running).toBe(true);

    vi.advanceTimersByTime(TICK_MS);
    expect(game.state.snake[0]).toEqual({ x: CENTRE + 1, y: CENTRE });

    vi.advanceTimersByTime(TICK_MS * 2);
    expect(game.state.snake[0]).toEqual({ x: CENTRE + 3, y: CENTRE });
    game.stop();
  });

  it("keeps the snake the same length while moving", () => {
    vi.useFakeTimers();
    const game = createTestGame();
    game.start();
    vi.advanceTimersByTime(TICK_MS * 4);
    expect(game.state.snake).toHaveLength(3);
    game.stop();
  });

  it("stops ticking after stop()", () => {
    vi.useFakeTimers();
    const game = createTestGame();
    game.start();
    vi.advanceTimersByTime(TICK_MS);
    game.stop();
    const frozen = game.state.snake;
    vi.advanceTimersByTime(TICK_MS * 5);
    expect(game.state.snake).toBe(frozen);
    expect(game.state.running).toBe(false);
  });

  it("does not stack a second interval when started twice", () => {
    vi.useFakeTimers();
    const game = createTestGame();
    game.start();
    game.start();
    vi.advanceTimersByTime(TICK_MS);
    expect(game.state.snake[0]).toEqual({ x: CENTRE + 1, y: CENTRE });
    game.stop();
  });

  it("honours a custom tick interval", () => {
    vi.useFakeTimers();
    const game = createTestGame(createFakeDocument(), { tickMs: 10 });
    game.start();
    vi.advanceTimersByTime(30);
    expect(game.state.snake[0]).toEqual({ x: CENTRE + 3, y: CENTRE });
    game.stop();
  });
});

describe("keyboard controls", () => {
  it("turns the snake on an arrow key at the next tick", () => {
    vi.useFakeTimers();
    const game = createTestGame();
    game.start();
    game.handleKeydown(keyEvent("ArrowUp"));
    vi.advanceTimersByTime(TICK_MS);
    expect(game.state.snake[0]).toEqual({ x: CENTRE, y: CENTRE - 1 });
    game.stop();
  });

  it("steers in all four directions", () => {
    vi.useFakeTimers();
    const game = createTestGame();
    // One tick between turns: each turn is only legal relative to the
    // direction the snake is actually travelling in.
    game.handleKeydown(keyEvent("ArrowDown"));
    expect(game.state.nextDirection).toEqual(DIRECTIONS.down);
    game.tick();
    game.handleKeydown(keyEvent("ArrowLeft"));
    expect(game.state.nextDirection).toEqual(DIRECTIONS.left);
    game.tick();
    game.handleKeydown(keyEvent("ArrowUp"));
    expect(game.state.nextDirection).toEqual(DIRECTIONS.up);
    game.tick();
    game.handleKeydown(keyEvent("ArrowRight"));
    expect(game.state.nextDirection).toEqual(DIRECTIONS.right);
    game.tick();
    // down, left, up, right around a unit square is back where it started.
    expect(game.state.snake[0]).toEqual({ x: CENTRE, y: CENTRE });
    game.stop();
  });

  it("ignores a 180-degree turn", () => {
    vi.useFakeTimers();
    const game = createTestGame();
    game.start();
    game.handleKeydown(keyEvent("ArrowLeft"));
    vi.advanceTimersByTime(TICK_MS);
    expect(game.state.snake[0]).toEqual({ x: CENTRE + 1, y: CENTRE });
    expect(checkSelfCollision(game.state.snake)).toBe(false);
    game.stop();
  });

  it("does not let a rejected reversal clobber a queued turn", () => {
    vi.useFakeTimers();
    const game = createTestGame();
    game.handleKeydown(keyEvent("ArrowUp"));
    game.handleKeydown(keyEvent("ArrowLeft"));
    expect(game.state.nextDirection).toEqual(DIRECTIONS.up);
    game.stop();
  });

  it("ignores keys that do not steer", () => {
    const game = createTestGame();
    game.handleKeydown(keyEvent("Enter"));
    expect(game.state.nextDirection).toEqual(DIRECTIONS.right);
    expect(game.state.running).toBe(false);
  });

  it("calls preventDefault so arrow keys do not scroll the page", () => {
    vi.useFakeTimers();
    const game = createTestGame();
    const event = keyEvent("ArrowUp");
    game.handleKeydown(event);
    expect(event.preventDefault).toHaveBeenCalled();
    game.stop();
  });

  it("starts the game on SPACE and hides the start overlay", () => {
    vi.useFakeTimers();
    const doc = createFakeDocument();
    const game = createTestGame(doc);
    expect(doc.overlayClasses.has("hidden")).toBe(false);
    game.handleKeydown(keyEvent(" "));
    expect(game.state.running).toBe(true);
    expect(doc.overlayClasses.has("hidden")).toBe(true);
    vi.advanceTimersByTime(TICK_MS);
    expect(game.state.snake[0]).toEqual({ x: CENTRE + 1, y: CENTRE });
    game.stop();
  });

  it("also starts the game on the first arrow key", () => {
    vi.useFakeTimers();
    const game = createTestGame();
    game.handleKeydown(keyEvent("ArrowDown"));
    expect(game.state.running).toBe(true);
    game.stop();
  });
});

describe("startGame", () => {
  it("listens for keydown on the document", () => {
    vi.useFakeTimers();
    const doc = createFakeDocument();
    const game = startGame(doc, { random: fakeRandom() });
    expect(doc.listeners.keydown).toHaveLength(1);

    doc.dispatch("keydown", keyEvent("ArrowUp"));
    vi.advanceTimersByTime(TICK_MS);
    expect(game?.state.snake[0]).toEqual({ x: CENTRE, y: CENTRE - 1 });
    game?.stop();
  });

  it("returns null without a usable document", () => {
    expect(startGame(null)).toBeNull();
    expect(startGame({})).toBeNull();
  });
});

describe("food rendering", () => {
  it("draws the food in a colour of its own", () => {
    expect(COLORS.food).not.toBe(COLORS.snakeHead);
    expect(COLORS.food).not.toBe(COLORS.snakeBody);
    expect(COLORS.food).not.toBe(COLORS.background);
  });

  it("draws the food at the cell it spawned in", () => {
    const doc = createFakeDocument();
    const game = createTestGame(doc);
    expect(game.state.food).toEqual({ x: 1, y: 1 });
    expect(drawnFood(doc)).toEqual(game.state.food);
  });

  it("spawns the opening food off the snake", () => {
    const game = createTestGame();
    const occupied = game.state.snake.map((s) => `${s.x},${s.y}`);
    expect(occupied).not.toContain(
      `${game.state.food?.x},${game.state.food?.y}`,
    );
  });

  it("keeps drawing the food while the snake moves past it", () => {
    const doc = createFakeDocument();
    const game = createTestGame(doc);
    game.tick();
    game.tick();
    expect(drawnFood(doc)).toEqual({ x: 1, y: 1 });
    expect(drawnSnake(doc)).toEqual(game.state.snake);
  });
});

describe("eating food", () => {
  // Draws for a game whose food sits one cell ahead of the opening snake:
  // (0.55, 0.5) -> (11,10), then (0.05, 0.05) -> (1,1) for the replacement.
  const AHEAD = [0.55, 0.5, 0.05, 0.05];

  it("puts the seeded food directly in the snake's path", () => {
    const game = createTestGame(createFakeDocument(), { food: AHEAD });
    expect(game.state.food).toEqual({ x: CENTRE + 1, y: CENTRE });
  });

  it("grows the snake by one segment when it eats", () => {
    const game = createTestGame(createFakeDocument(), { food: AHEAD });
    expect(game.state.snake).toHaveLength(3);
    game.tick();
    expect(game.state.snake).toHaveLength(4);
    expect(game.state.snake[0]).toEqual({ x: CENTRE + 1, y: CENTRE });
  });

  it("keeps the tail cell it would otherwise have dropped", () => {
    const game = createTestGame(createFakeDocument(), { food: AHEAD });
    const tail = game.state.snake[game.state.snake.length - 1];
    game.tick();
    expect(game.state.snake[game.state.snake.length - 1]).toEqual(tail);
    expect(game.state.snake).toEqual([
      { x: CENTRE + 1, y: CENTRE },
      { x: CENTRE, y: CENTRE },
      { x: CENTRE - 1, y: CENTRE },
      { x: CENTRE - 2, y: CENTRE },
    ]);
  });

  it("does not grow on a tick that misses the food", () => {
    const game = createTestGame(createFakeDocument());
    game.tick();
    expect(game.state.snake).toHaveLength(3);
    expect(game.state.food).toEqual({ x: 1, y: 1 });
  });

  it("spawns replacement food that is not on the grown snake", () => {
    const game = createTestGame(createFakeDocument(), { food: AHEAD });
    game.tick();
    expect(game.state.food).toEqual({ x: 1, y: 1 });
    const occupied = game.state.snake.map((s) => `${s.x},${s.y}`);
    expect(occupied).not.toContain(
      `${game.state.food?.x},${game.state.food?.y}`,
    );
  });

  it("does not leave the eaten food on the board", () => {
    const game = createTestGame(createFakeDocument(), { food: AHEAD });
    const eaten = game.state.food;
    game.tick();
    expect(game.state.food).not.toEqual(eaten);
  });

  it("redraws the grown snake and the replacement food", () => {
    const doc = createFakeDocument();
    const game = createTestGame(doc, { food: AHEAD });
    game.tick();
    expect(drawnSnake(doc)).toEqual(game.state.snake);
    expect(drawnSnake(doc)).toHaveLength(4);
    expect(drawnFood(doc)).toEqual(game.state.food);
  });

  it("grows once per piece of food, not once per tick", () => {
    vi.useFakeTimers();
    const game = createTestGame(createFakeDocument(), { food: AHEAD });
    game.start();
    vi.advanceTimersByTime(TICK_MS * 3);
    expect(game.state.snake).toHaveLength(4);
    expect(game.state.snake[0]).toEqual({ x: CENTRE + 3, y: CENTRE });
    game.stop();
  });

  it("grows through the running game loop, not just a manual tick", () => {
    vi.useFakeTimers();
    const game = createTestGame(createFakeDocument(), { food: AHEAD });
    game.start();
    vi.advanceTimersByTime(TICK_MS);
    expect(game.state.snake).toHaveLength(4);
    game.stop();
  });

  it("still eats food it reaches after a turn", () => {
    vi.useFakeTimers();
    // (0.5, 0.45) -> (10,9): one cell above the head, i.e. straight up.
    const game = createTestGame(createFakeDocument(), {
      food: [0.5, 0.45, 0.05, 0.05],
    });
    expect(game.state.food).toEqual({ x: CENTRE, y: CENTRE - 1 });
    game.handleKeydown(keyEvent("ArrowUp"));
    game.tick();
    expect(game.state.snake).toHaveLength(4);
    expect(game.state.snake[0]).toEqual({ x: CENTRE, y: CENTRE - 1 });
    game.stop();
  });

  it("does not tangle the grown snake in itself", () => {
    const game = createTestGame(createFakeDocument(), { food: AHEAD });
    game.tick();
    expect(checkSelfCollision(game.state.snake)).toBe(false);
  });
});

describe("game over", () => {
  // The opening snake's head sits at (CENTRE, CENTRE) facing right, so it
  // reaches the wall at x = GRID_SIZE after this many ticks.
  const TICKS_TO_RIGHT_WALL = GRID_SIZE - CENTRE;

  /** A snake coiled so that turning down puts its head into its own flank. */
  function coiledSnake(): Segment[] {
    return [
      { x: 5, y: 5 }, // head
      { x: 4, y: 5 },
      { x: 4, y: 6 },
      { x: 5, y: 6 }, // directly below the head, and not the tail
      { x: 6, y: 6 },
      { x: 6, y: 5 }, // tail — dropped this tick, so it cannot save the snake
    ];
  }

  /** Run a started game until it dies, or give up after `limit` ticks. */
  function playUntilOver(game: Game, limit = GRID_SIZE * 2) {
    game.start();
    vi.advanceTimersByTime(TICK_MS * limit);
    return game;
  }

  it("does not start out over", () => {
    const game = createTestGame();
    expect(game.state.gameOver).toBe(false);
    expect(game.state.running).toBe(false);
  });

  it("keeps the game over overlay hidden until the snake dies", () => {
    const doc = createFakeDocument();
    createTestGame(doc);
    expect(doc.gameOverClasses.has("hidden")).toBe(true);
  });

  it("does not end the game while the snake is inside the grid", () => {
    vi.useFakeTimers();
    const game = createTestGame();
    game.start();
    vi.advanceTimersByTime(TICK_MS * (TICKS_TO_RIGHT_WALL - 1));
    expect(game.state.gameOver).toBe(false);
    expect(game.state.running).toBe(true);
    game.stop();
  });

  it("ends the game when the snake runs into a wall", () => {
    vi.useFakeTimers();
    const game = playUntilOver(createTestGame(), TICKS_TO_RIGHT_WALL);
    expect(game.state.gameOver).toBe(true);
    expect(game.state.running).toBe(false);
  });

  it("leaves the snake on the last cell inside the grid", () => {
    vi.useFakeTimers();
    const game = playUntilOver(createTestGame(), TICKS_TO_RIGHT_WALL);
    expect(game.state.snake[0]).toEqual({ x: GRID_SIZE - 1, y: CENTRE });
    for (const segment of game.state.snake) {
      expect(checkWallCollision(segment, GRID_SIZE)).toBe(false);
    }
  });

  it("stops the loop so the snake cannot keep moving", () => {
    vi.useFakeTimers();
    const game = playUntilOver(createTestGame(), TICKS_TO_RIGHT_WALL);
    const frozen = game.state.snake;
    vi.advanceTimersByTime(TICK_MS * 5);
    expect(game.state.snake).toBe(frozen);
  });

  it("reveals the game over overlay", () => {
    vi.useFakeTimers();
    const doc = createFakeDocument();
    playUntilOver(createTestGame(doc), TICKS_TO_RIGHT_WALL);
    expect(doc.gameOverClasses.has("hidden")).toBe(false);
  });

  // A one-segment snake can be pointed at any wall; a three-segment one
  // cannot turn back along its own body.
  const WALLS = [
    { name: "right", direction: DIRECTIONS.right, ticks: GRID_SIZE - CENTRE },
    { name: "bottom", direction: DIRECTIONS.down, ticks: GRID_SIZE - CENTRE },
    { name: "left", direction: DIRECTIONS.left, ticks: CENTRE + 1 },
    { name: "top", direction: DIRECTIONS.up, ticks: CENTRE + 1 },
  ];

  for (const wall of WALLS) {
    it(`ends the game at the ${wall.name} wall`, () => {
      vi.useFakeTimers();
      const game = createTestGame();
      game.state.snake = [{ x: CENTRE, y: CENTRE }];
      game.state.direction = wall.direction;
      game.state.nextDirection = wall.direction;
      game.start();

      vi.advanceTimersByTime(TICK_MS * (wall.ticks - 1));
      expect(game.state.gameOver).toBe(false);
      expect(checkWallCollision(game.state.snake[0], GRID_SIZE)).toBe(false);

      vi.advanceTimersByTime(TICK_MS);
      expect(game.state.gameOver).toBe(true);
      expect(game.state.running).toBe(false);
    });
  }

  it("ends the game when the snake runs into itself", () => {
    const game = createTestGame();
    game.state.snake = coiledSnake();
    game.state.direction = DIRECTIONS.down;
    game.state.nextDirection = DIRECTIONS.down;
    game.tick();
    expect(game.state.gameOver).toBe(true);
    expect(game.state.running).toBe(false);
    expect(game.state.snake).toEqual(coiledSnake());
  });

  it("does not end the game when the head follows its own tail", () => {
    // Moving into the cell the tail is vacating this tick is legal.
    const game = createTestGame();
    game.state.snake = [
      { x: 5, y: 5 },
      { x: 5, y: 6 },
      { x: 4, y: 6 },
      { x: 4, y: 5 }, // tail — the cell the head is about to move into
    ];
    game.state.direction = DIRECTIONS.left;
    game.state.nextDirection = DIRECTIONS.left;
    game.tick();
    expect(game.state.gameOver).toBe(false);
    expect(game.state.snake[0]).toEqual({ x: 4, y: 5 });
    expect(game.state.snake).toHaveLength(4);
  });

  it("ignores tick() once the game is over", () => {
    vi.useFakeTimers();
    const game = playUntilOver(createTestGame(), TICKS_TO_RIGHT_WALL);
    const frozen = game.state.snake;
    game.tick();
    expect(game.state.snake).toBe(frozen);
    expect(game.state.gameOver).toBe(true);
  });

  it("cannot be restarted with start()", () => {
    vi.useFakeTimers();
    const game = playUntilOver(createTestGame(), TICKS_TO_RIGHT_WALL);
    const frozen = game.state.snake;
    game.start();
    expect(game.state.running).toBe(false);
    vi.advanceTimersByTime(TICK_MS * 3);
    expect(game.state.snake).toBe(frozen);
  });

  it("ignores steering keys once the game is over", () => {
    vi.useFakeTimers();
    const game = playUntilOver(createTestGame(), TICKS_TO_RIGHT_WALL);
    game.handleKeydown(keyEvent("ArrowUp"));
    expect(game.state.nextDirection).toEqual(DIRECTIONS.right);
    expect(game.state.running).toBe(false);
  });

  // SPACE is the exception to the "keys are inert once over" rule — it is
  // wired to restart(), and the `restart` suite below covers what it does.
});

describe("score", () => {
  // (0.55, 0.5) -> (11,10), one cell ahead of the opening head; the second
  // pair, (0.6, 0.5) -> (12,10), is one ahead of the snake that just grew;
  // (0.05, 0.05) -> (1,1) parks the leftovers well out of the way.
  const AHEAD = [0.55, 0.5, 0.05, 0.05];
  const TWO_AHEAD = [0.55, 0.5, 0.6, 0.5, 0.05, 0.05];
  const TICKS_TO_RIGHT_WALL = GRID_SIZE - CENTRE;

  it("starts at zero, in state and on the page", () => {
    const doc = createFakeDocument();
    const game = createTestGame(doc);
    expect(game.state.score).toBe(0);
    expect(doc.score.textContent).toBe("0");
  });

  it("awards POINTS_PER_FOOD for a piece of food", () => {
    expect(POINTS_PER_FOOD).toBeGreaterThan(0);
    const game = createTestGame(createFakeDocument(), { food: AHEAD });
    game.tick();
    expect(game.state.score).toBe(POINTS_PER_FOOD);
  });

  it("updates the score display when food is eaten", () => {
    const doc = createFakeDocument();
    const game = createTestGame(doc, { food: AHEAD });
    game.tick();
    expect(doc.score.textContent).toBe(String(POINTS_PER_FOOD));
    expect(doc.score.textContent).toBe(String(game.state.score));
  });

  it("does not score on a tick that misses the food", () => {
    const doc = createFakeDocument();
    const game = createTestGame(doc);
    game.tick();
    expect(game.state.score).toBe(0);
    expect(doc.score.textContent).toBe("0");
  });

  it("scores once per piece of food, not once per tick", () => {
    vi.useFakeTimers();
    const game = createTestGame(createFakeDocument(), { food: AHEAD });
    game.start();
    vi.advanceTimersByTime(TICK_MS * 3);
    expect(game.state.score).toBe(POINTS_PER_FOOD);
    game.stop();
  });

  it("accumulates across several pieces of food", () => {
    const game = createTestGame(createFakeDocument(), { food: TWO_AHEAD });
    game.tick();
    expect(game.state.score).toBe(POINTS_PER_FOOD);
    expect(game.state.food).toEqual({ x: CENTRE + 2, y: CENTRE });
    game.tick();
    expect(game.state.score).toBe(POINTS_PER_FOOD * 2);
    expect(game.state.snake).toHaveLength(5);
  });

  it("shows the final score on the game over overlay", () => {
    vi.useFakeTimers();
    const doc = createFakeDocument();
    const game = createTestGame(doc, { food: AHEAD });
    expect(doc.finalScore.textContent).toBe("");
    game.start();
    vi.advanceTimersByTime(TICK_MS * TICKS_TO_RIGHT_WALL);
    expect(game.state.gameOver).toBe(true);
    expect(game.state.score).toBe(POINTS_PER_FOOD);
    expect(doc.finalScore.textContent).toBe(String(POINTS_PER_FOOD));
  });

  it("keeps the score once the game is over", () => {
    vi.useFakeTimers();
    const game = createTestGame(createFakeDocument(), { food: AHEAD });
    game.start();
    vi.advanceTimersByTime(TICK_MS * TICKS_TO_RIGHT_WALL);
    game.tick();
    expect(game.state.score).toBe(POINTS_PER_FOOD);
  });
});

describe("restart", () => {
  // The opening snake faces right from (CENTRE, CENTRE), so this many ticks
  // walk it into the right-hand wall; turned upward it needs CENTRE + 1.
  const TICKS_TO_RIGHT_WALL = GRID_SIZE - CENTRE;
  const TICKS_TO_TOP_WALL = CENTRE + 1;
  // (0.55, 0.5) -> (11,10), one cell ahead of the opening head, so the first
  // tick eats; (0.05, 0.05) -> (1,1) parks the replacement out of the way.
  // The list cycles, so the food drawn after a restart is (11,10) again.
  const AHEAD = [0.55, 0.5, 0.05, 0.05];
  // The default draw list's second pair: floor(0.1 * 20) = 2 on both axes, so
  // the food a restart spawns lands at (2,2), well clear of the fresh snake.
  const FOOD_AFTER_RESTART: Segment = { x: 2, y: 2 };

  /** Start a game and run it into a wall; returns it dead. */
  function playToDeath(game: Game, ticks = TICKS_TO_RIGHT_WALL): Game {
    game.start();
    vi.advanceTimersByTime(TICK_MS * ticks);
    return game;
  }

  it("clears the game over flag and runs again", () => {
    vi.useFakeTimers();
    const game = playToDeath(createTestGame());
    expect(game.state.gameOver).toBe(true);

    game.restart();
    expect(game.state.gameOver).toBe(false);
    expect(game.state.running).toBe(true);
    game.stop();
  });

  it("resets the snake to its opening position and length", () => {
    vi.useFakeTimers();
    const game = playToDeath(
      createTestGame(createFakeDocument(), {
        food: AHEAD,
      }),
    );
    expect(game.state.snake).toHaveLength(4);

    game.restart();
    expect(game.state.snake).toEqual(createInitialSnake());
    expect(game.state.snake).toHaveLength(3);
    game.stop();
  });

  it("resets the score to zero, in state and on the page", () => {
    vi.useFakeTimers();
    const doc = createFakeDocument();
    const game = playToDeath(createTestGame(doc, { food: AHEAD }));
    expect(game.state.score).toBe(POINTS_PER_FOOD);

    game.restart();
    expect(game.state.score).toBe(0);
    expect(doc.score.textContent).toBe("0");
    game.stop();
  });

  it("hides the game over overlay again", () => {
    vi.useFakeTimers();
    const doc = createFakeDocument();
    const game = playToDeath(createTestGame(doc));
    expect(doc.gameOverClasses.has("hidden")).toBe(false);

    game.restart();
    expect(doc.gameOverClasses.has("hidden")).toBe(true);
    game.stop();
  });

  it("keeps the start overlay out of the way while playing on", () => {
    vi.useFakeTimers();
    const doc = createFakeDocument();
    const game = playToDeath(createTestGame(doc));

    game.restart();
    expect(doc.overlayClasses.has("hidden")).toBe(true);
    game.stop();
  });

  it("points the snake right again, whatever it died facing", () => {
    vi.useFakeTimers();
    const game = createTestGame();
    game.start();
    game.handleKeydown(keyEvent("ArrowUp"));
    vi.advanceTimersByTime(TICK_MS * TICKS_TO_TOP_WALL);
    expect(game.state.gameOver).toBe(true);
    expect(game.state.direction).toEqual(DIRECTIONS.up);

    game.restart();
    expect(game.state.direction).toEqual(DIRECTIONS.right);
    expect(game.state.nextDirection).toEqual(DIRECTIONS.right);
    game.stop();
  });

  it("moves again on the very next tick", () => {
    vi.useFakeTimers();
    const game = playToDeath(createTestGame());

    game.restart();
    vi.advanceTimersByTime(TICK_MS);
    expect(game.state.snake[0]).toEqual({ x: CENTRE + 1, y: CENTRE });
    expect(game.state.snake).toHaveLength(3);
    game.stop();
  });

  it("clears the old loop instead of stacking a second one", () => {
    vi.useFakeTimers();
    const game = createTestGame();
    game.start();
    vi.advanceTimersByTime(TICK_MS * 2);
    expect(game.state.snake[0]).toEqual({ x: CENTRE + 2, y: CENTRE });

    // Restarting a *live* game: one interval must be cleared as the next is
    // set, or the snake would move two cells per tick from here on.
    game.restart();
    vi.advanceTimersByTime(TICK_MS);
    expect(game.state.snake[0]).toEqual({ x: CENTRE + 1, y: CENTRE });
    game.stop();
  });

  it("survives being restarted twice in a row", () => {
    vi.useFakeTimers();
    const game = playToDeath(createTestGame());
    game.restart();
    game.restart();
    vi.advanceTimersByTime(TICK_MS);
    expect(game.state.snake[0]).toEqual({ x: CENTRE + 1, y: CENTRE });
    game.stop();
  });

  it("spawns a fresh piece of food clear of the new snake", () => {
    vi.useFakeTimers();
    const game = playToDeath(createTestGame());

    game.restart();
    expect(game.state.food).toEqual(FOOD_AFTER_RESTART);
    const occupied = game.state.snake.map((s) => `${s.x},${s.y}`);
    expect(occupied).not.toContain(
      `${game.state.food?.x},${game.state.food?.y}`,
    );
    game.stop();
  });

  it("redraws the opening board", () => {
    vi.useFakeTimers();
    const doc = createFakeDocument();
    const game = playToDeath(createTestGame(doc));

    game.restart();
    expect(drawnSnake(doc)).toEqual(createInitialSnake());
    expect(drawnFood(doc)).toEqual(FOOD_AFTER_RESTART);
    game.stop();
  });

  it("restarts when the overlay's button is clicked", () => {
    vi.useFakeTimers();
    const doc = createFakeDocument();
    const game = playToDeath(createTestGame(doc, { food: AHEAD }));

    doc.restartButton.click();
    expect(game.state.gameOver).toBe(false);
    expect(game.state.running).toBe(true);
    expect(game.state.score).toBe(0);
    expect(game.state.snake).toEqual(createInitialSnake());
    game.stop();
  });

  it("wires the button once, when the game is built", () => {
    const doc = createFakeDocument();
    createTestGame(doc);
    expect(doc.restartButton.listeners.click).toHaveLength(1);
  });

  it("blurs the button so SPACE cannot re-trigger the click", () => {
    vi.useFakeTimers();
    const doc = createFakeDocument();
    const game = playToDeath(createTestGame(doc));
    expect(doc.restartButton.blurred).toBe(0);

    doc.restartButton.click();
    expect(doc.restartButton.blurred).toBe(1);
    game.stop();
  });

  it("restarts on SPACE once the game is over", () => {
    vi.useFakeTimers();
    const doc = createFakeDocument();
    const game = playToDeath(createTestGame(doc, { food: AHEAD }));
    const event = keyEvent(" ");

    game.handleKeydown(event);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(game.state.gameOver).toBe(false);
    expect(game.state.running).toBe(true);
    expect(game.state.score).toBe(0);
    expect(doc.gameOverClasses.has("hidden")).toBe(true);
    game.stop();
  });

  it("does not reset a game that is merely running when SPACE is pressed", () => {
    vi.useFakeTimers();
    const game = createTestGame(createFakeDocument(), { food: AHEAD });
    game.start();
    vi.advanceTimersByTime(TICK_MS * 2);
    const head = game.state.snake[0];
    const score = game.state.score;

    game.handleKeydown(keyEvent(" "));
    expect(game.state.snake[0]).toEqual(head);
    expect(game.state.score).toBe(score);
    expect(game.state.running).toBe(true);
    game.stop();
  });

  it("can be played, lost and restarted end to end", () => {
    vi.useFakeTimers();
    const doc = createFakeDocument();
    const game = createTestGame(doc, { food: AHEAD });

    // Play: start on SPACE, eat the food one cell ahead, run into the wall.
    game.handleKeydown(keyEvent(" "));
    expect(game.state.running).toBe(true);
    vi.advanceTimersByTime(TICK_MS * TICKS_TO_RIGHT_WALL);
    expect(game.state.score).toBe(POINTS_PER_FOOD);
    expect(game.state.gameOver).toBe(true);
    expect(doc.finalScore.textContent).toBe(String(POINTS_PER_FOOD));

    // Restart: the board is back to its opening state and playing again.
    doc.restartButton.click();
    expect(game.state.gameOver).toBe(false);
    expect(game.state.snake).toEqual(createInitialSnake());
    expect(doc.score.textContent).toBe("0");

    // ...and it can be lost all over again.
    vi.advanceTimersByTime(TICK_MS * TICKS_TO_RIGHT_WALL);
    expect(game.state.gameOver).toBe(true);
    expect(game.state.running).toBe(false);
    expect(game.state.score).toBe(POINTS_PER_FOOD);
    expect(doc.gameOverClasses.has("hidden")).toBe(false);
  });

  it("leaves the board idle behind the start overlay after reset()", () => {
    vi.useFakeTimers();
    const doc = createFakeDocument();
    const game = playToDeath(createTestGame(doc, { food: AHEAD }));

    game.reset();
    expect(game.state.gameOver).toBe(false);
    expect(game.state.running).toBe(false);
    expect(game.state.score).toBe(0);
    expect(game.state.snake).toEqual(createInitialSnake());
    expect(doc.gameOverClasses.has("hidden")).toBe(true);
    expect(doc.overlayClasses.has("hidden")).toBe(false);

    vi.advanceTimersByTime(TICK_MS * 3);
    expect(game.state.snake).toEqual(createInitialSnake());
  });

  it("survives a document without a restart button", () => {
    vi.useFakeTimers();
    const game = createGame(
      { getElementById: () => null },
      { random: fakeRandom() },
    );
    expect(() => game.restart()).not.toThrow();
    expect(game.state.running).toBe(true);
    game.stop();
  });
});
