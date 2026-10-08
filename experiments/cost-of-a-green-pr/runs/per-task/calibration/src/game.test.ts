import { describe, it, expect } from "vitest";
// @ts-expect-error - game.js is plain JS without type declarations
import * as gameModule from "./game.js";

interface Segment {
  x: number;
  y: number;
}

/** A direction is a one-cell delta applied to the head each tick. */
type Direction = Segment;

interface GameModule {
  GRID_SIZE: number;
  CELL_SIZE: number;
  TICK_MS: number;
  createInitialSnake(): Segment[];
  moveSnake(snake: Segment[], direction: Direction): Segment[];
  growSnake(snake: Segment[], direction: Direction): Segment[];
  checkWallCollision(head: Segment, gridSize: number): boolean;
  checkSelfCollision(snake: Segment[]): boolean;
  checkFoodCollision(head: Segment, food: Segment | null): boolean;
  isGameOver(snake: Segment[], gridSize: number): boolean;
  nextScore(score: number, ate: boolean): number;
  POINTS_PER_FOOD: number;
  spawnFood(
    gridSize: number,
    snake: Segment[],
    random?: () => number,
  ): Segment | null;
  getNewDirection(current: Direction, input: Direction | null): Direction;
  directionFromKey(key: string): Direction | null;
  createInitialGameState(random?: () => number): GameState;
}

/** The mutable state one run of the game owns; also what a restart resets to. */
interface GameState {
  snake: Segment[];
  direction: Direction;
  queuedTurns: Direction[];
  food: Segment | null;
  score: number;
  gameOver: boolean;
  running: boolean;
  timer: unknown;
}

const game = gameModule as unknown as GameModule;

const RIGHT: Direction = { x: 1, y: 0 };
const LEFT: Direction = { x: -1, y: 0 };
const UP: Direction = { x: 0, y: -1 };
const DOWN: Direction = { x: 0, y: 1 };

/** Build a snake from [x, y] pairs, head first. */
function snakeOf(...cells: [number, number][]): Segment[] {
  return cells.map(([x, y]) => ({ x, y }));
}

describe("createInitialSnake", () => {
  it("returns a three-segment snake", () => {
    expect(game.createInitialSnake()).toHaveLength(3);
  });

  it("places every segment on the grid with integer coordinates", () => {
    for (const segment of game.createInitialSnake()) {
      expect(Number.isInteger(segment.x)).toBe(true);
      expect(Number.isInteger(segment.y)).toBe(true);
      expect(segment.x).toBeGreaterThanOrEqual(0);
      expect(segment.x).toBeLessThan(game.GRID_SIZE);
      expect(segment.y).toBeGreaterThanOrEqual(0);
      expect(segment.y).toBeLessThan(game.GRID_SIZE);
    }
  });

  it("centres the head on the board", () => {
    const centre = Math.floor(game.GRID_SIZE / 2);
    expect(game.createInitialSnake()[0]).toEqual({ x: centre, y: centre });
  });

  it("trails the body horizontally to the left of the head", () => {
    const snake = game.createInitialSnake();
    const headY = snake[0].y;
    snake.forEach((segment, index) => {
      expect(segment.y).toBe(headY);
      expect(segment.x).toBe(snake[0].x - index);
    });
  });

  it("does not overlap itself", () => {
    const snake = game.createInitialSnake();
    const cells = new Set(snake.map((segment) => `${segment.x},${segment.y}`));
    expect(cells.size).toBe(snake.length);
  });

  it("returns fresh objects on each call so restarts share no state", () => {
    const first = game.createInitialSnake();
    const second = game.createInitialSnake();
    expect(second).toEqual(first);
    expect(second).not.toBe(first);
    first[0].x = -99;
    expect(second[0].x).not.toBe(-99);
  });
});

