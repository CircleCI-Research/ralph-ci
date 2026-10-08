import { describe, it, expect } from "vitest";
// @ts-expect-error - game.js is plain JS without type declarations
import * as gameModule from "./game.js";

interface Segment {
  x: number;
  y: number;
}

/** Unit vector of travel; also the shape stored for the current direction. */
type Direction = Segment;

const RIGHT: Direction = { x: 1, y: 0 };
const LEFT: Direction = { x: -1, y: 0 };
const UP: Direction = { x: 0, y: -1 };
const DOWN: Direction = { x: 0, y: 1 };

/**
 * The contract game.js is being written against. Every export listed here is
 * implemented, so no spec is marked `it.fails` any more.
 */
const game = gameModule as {
  GRID_SIZE: number;
  CELL_SIZE: number;
  TICK_MS: number;
  POINTS_PER_FOOD: number;
  createInitialSnake: () => Segment[];
  moveSnake: (snake: Segment[], direction: Direction) => Segment[];
  getNewDirection: (
    current: Direction,
    input: Direction | null | undefined,
  ) => Direction;
  checkWallCollision: (head: Segment, gridSize: number) => boolean;
  checkSelfCollision: (snake: Segment[]) => boolean;
  checkFoodCollision: (
    head: Segment,
    food: Segment | null | undefined,
  ) => boolean;
  getNextScore: (score: number, ateFood: boolean) => number;
  spawnFood: (
    gridSize: number,
    snake: Segment[],
    random?: () => number,
  ) => Segment | null;
  createInitialState: (random?: () => number) => {
    snake: Segment[];
    direction: Direction;
    queuedDirection: Direction;
    food: Segment | null;
    score: number;
    isGameOver: boolean;
  };
};

/**
 * Deterministic stand-in for `Math.random`: hands back `values` in order, then
 * repeats the last one forever. `spawnFood` draws twice per attempt (x then y),
 * so a value of `v` on a grid of `n` picks the coordinate `Math.floor(v * n)`.
 */
function fakeRandom(...values: number[]): () => number {
  let index = 0;

  return () => {
    const value = values[Math.min(index, values.length - 1)] ?? 0;
    index += 1;
    return value;
  };
}

describe("board constants", () => {
  it("describes a 20x20 grid of 20px cells", () => {
    expect(game.GRID_SIZE).toBe(20);
    expect(game.CELL_SIZE).toBe(20);
    expect(game.GRID_SIZE * game.CELL_SIZE).toBe(400);
  });

  it("ticks on a fixed interval and scores food at a fixed rate", () => {
    expect(game.TICK_MS).toBeGreaterThan(0);
    expect(game.POINTS_PER_FOOD).toBeGreaterThan(0);
  });
});

describe("createInitialSnake", () => {
  it("returns a three segment snake", () => {
    expect(game.createInitialSnake()).toHaveLength(3);
  });

  it("places the head near the middle of the grid", () => {
    const centre = Math.floor(game.GRID_SIZE / 2);
    const [head] = game.createInitialSnake();

    expect(head).toEqual({ x: centre, y: centre });
  });

  it("lays the body out horizontally behind the head", () => {
    const centre = Math.floor(game.GRID_SIZE / 2);

    expect(game.createInitialSnake()).toEqual([
      { x: centre, y: centre },
      { x: centre - 1, y: centre },
      { x: centre - 2, y: centre },
    ]);
  });

  it("keeps every segment inside the grid", () => {
    for (const segment of game.createInitialSnake()) {
      expect(segment.x).toBeGreaterThanOrEqual(0);
      expect(segment.x).toBeLessThan(game.GRID_SIZE);
      expect(segment.y).toBeGreaterThanOrEqual(0);
      expect(segment.y).toBeLessThan(game.GRID_SIZE);
    }
  });

  it("returns a fresh array each call so callers cannot share state", () => {
    const first = game.createInitialSnake();
    const second = game.createInitialSnake();

    expect(first).not.toBe(second);
    expect(first[0]).not.toBe(second[0]);

    first[0].x = 0;
    expect(second[0].x).toBe(Math.floor(game.GRID_SIZE / 2));
  });
});

describe("moveSnake", () => {
  const snake: Segment[] = [
    { x: 5, y: 5 },
    { x: 4, y: 5 },
    { x: 3, y: 5 },
  ];

  it("puts a new head one cell along the direction of travel", () => {
    expect(game.moveSnake(snake, RIGHT)[0]).toEqual({ x: 6, y: 5 });
    expect(game.moveSnake(snake, UP)[0]).toEqual({ x: 5, y: 4 });
    expect(game.moveSnake(snake, DOWN)[0]).toEqual({ x: 5, y: 6 });
    expect(game.moveSnake(snake, LEFT)[0]).toEqual({ x: 4, y: 5 });
  });

  it("drops the tail so the snake keeps its length", () => {
    expect(game.moveSnake(snake, RIGHT)).toEqual([
      { x: 6, y: 5 },
      { x: 5, y: 5 },
      { x: 4, y: 5 },
    ]);
  });

  it("leaves the snake it was given untouched", () => {
    const before = JSON.stringify(snake);
    const moved = game.moveSnake(snake, RIGHT);

    expect(moved).not.toBe(snake);
    expect(JSON.stringify(snake)).toBe(before);
  });
});