describe("moveSnake", () => {
  it.each([
    ["right", RIGHT, { x: 6, y: 5 }],
    ["left", LEFT, { x: 4, y: 5 }],
    ["up", UP, { x: 5, y: 4 }],
    ["down", DOWN, { x: 5, y: 6 }],
  ])("moves the head one cell %s", (_label, direction, expectedHead) => {
    const snake = snakeOf([5, 5], [4, 5], [3, 5]);
    expect(game.moveSnake(snake, direction)[0]).toEqual(expectedHead);
  });

  it("keeps the snake the same length when it moves", () => {
    const snake = snakeOf([5, 5], [4, 5], [3, 5]);
    expect(game.moveSnake(snake, RIGHT)).toHaveLength(snake.length);
  });

  it("shifts each body segment onto the cell ahead of it", () => {
    const snake = snakeOf([5, 5], [4, 5], [3, 5]);
    expect(game.moveSnake(snake, RIGHT)).toEqual(
      snakeOf([6, 5], [5, 5], [4, 5]),
    );
  });

  it("follows a turn without dragging the body diagonally", () => {
    const snake = snakeOf([5, 5], [4, 5], [3, 5]);
    expect(game.moveSnake(snake, UP)).toEqual(snakeOf([5, 4], [5, 5], [4, 5]));
  });

  it("drops the tail cell so the snake does not grow", () => {
    const snake = snakeOf([5, 5], [4, 5], [3, 5]);
    const moved = game.moveSnake(snake, RIGHT);
    const cells = moved.map((segment) => `${segment.x},${segment.y}`);
    expect(cells).not.toContain("3,5");
  });

  it("moves a single-segment snake", () => {
    expect(game.moveSnake(snakeOf([0, 0]), DOWN)).toEqual(snakeOf([0, 1]));
  });

  it("returns a new array and leaves the input snake untouched", () => {
    const snake = snakeOf([5, 5], [4, 5], [3, 5]);
    const moved = game.moveSnake(snake, RIGHT);
    expect(moved).not.toBe(snake);
    expect(snake).toEqual(snakeOf([5, 5], [4, 5], [3, 5]));
  });

  it("does not hand back segment objects that alias the input", () => {
    const snake = snakeOf([5, 5], [4, 5], [3, 5]);
    const moved = game.moveSnake(snake, RIGHT);
    moved.forEach((segment) => {
      expect(snake).not.toContain(segment);
    });
  });

  it("can walk the head off the grid so collision checks can catch it", () => {
    expect(game.moveSnake(snakeOf([0, 3]), LEFT)[0]).toEqual({ x: -1, y: 3 });
  });
});

describe("getNewDirection", () => {
  it.each([
    ["right", RIGHT, UP],
    ["right", RIGHT, DOWN],
    ["left", LEFT, UP],
    ["left", LEFT, DOWN],
    ["up", UP, LEFT],
    ["up", UP, RIGHT],
    ["down", DOWN, LEFT],
    ["down", DOWN, RIGHT],
  ])("accepts a quarter turn while heading %s", (_label, current, input) => {
    expect(game.getNewDirection(current, input)).toEqual(input);
  });

  it.each([
    ["right", RIGHT, LEFT],
    ["left", LEFT, RIGHT],
    ["up", UP, DOWN],
    ["down", DOWN, UP],
  ])("refuses to reverse while heading %s", (_label, current, input) => {
    expect(game.getNewDirection(current, input)).toEqual(current);
  });

  it.each([
    ["right", RIGHT],
    ["left", LEFT],
    ["up", UP],
    ["down", DOWN],
  ])("keeps heading %s when given the same direction", (_label, current) => {
    expect(game.getNewDirection(current, current)).toEqual(current);
  });

  it.each([
    ["null", null],
    ["undefined", undefined],
    ["a partial delta", { x: 1 }],
  ])("keeps the current direction for %s input", (_label, input) => {
    expect(game.getNewDirection(RIGHT, input as Direction)).toEqual(RIGHT);
  });

  it("returns a fresh object rather than either argument", () => {
    const result = game.getNewDirection(RIGHT, UP);
    expect(result).not.toBe(RIGHT);
    expect(result).not.toBe(UP);
  });

  it("does not mutate the directions it is given", () => {
    game.getNewDirection(RIGHT, LEFT);
    expect(RIGHT).toEqual({ x: 1, y: 0 });
    expect(LEFT).toEqual({ x: -1, y: 0 });
  });

  it("keeps a rejected reversal from walking the snake onto its own neck", () => {
    const snake = snakeOf([5, 5], [4, 5], [3, 5]);
    const direction = game.getNewDirection(RIGHT, LEFT);
    expect(game.moveSnake(snake, direction)[0]).toEqual({ x: 6, y: 5 });
  });
});

describe("directionFromKey", () => {
  it.each([
    ["ArrowUp", UP],
    ["ArrowDown", DOWN],
    ["ArrowLeft", LEFT],
    ["ArrowRight", RIGHT],
  ])("maps %s to its delta", (key, expected) => {
    expect(game.directionFromKey(key)).toEqual(expected);
  });

  it.each([[" "], ["Enter"], ["w"], ["Escape"]])(
    "ignores the %s key",
    (key) => {
      expect(game.directionFromKey(key)).toBeNull();
    },
  );

  it("returns a fresh delta each call so callers cannot share state", () => {
    const first = game.directionFromKey("ArrowUp") as Direction;
    const second = game.directionFromKey("ArrowUp") as Direction;
    expect(first).toEqual(second);
    expect(first).not.toBe(second);
  });
});

describe("checkWallCollision", () => {
  it.each([
    ["left", { x: -1, y: 5 }],
    ["right", { x: 20, y: 5 }],
    ["top", { x: 5, y: -1 }],
    ["bottom", { x: 5, y: 20 }],
  ])("reports a collision past the %s wall", (_label, head) => {
    expect(game.checkWallCollision(head, 20)).toBe(true);
  });

  it.each([
    ["centre", { x: 10, y: 10 }],
    ["top-left corner", { x: 0, y: 0 }],
    ["bottom-right corner", { x: 19, y: 19 }],
    ["left edge", { x: 0, y: 12 }],
    ["bottom edge", { x: 12, y: 19 }],
  ])("reports no collision at the %s", (_label, head) => {
    expect(game.checkWallCollision(head, 20)).toBe(false);
  });

  it("treats the grid size as exclusive on both axes", () => {
    expect(game.checkWallCollision({ x: 9, y: 9 }, 10)).toBe(false);
    expect(game.checkWallCollision({ x: 10, y: 9 }, 10)).toBe(true);
    expect(game.checkWallCollision({ x: 9, y: 10 }, 10)).toBe(true);
  });

  it("clears the head of a freshly created snake", () => {
    const head = game.createInitialSnake()[0];
    expect(game.checkWallCollision(head, game.GRID_SIZE)).toBe(false);
  });
});

describe("checkSelfCollision", () => {
  it("reports a collision when the head sits on a body segment", () => {
    expect(
      game.checkSelfCollision(snakeOf([5, 5], [5, 6], [4, 6], [4, 5], [5, 5])),
    ).toBe(true);
  });

  it("reports a collision when the head doubles back onto its neck", () => {
    expect(game.checkSelfCollision(snakeOf([4, 5], [4, 5], [3, 5]))).toBe(true);
  });

  it("reports no collision for a snake laid out in a line", () => {
    expect(game.checkSelfCollision(snakeOf([5, 5], [4, 5], [3, 5]))).toBe(
      false,
    );
  });

  it("reports no collision for a coiled snake whose head is clear", () => {
    expect(
      game.checkSelfCollision(snakeOf([5, 5], [5, 6], [4, 6], [4, 5], [4, 4])),
    ).toBe(false);
  });

  it("ignores a duplicated body cell that the head is not on", () => {
    expect(
      game.checkSelfCollision(snakeOf([9, 9], [4, 5], [3, 5], [4, 5])),
    ).toBe(false);
  });

  it("reports no collision for a single-segment snake", () => {
    expect(game.checkSelfCollision(snakeOf([5, 5]))).toBe(false);
  });

  it("clears a freshly created snake", () => {
    expect(game.checkSelfCollision(game.createInitialSnake())).toBe(false);
  });

  it("does not mutate the snake it inspects", () => {
    const snake = snakeOf([5, 5], [4, 5], [3, 5]);
    game.checkSelfCollision(snake);
    expect(snake).toEqual(snakeOf([5, 5], [4, 5], [3, 5]));
  });
});