describe("getNewDirection", () => {
  it("accepts a quarter turn away from the current heading", () => {
    expect(game.getNewDirection(RIGHT, UP)).toEqual(UP);
    expect(game.getNewDirection(RIGHT, DOWN)).toEqual(DOWN);
    expect(game.getNewDirection(UP, LEFT)).toEqual(LEFT);
    expect(game.getNewDirection(UP, RIGHT)).toEqual(RIGHT);
  });

  it("refuses a 180 degree turn and keeps the current heading", () => {
    expect(game.getNewDirection(RIGHT, LEFT)).toEqual(RIGHT);
    expect(game.getNewDirection(LEFT, RIGHT)).toEqual(LEFT);
    expect(game.getNewDirection(UP, DOWN)).toEqual(UP);
    expect(game.getNewDirection(DOWN, UP)).toEqual(DOWN);
  });

  it("keeps going when the input repeats the current heading", () => {
    expect(game.getNewDirection(DOWN, DOWN)).toEqual(DOWN);
  });

  it("falls back to the current heading when there is no input", () => {
    expect(game.getNewDirection(LEFT, null)).toEqual(LEFT);
    expect(game.getNewDirection(LEFT, undefined)).toEqual(LEFT);
  });
});

describe("checkWallCollision", () => {
  it("is false while the head is inside the grid", () => {
    expect(game.checkWallCollision({ x: 0, y: 0 }, game.GRID_SIZE)).toBe(false);
    expect(game.checkWallCollision({ x: 10, y: 10 }, game.GRID_SIZE)).toBe(
      false,
    );
    expect(
      game.checkWallCollision(
        { x: game.GRID_SIZE - 1, y: game.GRID_SIZE - 1 },
        game.GRID_SIZE,
      ),
    ).toBe(false);
  });

  it("is true once the head steps past any edge", () => {
    expect(game.checkWallCollision({ x: -1, y: 5 }, game.GRID_SIZE)).toBe(true);
    expect(game.checkWallCollision({ x: 5, y: -1 }, game.GRID_SIZE)).toBe(true);
    expect(
      game.checkWallCollision({ x: game.GRID_SIZE, y: 5 }, game.GRID_SIZE),
    ).toBe(true);
    expect(
      game.checkWallCollision({ x: 5, y: game.GRID_SIZE }, game.GRID_SIZE),
    ).toBe(true);
  });

  it("measures against the grid size it is handed", () => {
    expect(game.checkWallCollision({ x: 7, y: 7 }, 5)).toBe(true);
    expect(game.checkWallCollision({ x: 4, y: 4 }, 5)).toBe(false);
  });
});

describe("checkSelfCollision", () => {
  it("is false for the starting snake", () => {
    expect(game.checkSelfCollision(game.createInitialSnake())).toBe(false);
  });

  it("is true when the head sits on a body segment", () => {
    expect(
      game.checkSelfCollision([
        { x: 2, y: 2 },
        { x: 2, y: 3 },
        { x: 3, y: 3 },
        { x: 3, y: 2 },
        { x: 2, y: 2 },
      ]),
    ).toBe(true);
  });

  it("does not count the head colliding with itself", () => {
    expect(game.checkSelfCollision([{ x: 4, y: 4 }])).toBe(false);
  });
});

describe("checkFoodCollision", () => {
  it("is true when the head lands on the food", () => {
    expect(game.checkFoodCollision({ x: 6, y: 9 }, { x: 6, y: 9 })).toBe(true);
  });

  it("is false when the head is on any other cell", () => {
    expect(game.checkFoodCollision({ x: 6, y: 9 }, { x: 7, y: 9 })).toBe(false);
    expect(game.checkFoodCollision({ x: 6, y: 9 }, { x: 6, y: 8 })).toBe(false);
    expect(game.checkFoodCollision({ x: 0, y: 0 }, { x: 9, y: 9 })).toBe(false);
  });

  it("is false when there is no food on the board", () => {
    expect(game.checkFoodCollision({ x: 6, y: 9 }, null)).toBe(false);
    expect(game.checkFoodCollision({ x: 6, y: 9 }, undefined)).toBe(false);
  });
});

describe("getNextScore", () => {
  it("banks POINTS_PER_FOOD when food was eaten", () => {
    expect(game.getNextScore(0, true)).toBe(game.POINTS_PER_FOOD);
    expect(game.getNextScore(30, true)).toBe(30 + game.POINTS_PER_FOOD);
  });

  it("leaves the score alone on a tick with no food", () => {
    expect(game.getNextScore(0, false)).toBe(0);
    expect(game.getNextScore(70, false)).toBe(70);
  });

  it("adds up over a run of ticks", () => {
    // Three ticks, food on the first and last: two helpings, nothing else.
    const score = [true, false, true].reduce(
      (running, ateFood) => game.getNextScore(running, ateFood),
      0,
    );

    expect(score).toBe(game.POINTS_PER_FOOD * 2);
  });
});