describe("isGameOver", () => {
  it.each([
    ["left", { x: -1, y: 5 }],
    ["right", { x: 20, y: 5 }],
    ["top", { x: 5, y: -1 }],
    ["bottom", { x: 5, y: 20 }],
  ])("ends the game when the head is past the %s wall", (_label, head) => {
    expect(game.isGameOver([head, { x: 5, y: 5 }], 20)).toBe(true);
  });

  it("ends the game when the head is on a body segment", () => {
    expect(
      game.isGameOver(snakeOf([5, 5], [5, 6], [4, 6], [4, 5], [5, 5]), 20),
    ).toBe(true);
  });

  it("keeps the game running for a snake in open board", () => {
    expect(game.isGameOver(snakeOf([5, 5], [4, 5], [3, 5]), 20)).toBe(false);
  });

  it("keeps the game running for a freshly created snake", () => {
    expect(game.isGameOver(game.createInitialSnake(), game.GRID_SIZE)).toBe(
      false,
    );
  });

  it.each([
    ["top-left", [0, 0] as [number, number]],
    ["bottom-right", [19, 19] as [number, number]],
  ])("keeps the game running in the %s corner", (_label, cell) => {
    expect(game.isGameOver(snakeOf(cell), 20)).toBe(false);
  });

  it("ends the game one step after the head leaves a corner", () => {
    const snake = snakeOf([19, 19], [18, 19], [17, 19]);
    expect(game.isGameOver(snake, 20)).toBe(false);
    expect(game.isGameOver(game.moveSnake(snake, RIGHT), 20)).toBe(true);
  });

  it("lets the head follow its own tail into the cell the tail just left", () => {
    // Head (1,1) turning right onto (2,1), which the tail occupies right now.
    // moveSnake drops that tail in the same tick, so the cell is free.
    const snake = snakeOf([1, 1], [1, 2], [2, 2], [2, 1]);
    const moved = game.moveSnake(snake, RIGHT);
    expect(moved[0]).toEqual({ x: 2, y: 1 });
    expect(game.isGameOver(moved, 20)).toBe(false);
  });

  it("ends the game when a moving snake runs into its own body", () => {
    // Head (2,1) heading down into (2,2), a segment that is not the tail.
    const snake = snakeOf([2, 1], [1, 1], [1, 2], [2, 2], [3, 2]);
    expect(game.isGameOver(snake, 20)).toBe(false);
    expect(game.isGameOver(game.moveSnake(snake, DOWN), 20)).toBe(true);
  });

  it("walks a snake into the wall over successive moves", () => {
    let snake = snakeOf([17, 5], [16, 5], [15, 5]);
    const alive: boolean[] = [];
    for (let step = 0; step < 4; step += 1) {
      snake = game.moveSnake(snake, RIGHT);
      alive.push(game.isGameOver(snake, 20));
    }
    // Heads land on 18, 19, 20, 21 - the board ends after 19.
    expect(alive).toEqual([false, false, true, true]);
  });

  it("does not mutate the snake it inspects", () => {
    const snake = snakeOf([5, 5], [4, 5], [3, 5]);
    game.isGameOver(snake, 20);
    expect(snake).toEqual(snakeOf([5, 5], [4, 5], [3, 5]));
  });
});

describe("growSnake", () => {
  it("comes back one segment longer than it went in", () => {
    const snake = snakeOf([5, 5], [4, 5], [3, 5]);
    expect(game.growSnake(snake, RIGHT)).toHaveLength(snake.length + 1);
  });

  it("keeps the tail where it was and adds the new head", () => {
    expect(game.growSnake(snakeOf([5, 5], [4, 5], [3, 5]), RIGHT)).toEqual(
      snakeOf([6, 5], [5, 5], [4, 5], [3, 5]),
    );
  });

  it("puts the head in the same cell moveSnake would have", () => {
    const snake = snakeOf([5, 5], [4, 5], [3, 5]);
    expect(game.growSnake(snake, UP)[0]).toEqual(game.moveSnake(snake, UP)[0]);
  });

  it("grows a single-segment snake into two", () => {
    expect(game.growSnake(snakeOf([2, 2]), DOWN)).toEqual(
      snakeOf([2, 3], [2, 2]),
    );
  });

  it("returns a new array and leaves the input snake untouched", () => {
    const snake = snakeOf([5, 5], [4, 5], [3, 5]);
    const grown = game.growSnake(snake, RIGHT);
    expect(grown).not.toBe(snake);
    expect(snake).toEqual(snakeOf([5, 5], [4, 5], [3, 5]));
  });

  it("does not hand back segment objects that alias the input", () => {
    const snake = snakeOf([5, 5], [4, 5], [3, 5]);
    game.growSnake(snake, RIGHT).forEach((segment) => {
      expect(snake).not.toContain(segment);
    });
  });

  it("leaves a snake that grew every tick free of self-collisions", () => {
    // Eating on three consecutive ticks is the worst case for the tail: it
    // never moves, so a growing snake must not run over its own back.
    let snake = snakeOf([5, 5], [4, 5], [3, 5]);
    for (let i = 0; i < 3; i += 1) {
      snake = game.growSnake(snake, RIGHT);
      expect(game.checkSelfCollision(snake)).toBe(false);
    }
    expect(snake).toEqual(
      snakeOf([8, 5], [7, 5], [6, 5], [5, 5], [4, 5], [3, 5]),
    );
  });
});

describe("checkFoodCollision", () => {
  it("reports a collision when the head is on the food", () => {
    expect(game.checkFoodCollision({ x: 7, y: 3 }, { x: 7, y: 3 })).toBe(true);
  });

  it.each([
    ["one cell to the right", { x: 8, y: 3 }],
    ["one cell to the left", { x: 6, y: 3 }],
    ["one cell above", { x: 7, y: 2 }],
    ["one cell below", { x: 7, y: 4 }],
    ["with the axes swapped", { x: 3, y: 7 }],
  ])("reports no collision when the head is %s", (_label, head) => {
    expect(game.checkFoodCollision(head, { x: 7, y: 3 })).toBe(false);
  });

  it.each([
    ["null", null],
    ["undefined", undefined],
  ])("reports no collision when the food is %s", (_label, food) => {
    expect(game.checkFoodCollision({ x: 7, y: 3 }, food as null)).toBe(false);
  });

  it("does not mutate the cells it compares", () => {
    const head = { x: 7, y: 3 };
    const food = { x: 7, y: 3 };
    game.checkFoodCollision(head, food);
    expect(head).toEqual({ x: 7, y: 3 });
    expect(food).toEqual({ x: 7, y: 3 });
  });
});

describe("spawnFood", () => {
  /** A random() that walks a fixed list, so placement is deterministic. */
  function randomFrom(...values: number[]): () => number {
    let index = 0;
    return () => values[Math.min(index++, values.length - 1)];
  }

  /** Every cell of a gridSize board, so the snake can be made to fill it. */
  function everyCell(gridSize: number): Segment[] {
    const cells: Segment[] = [];
    for (let y = 0; y < gridSize; y += 1) {
      for (let x = 0; x < gridSize; x += 1) cells.push({ x, y });
    }
    return cells;
  }

  it("places food inside the grid with integer coordinates", () => {
    const food = game.spawnFood(
      20,
      snakeOf([5, 5]),
      randomFrom(0.5),
    ) as Segment;
    expect(Number.isInteger(food.x)).toBe(true);
    expect(Number.isInteger(food.y)).toBe(true);
    expect(food.x).toBeGreaterThanOrEqual(0);
    expect(food.x).toBeLessThan(20);
    expect(food.y).toBeGreaterThanOrEqual(0);
    expect(food.y).toBeLessThan(20);
  });

  it("skips the cell the snake occupies rather than retrying forever", () => {
    // A constant 0 always asks for the first cell. The snake sits on (0,0), so
    // the answer must be the next free cell, with no retry loop involved.
    const food = game.spawnFood(3, snakeOf([0, 0]), () => 0);
    expect(food).toEqual({ x: 1, y: 0 });
  });

  it("never lands on the snake for any random value", () => {
    const snake = snakeOf([1, 1], [1, 2], [2, 2], [2, 1]);
    const occupied = new Set(snake.map((cell) => `${cell.x},${cell.y}`));

    // Every index of the free list, plus the out-of-range ends.
    for (let step = -1; step <= 21; step += 1) {
      const food = game.spawnFood(4, snake, () => step / 20) as Segment;
      expect(occupied.has(`${food.x},${food.y}`)).toBe(false);
    }
  });

  it("walks the free cells in row-major order as random rises", () => {
    const snake = snakeOf([9, 9]);
    expect(game.spawnFood(3, snake, randomFrom(0))).toEqual({ x: 0, y: 0 });
    expect(game.spawnFood(3, snake, randomFrom(4 / 9))).toEqual({ x: 1, y: 1 });
    expect(game.spawnFood(3, snake, randomFrom(8 / 9))).toEqual({ x: 2, y: 2 });
  });

  it("clamps a random value of 1 onto the last free cell", () => {
    expect(game.spawnFood(3, snakeOf([9, 9]), () => 1)).toEqual({ x: 2, y: 2 });
  });

  it("can reach every free cell on the board", () => {
    const snake = snakeOf([0, 0]);
    const free = 3 * 3 - 1;
    const reached = new Set<string>();

    for (let index = 0; index < free; index += 1) {
      const food = game.spawnFood(3, snake, () => index / free) as Segment;
      reached.add(`${food.x},${food.y}`);
    }

    expect(reached.size).toBe(free);
  });

  it("returns null when the snake fills the grid", () => {
    expect(game.spawnFood(3, everyCell(3), () => 0)).toBeNull();
  });

  it("defaults to Math.random when no generator is injected", () => {
    const food = game.spawnFood(20, game.createInitialSnake()) as Segment;
    expect(food.x).toBeGreaterThanOrEqual(0);
    expect(food.x).toBeLessThan(20);
    expect(food.y).toBeGreaterThanOrEqual(0);
    expect(food.y).toBeLessThan(20);
  });

  it("returns a fresh cell that does not alias the snake it was given", () => {
    const snake = snakeOf([5, 5], [4, 5]);
    const first = game.spawnFood(20, snake, () => 0);
    const second = game.spawnFood(20, snake, () => 0);
    expect(second).toEqual(first);
    expect(second).not.toBe(first);
    expect(snake).not.toContain(first);
  });

  it("does not mutate the snake it inspects", () => {
    const snake = snakeOf([5, 5], [4, 5], [3, 5]);
    game.spawnFood(20, snake, () => 0.5);
    expect(snake).toEqual(snakeOf([5, 5], [4, 5], [3, 5]));
  });
});