describe("spawnFood", () => {
  it("maps the random draws to a grid cell", () => {
    // 0.5 * 20 -> 10, 0.05 * 20 -> 1: x comes from the first draw, y the second.
    expect(game.spawnFood(20, [], fakeRandom(0.5, 0.05))).toEqual({
      x: 10,
      y: 1,
    });
  });

  it("keeps every coordinate inside the grid", () => {
    // 0.999 is the worst case: it must not round up to gridSize.
    expect(game.spawnFood(20, [], fakeRandom(0.999))).toEqual({
      x: 19,
      y: 19,
    });
    expect(game.spawnFood(20, [], fakeRandom(0))).toEqual({ x: 0, y: 0 });
  });

  it("redraws when the first cell is under the snake", () => {
    const snake: Segment[] = [
      { x: 10, y: 10 },
      { x: 9, y: 10 },
    ];

    // First attempt draws (10, 10) — occupied — so it tries again and takes
    // (0, 0), which is free.
    expect(game.spawnFood(20, snake, fakeRandom(0.5, 0.5, 0, 0))).toEqual({
      x: 0,
      y: 0,
    });
  });

  it("still finds the last free cell when the draws never land on it", () => {
    // 2x2 board, three cells taken, and a random source stuck on the occupied
    // (0, 0). The capped retry loop must give up and scan, not spin forever.
    const snake: Segment[] = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
    ];

    expect(game.spawnFood(2, snake, fakeRandom(0))).toEqual({ x: 1, y: 1 });
  });

  it("returns null when the snake covers the whole board", () => {
    const snake: Segment[] = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
    ];

    expect(game.spawnFood(2, snake, fakeRandom(0))).toBeNull();
  });

  it("leaves the snake it was given untouched", () => {
    const snake: Segment[] = [
      { x: 3, y: 3 },
      { x: 2, y: 3 },
    ];
    const before = JSON.stringify(snake);

    game.spawnFood(20, snake, fakeRandom(0.5, 0.5));

    expect(JSON.stringify(snake)).toBe(before);
  });
});

describe("createInitialState", () => {
  // (0, 0) is free on the starting board — the snake sits in the middle — so
  // spawnFood takes the very first draw and the state is fully deterministic.
  const freeCorner = () => fakeRandom(0);

  it("opens with the starting snake", () => {
    expect(game.createInitialState(freeCorner()).snake).toEqual(
      game.createInitialSnake(),
    );
  });

  it("heads right, with nothing else queued", () => {
    const state = game.createInitialState(freeCorner());

    expect(state.direction).toEqual(RIGHT);
    expect(state.queuedDirection).toEqual(RIGHT);
  });

  it("opens on a zero score with the game live", () => {
    const state = game.createInitialState(freeCorner());

    expect(state.score).toBe(0);
    expect(state.isGameOver).toBe(false);
  });

  it("places food on the board and off the snake", () => {
    const state = game.createInitialState(freeCorner());
    const food = state.food as Segment;

    expect(food).not.toBeNull();
    expect(food.x).toBeGreaterThanOrEqual(0);
    expect(food.x).toBeLessThan(game.GRID_SIZE);
    expect(food.y).toBeGreaterThanOrEqual(0);
    expect(food.y).toBeLessThan(game.GRID_SIZE);
    expect(
      state.snake.some(
        (segment) => segment.x === food.x && segment.y === food.y,
      ),
    ).toBe(false);
  });

  it("spawns food against the rebuilt snake, not the centre of the board", () => {
    // Draws that land on the head cell must be rejected: the restart path would
    // otherwise deal a new snake sitting on top of its own food.
    const centre = Math.floor(game.GRID_SIZE / 2);
    const onTheHeadThenFree = fakeRandom(centre / game.GRID_SIZE, 0.5, 0, 0);

    expect(game.createInitialState(onTheHeadThenFree).food).toEqual({
      x: 0,
      y: 0,
    });
  });

  it("hands back fresh objects so a restart cannot alias the dead run", () => {
    const first = game.createInitialState(freeCorner());
    const second = game.createInitialState(freeCorner());

    expect(first).not.toBe(second);
    expect(first.snake).not.toBe(second.snake);
    expect(first.snake[0]).not.toBe(second.snake[0]);

    // Play the first state forward; the next new game must be untouched by it.
    first.snake[0].x = 0;
    first.score = 40;
    first.isGameOver = true;

    const third = game.createInitialState(freeCorner());

    expect(third.snake).toEqual(game.createInitialSnake());
    expect(third.score).toBe(0);
    expect(third.isGameOver).toBe(false);
  });
});