describe("eating a piece of food", () => {
  it("grows the snake and frees the cell for the next spawn", () => {
    const snake = snakeOf([5, 5], [4, 5], [3, 5]);
    const food = { x: 6, y: 5 };

    // The head is one cell short of the food, so this tick does not eat.
    expect(game.checkFoodCollision(snake[0], food)).toBe(false);

    // Stepping right lands on it: the snake grows and keeps its tail.
    const head = game.moveSnake(snake, RIGHT)[0];
    expect(game.checkFoodCollision(head, food)).toBe(true);

    const grown = game.growSnake(snake, RIGHT);
    expect(grown).toHaveLength(snake.length + 1);
    expect(grown[0]).toEqual(food);

    // The replacement food is placed against the grown snake, so it cannot
    // appear underneath any segment - including the one just eaten.
    const next = game.spawnFood(20, grown, () => 0) as Segment;
    expect(game.checkFoodCollision(grown[0], next)).toBe(false);
    grown.forEach((segment) => {
      expect(game.checkFoodCollision(segment, next)).toBe(false);
    });
  });
});

describe("nextScore", () => {
  it("awards POINTS_PER_FOOD for a tick that ate", () => {
    expect(game.nextScore(0, true)).toBe(game.POINTS_PER_FOOD);
  });

  it("leaves the score alone for a tick that did not eat", () => {
    expect(game.nextScore(70, false)).toBe(70);
  });

  it("adds to a score that is already running", () => {
    expect(game.nextScore(30, true)).toBe(30 + game.POINTS_PER_FOOD);
  });

  it("accumulates one award per meal", () => {
    let score = 0;
    for (let meal = 0; meal < 5; meal += 1) score = game.nextScore(score, true);
    expect(score).toBe(5 * game.POINTS_PER_FOOD);
  });

  it("ignores the ticks between meals when accumulating", () => {
    let score = 0;
    // eat, coast, coast, eat, coast - two meals in five ticks.
    for (const ate of [true, false, false, true, false]) {
      score = game.nextScore(score, ate);
    }
    expect(score).toBe(2 * game.POINTS_PER_FOOD);
  });

  it("awards a positive whole number of points per meal", () => {
    expect(Number.isInteger(game.POINTS_PER_FOOD)).toBe(true);
    expect(game.POINTS_PER_FOOD).toBeGreaterThan(0);
  });
});

describe("playing until the game ends", () => {
  it("scores each meal and stops the run on the wall", () => {
    // Food sits two cells ahead; the snake eats it, then keeps going right
    // until it leaves the board.
    let snake = snakeOf([17, 5], [16, 5], [15, 5]);
    let food: Segment | null = { x: 18, y: 5 };
    let score = 0;
    let ticks = 0;

    while (!game.isGameOver(snake, 20) && ticks < 10) {
      ticks += 1;
      const ate = game.checkFoodCollision(
        game.moveSnake(snake, RIGHT)[0],
        food,
      );
      snake = ate ? game.growSnake(snake, RIGHT) : game.moveSnake(snake, RIGHT);
      if (ate) {
        score = game.nextScore(score, true);
        food = null;
      }
    }

    // Tick 1 eats at (18,5) and grows to four; tick 2 moves to (19,5), still
    // on the board; tick 3 steps to (20,5) and ends the game.
    expect(ticks).toBe(3);
    expect(score).toBe(game.POINTS_PER_FOOD);
    expect(snake).toHaveLength(4);
    expect(snake[0]).toEqual({ x: 20, y: 5 });
    expect(game.checkWallCollision(snake[0], 20)).toBe(true);
  });
});

describe("createInitialGameState", () => {
  // A fixed fake: the first free cell in the scan order, which is (0,0) and so
  // is never under the opening snake in the middle of the board.
  const firstFreeCell = () => 0;

  it("opens with the initial snake", () => {
    const state = game.createInitialGameState(firstFreeCell);
    expect(state.snake).toEqual(game.createInitialSnake());
  });

  it("heads right, away from its own body", () => {
    expect(game.createInitialGameState(firstFreeCell).direction).toEqual(RIGHT);
  });

  it("starts with an empty turn queue", () => {
    expect(game.createInitialGameState(firstFreeCell).queuedTurns).toEqual([]);
  });

  it("starts with a zeroed score", () => {
    expect(game.createInitialGameState(firstFreeCell).score).toBe(0);
  });

  it("starts alive, stopped and without a timer", () => {
    const state = game.createInitialGameState(firstFreeCell);
    expect(state.gameOver).toBe(false);
    expect(state.running).toBe(false);
    expect(state.timer).toBeNull();
  });

  it("places food on the board but never under the snake", () => {
    const state = game.createInitialGameState(firstFreeCell);
    const food = state.food as Segment;

    expect(game.checkWallCollision(food, game.GRID_SIZE)).toBe(false);
    state.snake.forEach((segment) => {
      expect(game.checkFoodCollision(segment, food)).toBe(false);
    });
  });

  it("places the food with the random it is given", () => {
    // Same fake, same cell - so a restart is reproducible under test rather
    // than reaching for Math.random.
    expect(game.createInitialGameState(firstFreeCell).food).toEqual({
      x: 0,
      y: 0,
    });
    expect(game.createInitialGameState(() => 0.999_999).food).not.toEqual({
      x: 0,
      y: 0,
    });
  });

  it("hands out independent state each call", () => {
    const first = game.createInitialGameState(firstFreeCell);
    first.snake[0].x = 99;
    first.queuedTurns.push(UP);
    first.score = 250;

    const second = game.createInitialGameState(firstFreeCell);
    expect(second.snake).toEqual(game.createInitialSnake());
    expect(second.queuedTurns).toEqual([]);
    expect(second.score).toBe(0);
  });

  it("restores a played-out game when assigned over it", () => {
    // What restart() does: a dead, long, high-scoring snake takes on a fresh
    // state, so position, length, score and the game over latch all reset.
    const played: GameState = {
      snake: snakeOf([20, 5], [19, 5], [18, 5], [17, 5], [16, 5]),
      direction: DOWN,
      queuedTurns: [LEFT],
      food: { x: 3, y: 3 },
      score: 40,
      gameOver: true,
      running: false,
      timer: 7,
    };

    Object.assign(played, game.createInitialGameState(firstFreeCell));

    expect(played.snake).toEqual(game.createInitialSnake());
    expect(played.snake).toHaveLength(3);
    expect(played.direction).toEqual(RIGHT);
    expect(played.queuedTurns).toEqual([]);
    expect(played.score).toBe(0);
    expect(played.gameOver).toBe(false);
    expect(played.running).toBe(false);
    expect(played.timer).toBeNull();
    expect(game.isGameOver(played.snake, game.GRID_SIZE)).toBe(false);
  });
});

describe("board constants", () => {
  it("describes a 20x20 grid that fills the 400x400 canvas", () => {
    expect(game.GRID_SIZE).toBe(20);
    expect(game.GRID_SIZE * game.CELL_SIZE).toBe(400);
  });

  it("uses a positive tick interval", () => {
    expect(game.TICK_MS).toBeGreaterThan(0);
  });
});
