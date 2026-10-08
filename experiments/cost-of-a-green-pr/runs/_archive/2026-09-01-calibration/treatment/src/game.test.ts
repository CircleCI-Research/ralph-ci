import { describe, it, expect } from "vitest";
import {
  createInitialSnake,
  moveSnake,
  checkWallCollision,
  checkSelfCollision,
  checkFoodCollision,
  spawnFood,
  isOpposite,
  getNewDirection,
  directionFromKey,
  createGameState,
  applyInput,
  hasCollided,
  tick,
  resetState,
  isStartKey,
  START_KEYS,
  DIRECTIONS,
  KEY_DIRECTIONS,
  GRID_SIZE,
  INITIAL_SNAKE_LENGTH,
  POINTS_PER_FOOD,
  TICK_MS,
  // @ts-expect-error - game.js is plain JS without type declarations
} from "./game.js";

/**
 * Food placement is random, so every state-based test injects a fake instead of
 * leaning on Math.random. Math.floor(0.1 * 20) = 2, putting food at (2,2) —
 * clear of the initial snake at (8,10)/(9,10)/(10,10) and clear of the
 * rightward path the tick tests walk, so it is never eaten by accident.
 */
const FIXED_RANDOM = () => 0.1;

/** One grid cell — game.js is untyped JS, so annotate callbacks locally. */
type Cell = { x: number; y: number };

function newState(gridSize = GRID_SIZE) {
  return createGameState(gridSize, FIXED_RANDOM);
}

describe("createInitialSnake", () => {
  it("returns a 3-segment snake", () => {
    expect(createInitialSnake()).toHaveLength(3);
  });

  it("places the head at the center of a 20x20 grid", () => {
    const snake = createInitialSnake();
    expect(snake[0]).toEqual({ x: 10, y: 10 });
  });

  it("lays the body out horizontally behind the head", () => {
    expect(createInitialSnake()).toEqual([
      { x: 10, y: 10 },
      { x: 9, y: 10 },
      { x: 8, y: 10 },
    ]);
  });

  it("keeps every segment inside the grid", () => {
    for (const segment of createInitialSnake()) {
      expect(segment.x).toBeGreaterThanOrEqual(0);
      expect(segment.x).toBeLessThan(GRID_SIZE);
      expect(segment.y).toBeGreaterThanOrEqual(0);
      expect(segment.y).toBeLessThan(GRID_SIZE);
    }
  });

  it("honors a custom grid size", () => {
    const snake = createInitialSnake(10);
    expect(snake[0]).toEqual({ x: 5, y: 5 });
    expect(snake).toHaveLength(3);
  });

  it("returns a fresh array each call so state cannot leak between games", () => {
    const first = createInitialSnake();
    const second = createInitialSnake();
    expect(first).not.toBe(second);
    expect(first[0]).not.toBe(second[0]);
    first[0].x = 99;
    expect(second[0].x).toBe(10);
  });
});

describe("DIRECTIONS", () => {
  it("exposes the four arrow directions as unit vectors", () => {
    expect(DIRECTIONS).toEqual({
      up: { x: 0, y: -1 },
      down: { x: 0, y: 1 },
      left: { x: -1, y: 0 },
      right: { x: 1, y: 0 },
    });
  });

  it("pairs up/down and left/right as exact opposites", () => {
    expect(DIRECTIONS.up.y).toBe(-DIRECTIONS.down.y);
    expect(DIRECTIONS.left.x).toBe(-DIRECTIONS.right.x);
  });
});

describe("moveSnake", () => {
  it("shifts the head one cell in the given direction", () => {
    const snake = createInitialSnake();
    expect(moveSnake(snake, DIRECTIONS.right)[0]).toEqual({ x: 11, y: 10 });
    expect(moveSnake(snake, DIRECTIONS.left)[0]).toEqual({ x: 9, y: 10 });
    expect(moveSnake(snake, DIRECTIONS.up)[0]).toEqual({ x: 10, y: 9 });
    expect(moveSnake(snake, DIRECTIONS.down)[0]).toEqual({ x: 10, y: 11 });
  });

  it("drags the body along and drops the tail", () => {
    expect(moveSnake(createInitialSnake(), DIRECTIONS.right)).toEqual([
      { x: 11, y: 10 },
      { x: 10, y: 10 },
      { x: 9, y: 10 },
    ]);
  });

  it("keeps the snake the same length", () => {
    const snake = createInitialSnake();
    expect(moveSnake(snake, DIRECTIONS.up)).toHaveLength(snake.length);
  });

  it("does not mutate the snake it was given", () => {
    const snake = createInitialSnake();
    const before = JSON.parse(JSON.stringify(snake));
    moveSnake(snake, DIRECTIONS.down);
    expect(snake).toEqual(before);
  });

  it("returns fresh segment objects so the old snake stays independent", () => {
    const snake = createInitialSnake();
    const moved = moveSnake(snake, DIRECTIONS.right);
    expect(moved[1]).not.toBe(snake[0]);
    moved[1].x = 99;
    expect(snake[0].x).toBe(10);
  });

  it("leaves the pre-move tail available to the caller for growth", () => {
    const snake = createInitialSnake();
    const tail = snake[snake.length - 1];
    const grown = [...moveSnake(snake, DIRECTIONS.right), tail];
    expect(grown).toHaveLength(4);
    expect(grown[3]).toEqual({ x: 8, y: 10 });
  });

  it("moves a single-segment snake", () => {
    expect(moveSnake([{ x: 0, y: 0 }], DIRECTIONS.down)).toEqual([
      { x: 0, y: 1 },
    ]);
  });
});

describe("checkWallCollision", () => {
  it("reports no collision for cells inside the grid", () => {
    expect(checkWallCollision({ x: 0, y: 0 }, 20)).toBe(false);
    expect(checkWallCollision({ x: 19, y: 19 }, 20)).toBe(false);
    expect(checkWallCollision({ x: 10, y: 10 }, 20)).toBe(false);
  });

  it("reports a collision past each of the four edges", () => {
    expect(checkWallCollision({ x: -1, y: 10 }, 20)).toBe(true);
    expect(checkWallCollision({ x: 20, y: 10 }, 20)).toBe(true);
    expect(checkWallCollision({ x: 10, y: -1 }, 20)).toBe(true);
    expect(checkWallCollision({ x: 10, y: 20 }, 20)).toBe(true);
  });

  it("honors a custom grid size", () => {
    expect(checkWallCollision({ x: 10, y: 10 }, 10)).toBe(true);
    expect(checkWallCollision({ x: 9, y: 9 }, 10)).toBe(false);
  });

  it("defaults to the standard grid size", () => {
    expect(checkWallCollision({ x: GRID_SIZE - 1, y: GRID_SIZE - 1 })).toBe(
      false,
    );
    expect(checkWallCollision({ x: GRID_SIZE, y: 0 })).toBe(true);
  });

  it("agrees with moveSnake when the snake walks off the right edge", () => {
    let snake = [{ x: GRID_SIZE - 1, y: 5 }];
    expect(checkWallCollision(snake[0])).toBe(false);
    snake = moveSnake(snake, DIRECTIONS.right);
    expect(checkWallCollision(snake[0])).toBe(true);
  });
});

describe("checkSelfCollision", () => {
  it("reports no collision for a freshly created snake", () => {
    expect(checkSelfCollision(createInitialSnake())).toBe(false);
  });

  it("reports no collision for a single-segment snake", () => {
    expect(checkSelfCollision([{ x: 3, y: 4 }])).toBe(false);
  });

  it("detects the head landing on a body segment", () => {
    expect(
      checkSelfCollision([
        { x: 5, y: 5 },
        { x: 5, y: 6 },
        { x: 6, y: 6 },
        { x: 6, y: 5 },
        { x: 5, y: 5 },
      ]),
    ).toBe(true);
  });

  it("ignores body segments that overlap each other but not the head", () => {
    expect(
      checkSelfCollision([
        { x: 1, y: 1 },
        { x: 2, y: 2 },
        { x: 2, y: 2 },
      ]),
    ).toBe(false);
  });

  it("detects a snake turning back into its own neck", () => {
    const snake = [
      { x: 5, y: 5 },
      { x: 4, y: 5 },
      { x: 3, y: 5 },
      { x: 2, y: 5 },
    ];
    expect(checkSelfCollision(moveSnake(snake, DIRECTIONS.left))).toBe(true);
  });
});

describe("checkFoodCollision", () => {
  it("detects the head sitting on the food", () => {
    expect(checkFoodCollision({ x: 4, y: 7 }, { x: 4, y: 7 })).toBe(true);
  });

  it("reports no collision when the cells differ", () => {
    expect(checkFoodCollision({ x: 4, y: 7 }, { x: 4, y: 8 })).toBe(false);
    expect(checkFoodCollision({ x: 4, y: 7 }, { x: 5, y: 7 })).toBe(false);
    expect(checkFoodCollision({ x: 0, y: 0 }, { x: 19, y: 19 })).toBe(false);
  });

  it("does not confuse the x and y axes", () => {
    expect(checkFoodCollision({ x: 3, y: 8 }, { x: 8, y: 3 })).toBe(false);
  });

  it("reports no collision when there is no food left to eat", () => {
    expect(checkFoodCollision({ x: 4, y: 7 }, null)).toBe(false);
    expect(checkFoodCollision({ x: 4, y: 7 }, undefined)).toBe(false);
  });

  it("reports no collision without a head", () => {
    expect(checkFoodCollision(null, { x: 4, y: 7 })).toBe(false);
  });

  it("fires on the tick the snake moves onto the food", () => {
    const snake = createInitialSnake();
    const food = { x: 11, y: 10 };
    expect(checkFoodCollision(snake[0], food)).toBe(false);
    expect(
      checkFoodCollision(moveSnake(snake, DIRECTIONS.right)[0], food),
    ).toBe(true);
  });

  it("ignores food touching the body rather than the head", () => {
    expect(checkFoodCollision(createInitialSnake()[0], { x: 9, y: 10 })).toBe(
      false,
    );
  });
});

describe("spawnFood", () => {
  it("places food at the cell the random sample selects", () => {
    // Math.floor(0.1 * 20) = 2 on both axes, and (2,2) is not on the snake.
    expect(spawnFood(20, createInitialSnake(), FIXED_RANDOM)).toEqual({
      x: 2,
      y: 2,
    });
  });

  it("draws x and y from successive samples", () => {
    let i = 0;
    const samples = [0.1, 0.35];
    const food = spawnFood(20, createInitialSnake(), () => samples[i++] ?? 0);
    expect(food).toEqual({ x: 2, y: 7 });
  });

  it("keeps the food inside the grid", () => {
    const food = spawnFood(20, [], () => 0.999999);
    expect(food).toEqual({ x: 19, y: 19 });
  });

  it("clamps a fake that returns exactly 1 instead of spawning past the wall", () => {
    expect(spawnFood(20, [], () => 1)).toEqual({ x: 19, y: 19 });
  });

  it("retries when the first sample lands on the snake", () => {
    let i = 0;
    // (10,10) is the head — rejected; the next pair gives (2,2), which is free.
    const samples = [0.5, 0.5, 0.1, 0.1];
    const food = spawnFood(20, createInitialSnake(), () => samples[i++] ?? 0);
    expect(food).toEqual({ x: 2, y: 2 });
  });

  it("never returns a cell occupied by the snake", () => {
    const snake = createInitialSnake();
    let i = 0;
    const samples = [0.5, 0.5, 0.45, 0.5, 0.4, 0.5, 0.1, 0.1];
    const food = spawnFood(20, snake, () => samples[i++] ?? 0);
    expect(
      snake.some(
        (segment: Cell) => segment.x === food.x && segment.y === food.y,
      ),
    ).toBe(false);
  });

  it("falls back to a free cell when random sampling keeps colliding", () => {
    // Every cell of a 3x3 board is taken except (2,2), and the fake always
    // samples (0,0). The attempt cap trips and the scan finds the last cell.
    const snake = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 0, y: 2 },
      { x: 1, y: 2 },
    ];
    expect(spawnFood(3, snake, () => 0)).toEqual({ x: 2, y: 2 });
  });

  it("returns null when the snake has filled the board", () => {
    const snake = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
    ];
    expect(spawnFood(2, snake, () => 0)).toBeNull();
  });

  it("spawns anywhere on an empty board", () => {
    expect(spawnFood(20, [], () => 0)).toEqual({ x: 0, y: 0 });
  });

  it("does not mutate the snake it was given", () => {
    const snake = createInitialSnake();
    const before = JSON.parse(JSON.stringify(snake));
    spawnFood(20, snake, FIXED_RANDOM);
    expect(snake).toEqual(before);
  });
});

describe("isOpposite", () => {
  it("is true for each pair of opposing directions", () => {
    expect(isOpposite(DIRECTIONS.up, DIRECTIONS.down)).toBe(true);
    expect(isOpposite(DIRECTIONS.down, DIRECTIONS.up)).toBe(true);
    expect(isOpposite(DIRECTIONS.left, DIRECTIONS.right)).toBe(true);
    expect(isOpposite(DIRECTIONS.right, DIRECTIONS.left)).toBe(true);
  });

  it("is false for a direction against itself or a perpendicular one", () => {
    expect(isOpposite(DIRECTIONS.up, DIRECTIONS.up)).toBe(false);
    expect(isOpposite(DIRECTIONS.up, DIRECTIONS.left)).toBe(false);
    expect(isOpposite(DIRECTIONS.right, DIRECTIONS.down)).toBe(false);
  });
});

describe("getNewDirection", () => {
  it("accepts a perpendicular turn", () => {
    expect(getNewDirection(DIRECTIONS.right, DIRECTIONS.up)).toBe(
      DIRECTIONS.up,
    );
    expect(getNewDirection(DIRECTIONS.right, DIRECTIONS.down)).toBe(
      DIRECTIONS.down,
    );
    expect(getNewDirection(DIRECTIONS.up, DIRECTIONS.left)).toBe(
      DIRECTIONS.left,
    );
    expect(getNewDirection(DIRECTIONS.down, DIRECTIONS.right)).toBe(
      DIRECTIONS.right,
    );
  });

  it("rejects a 180-degree reversal and keeps the current heading", () => {
    expect(getNewDirection(DIRECTIONS.right, DIRECTIONS.left)).toBe(
      DIRECTIONS.right,
    );
    expect(getNewDirection(DIRECTIONS.left, DIRECTIONS.right)).toBe(
      DIRECTIONS.left,
    );
    expect(getNewDirection(DIRECTIONS.up, DIRECTIONS.down)).toBe(DIRECTIONS.up);
    expect(getNewDirection(DIRECTIONS.down, DIRECTIONS.up)).toBe(
      DIRECTIONS.down,
    );
  });

  it("keeps the current heading when the input repeats it", () => {
    expect(getNewDirection(DIRECTIONS.up, DIRECTIONS.up)).toBe(DIRECTIONS.up);
  });

  it("ignores missing input", () => {
    expect(getNewDirection(DIRECTIONS.left, null)).toBe(DIRECTIONS.left);
    expect(getNewDirection(DIRECTIONS.left, undefined)).toBe(DIRECTIONS.left);
  });

  it("accepts an equivalent vector that is not the shared DIRECTIONS object", () => {
    expect(getNewDirection(DIRECTIONS.right, { x: 0, y: -1 })).toEqual({
      x: 0,
      y: -1,
    });
  });

  it("keeps a reversal from ever driving the head into the neck", () => {
    const snake = createInitialSnake();
    const direction = getNewDirection(DIRECTIONS.right, DIRECTIONS.left);
    expect(checkSelfCollision(moveSnake(snake, direction))).toBe(false);
  });
});

describe("directionFromKey", () => {
  it("maps each arrow key to its direction vector", () => {
    expect(directionFromKey("ArrowUp")).toBe(DIRECTIONS.up);
    expect(directionFromKey("ArrowDown")).toBe(DIRECTIONS.down);
    expect(directionFromKey("ArrowLeft")).toBe(DIRECTIONS.left);
    expect(directionFromKey("ArrowRight")).toBe(DIRECTIONS.right);
  });

  it("returns null for keys that do not steer", () => {
    expect(directionFromKey(" ")).toBeNull();
    expect(directionFromKey("Enter")).toBeNull();
    expect(directionFromKey("w")).toBeNull();
  });

  it("returns null for inherited object property names", () => {
    expect(directionFromKey("constructor")).toBeNull();
    expect(directionFromKey("toString")).toBeNull();
  });

  it("covers exactly the four arrow keys", () => {
    expect(Object.keys(KEY_DIRECTIONS)).toEqual([
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
    ]);
  });
});

describe("createGameState", () => {
  it("starts with a centered snake heading right and the loop stopped", () => {
    const state = newState();
    expect(state.snake).toEqual(createInitialSnake());
    expect(state.direction).toBe(DIRECTIONS.right);
    expect(state.pendingDirection).toBe(DIRECTIONS.right);
    expect(state.gridSize).toBe(GRID_SIZE);
    expect(state.running).toBe(false);
  });

  it("starts the round alive and at zero score", () => {
    const state = newState();
    expect(state.gameOver).toBe(false);
    expect(state.score).toBe(0);
  });

  it("spawns food that is on the board and off the snake", () => {
    const state = newState();
    expect(state.food).toEqual({ x: 2, y: 2 });
    expect(
      state.snake.some(
        (segment: Cell) =>
          segment.x === state.food.x && segment.y === state.food.y,
      ),
    ).toBe(false);
  });

  it("honors a custom grid size", () => {
    const state = newState(10);
    expect(state.gridSize).toBe(10);
    expect(state.snake[0]).toEqual({ x: 5, y: 5 });
  });

  it("returns independent state each call", () => {
    const first = newState();
    const second = newState();
    first.snake[0].x = 99;
    expect(second.snake[0].x).toBe(10);
  });
});

describe("applyInput", () => {
  it("queues a legal turn without changing the committed direction", () => {
    const state = newState();
    expect(applyInput(state, DIRECTIONS.up)).toBe(DIRECTIONS.up);
    expect(state.pendingDirection).toBe(DIRECTIONS.up);
    expect(state.direction).toBe(DIRECTIONS.right);
  });

  it("ignores a reversal of the committed direction", () => {
    const state = newState();
    applyInput(state, DIRECTIONS.left);
    expect(state.pendingDirection).toBe(DIRECTIONS.right);
  });

  it("keeps an already-queued turn when a later input is rejected", () => {
    const state = newState();
    applyInput(state, DIRECTIONS.up);
    applyInput(state, DIRECTIONS.left);
    expect(state.pendingDirection).toBe(DIRECTIONS.up);
  });

  it("ignores a non-steering key", () => {
    const state = newState();
    applyInput(state, directionFromKey(" "));
    expect(state.pendingDirection).toBe(DIRECTIONS.right);
  });
});

describe("tick", () => {
  it("moves the snake one cell in the committed direction", () => {
    const state = newState();
    tick(state);
    expect(state.snake[0]).toEqual({ x: 11, y: 10 });
    expect(state.snake).toHaveLength(3);
  });

  it("keeps moving on each successive tick", () => {
    const state = newState();
    tick(state);
    tick(state);
    tick(state);
    expect(state.snake[0]).toEqual({ x: 13, y: 10 });
  });

  it("commits the queued direction before moving", () => {
    const state = newState();
    applyInput(state, DIRECTIONS.up);
    tick(state);
    expect(state.direction).toBe(DIRECTIONS.up);
    expect(state.snake[0]).toEqual({ x: 10, y: 9 });
  });

  it("never lets two inputs inside one tick reverse the snake", () => {
    const state = newState();
    applyInput(state, DIRECTIONS.up);
    applyInput(state, DIRECTIONS.left);
    tick(state);
    expect(checkSelfCollision(state.snake)).toBe(false);
    expect(state.snake[0]).toEqual({ x: 10, y: 9 });
  });

  it("grows the snake by one when the head reaches the food", () => {
    const state = newState();
    state.food = { x: 11, y: 10 };
    tick(state);
    expect(state.snake).toEqual([
      { x: 11, y: 10 },
      { x: 10, y: 10 },
      { x: 9, y: 10 },
      { x: 8, y: 10 },
    ]);
  });

  it("keeps the snake the same length when it misses the food", () => {
    const state = newState();
    state.food = { x: 15, y: 3 };
    tick(state);
    expect(state.snake).toHaveLength(3);
  });

  it("spawns replacement food that is not on the grown snake", () => {
    const state = newState();
    state.food = { x: 11, y: 10 };
    tick(state);
    expect(state.food).toEqual({ x: 2, y: 2 });
    expect(
      state.snake.some(
        (segment: Cell) =>
          segment.x === state.food.x && segment.y === state.food.y,
      ),
    ).toBe(false);
  });

  it("grows again on the next meal", () => {
    const state = newState();
    state.food = { x: 11, y: 10 };
    tick(state);
    state.food = { x: 12, y: 10 };
    tick(state);
    expect(state.snake).toHaveLength(5);
    expect(state.snake[0]).toEqual({ x: 12, y: 10 });
    expect(state.snake[4]).toEqual({ x: 8, y: 10 });
  });

  it("keeps growing while the tail trails normally afterwards", () => {
    const state = newState();
    state.food = { x: 11, y: 10 };
    tick(state);
    state.food = { x: 19, y: 19 };
    tick(state);
    expect(state.snake).toEqual([
      { x: 12, y: 10 },
      { x: 11, y: 10 },
      { x: 10, y: 10 },
      { x: 9, y: 10 },
    ]);
  });

  it("grows into a turn without swallowing its own neck", () => {
    const state = newState();
    state.food = { x: 10, y: 9 };
    applyInput(state, DIRECTIONS.up);
    tick(state);
    expect(state.snake).toHaveLength(4);
    expect(checkSelfCollision(state.snake)).toBe(false);
  });

  it("walks the snake off the board so wall collision can be detected", () => {
    const state = newState();
    for (let i = 0; i < 10; i++) {
      tick(state);
    }
    expect(checkWallCollision(state.snake[0], state.gridSize)).toBe(true);
  });
});

describe("TICK_MS", () => {
  it("is a playable interval", () => {
    expect(TICK_MS).toBe(150);
  });
});

/**
 * A snake curled into a loop, head first, so the next downward step drives the
 * head into its own flank rather than into the tail cell (which `moveSnake`
 * vacates on the same tick and is therefore legal to enter).
 *
 * Head (5,5) steps down to (5,6). `moveSnake` drops only the final segment
 * (4,6), so the (5,6) segment survives the move and the new head lands on it.
 */
function coiledSnake(): Cell[] {
  return [
    { x: 5, y: 5 },
    { x: 5, y: 4 },
    { x: 6, y: 4 },
    { x: 6, y: 5 },
    { x: 6, y: 6 },
    { x: 5, y: 6 },
    { x: 4, y: 6 },
  ];
}

describe("hasCollided", () => {
  it("is false for a fresh round", () => {
    expect(hasCollided(newState())).toBe(false);
  });

  it("is false while the snake is mid-board", () => {
    const state = newState();
    state.snake = [
      { x: 3, y: 7 },
      { x: 2, y: 7 },
      { x: 1, y: 7 },
    ];
    expect(hasCollided(state)).toBe(false);
  });

  it("catches the head leaving through each of the four walls", () => {
    const offBoard: Cell[] = [
      { x: -1, y: 10 },
      { x: GRID_SIZE, y: 10 },
      { x: 10, y: -1 },
      { x: 10, y: GRID_SIZE },
    ];
    for (const head of offBoard) {
      const state = newState();
      state.snake = [head, { x: 10, y: 10 }];
      expect(hasCollided(state)).toBe(true);
    }
  });

  it("is still false on the last cell inside the wall", () => {
    const state = newState();
    state.snake = [{ x: GRID_SIZE - 1, y: GRID_SIZE - 1 }];
    expect(hasCollided(state)).toBe(false);
  });

  it("catches the head sitting on its own body", () => {
    const state = newState();
    state.snake = [
      { x: 5, y: 5 },
      { x: 6, y: 5 },
      { x: 5, y: 5 },
    ];
    expect(hasCollided(state)).toBe(true);
  });

  it("measures the wall against the state's own grid size", () => {
    const small = newState(10);
    small.snake = [{ x: 12, y: 3 }];
    expect(hasCollided(small)).toBe(true);
    const large = newState();
    large.snake = [{ x: 12, y: 3 }];
    expect(hasCollided(large)).toBe(false);
  });
});

describe("scoring", () => {
  it("awards a point for the food the snake eats", () => {
    const state = newState();
    state.food = { x: 11, y: 10 };
    tick(state);
    expect(state.score).toBe(POINTS_PER_FOOD);
  });

  it("leaves the score alone on a tick that eats nothing", () => {
    const state = newState();
    state.food = { x: 15, y: 3 };
    tick(state);
    tick(state);
    expect(state.score).toBe(0);
  });

  it("accumulates across meals", () => {
    const state = newState();
    state.food = { x: 11, y: 10 };
    tick(state);
    state.food = { x: 12, y: 10 };
    tick(state);
    expect(state.score).toBe(2 * POINTS_PER_FOOD);
  });

  it("keeps the score in step with the snake's growth", () => {
    const state = newState();
    for (let i = 0; i < 3; i++) {
      state.food = { x: 11 + i, y: 10 };
      tick(state);
    }
    expect(state.score).toBe(3 * POINTS_PER_FOOD);
    expect(state.snake).toHaveLength(INITIAL_SNAKE_LENGTH + 3);
  });
});

describe("game over", () => {
  it("stays clear while the snake is safely on the board", () => {
    const state = newState();
    tick(state);
    tick(state);
    expect(state.gameOver).toBe(false);
  });

  it("latches when the snake walks into a wall", () => {
    const state = newState();
    // Head starts at x=10 and moves right; x=20 is the first cell past the wall.
    for (let i = 0; i < 9; i++) {
      tick(state);
    }
    expect(state.gameOver).toBe(false);
    expect(state.snake[0]).toEqual({ x: 19, y: 10 });
    tick(state);
    expect(state.gameOver).toBe(true);
  });

  it("latches when the snake runs into its own body", () => {
    const state = newState();
    state.snake = coiledSnake();
    applyInput(state, DIRECTIONS.down);
    tick(state);
    expect(state.snake[0]).toEqual({ x: 5, y: 6 });
    expect(checkSelfCollision(state.snake)).toBe(true);
    expect(state.gameOver).toBe(true);
  });

  it("does not end the round when the head enters the vacated tail cell", () => {
    const state = newState();
    state.snake = [
      { x: 5, y: 5 },
      { x: 5, y: 4 },
      { x: 6, y: 4 },
      { x: 6, y: 5 },
    ];
    // Moving right from (5,5) lands on (6,5), which the tail leaves this tick.
    tick(state);
    expect(state.snake[0]).toEqual({ x: 6, y: 5 });
    expect(state.gameOver).toBe(false);
  });

  it("freezes the snake and the score once the round is over", () => {
    const state = newState();
    for (let i = 0; i < 10; i++) {
      tick(state);
    }
    expect(state.gameOver).toBe(true);
    const frozenSnake = state.snake.map((segment: Cell) => ({ ...segment }));
    const frozenScore = state.score;
    tick(state);
    tick(state);
    expect(state.snake).toEqual(frozenSnake);
    expect(state.score).toBe(frozenScore);
  });

  it("keeps the final score readable after the round ends", () => {
    const state = newState();
    state.food = { x: 11, y: 10 };
    tick(state);
    for (let i = 0; i < 9; i++) {
      tick(state);
    }
    expect(state.gameOver).toBe(true);
    expect(state.score).toBe(POINTS_PER_FOOD);
  });
});

describe("START_KEYS / isStartKey", () => {
  it("accepts the modern space key name", () => {
    expect(isStartKey(" ")).toBe(true);
  });

  it("accepts the legacy Spacebar name", () => {
    expect(isStartKey("Spacebar")).toBe(true);
  });

  it("rejects the arrow keys, which steer rather than start", () => {
    for (const key of Object.keys(KEY_DIRECTIONS)) {
      expect(isStartKey(key)).toBe(false);
    }
  });

  it("rejects other keys", () => {
    expect(isStartKey("Enter")).toBe(false);
    expect(isStartKey("s")).toBe(false);
    expect(isStartKey("")).toBe(false);
    expect(isStartKey(undefined)).toBe(false);
  });

  it("is frozen so a stray push cannot widen the start keys", () => {
    expect(Object.isFrozen(START_KEYS)).toBe(true);
  });
});

describe("resetState", () => {
  /** Drive the snake right into the wall so the round is genuinely finished. */
  function playUntilGameOver(state: ReturnType<typeof newState>) {
    // Head starts at x=10 moving right; x=20 is the first cell past the wall.
    for (let i = 0; i < 10; i++) {
      tick(state);
    }
    expect(state.gameOver).toBe(true);
    return state;
  }

  it("resets in place so callers holding the state keep a live reference", () => {
    const state = newState();
    expect(resetState(state)).toBe(state);
  });

  it("puts the snake back to its opening position and length", () => {
    const state = newState();
    playUntilGameOver(state);
    resetState(state);
    expect(state.snake).toEqual(createInitialSnake(GRID_SIZE));
    expect(state.snake).toHaveLength(INITIAL_SNAKE_LENGTH);
  });

  it("resets the score to zero", () => {
    const state = newState();
    state.food = { x: 11, y: 10 };
    tick(state);
    expect(state.score).toBe(POINTS_PER_FOOD);
    resetState(state);
    expect(state.score).toBe(0);
  });

  it("clears the game over flag so the round can run again", () => {
    const state = newState();
    playUntilGameOver(state);
    resetState(state);
    expect(state.gameOver).toBe(false);
    expect(hasCollided(state)).toBe(false);
  });

  it("marks the round as not running, so the loop must be started again", () => {
    const state = newState();
    state.running = true;
    resetState(state);
    expect(state.running).toBe(false);
  });

  it("points the snake right again and drops any queued turn", () => {
    const state = newState();
    applyInput(state, DIRECTIONS.up);
    tick(state);
    expect(state.direction).toBe(DIRECTIONS.up);
    resetState(state);
    expect(state.direction).toBe(DIRECTIONS.right);
    expect(state.pendingDirection).toBe(DIRECTIONS.right);
  });

  it("keeps the board size and the injected random source", () => {
    const state = createGameState(10, FIXED_RANDOM);
    resetState(state);
    expect(state.gridSize).toBe(10);
    expect(state.random).toBe(FIXED_RANDOM);
    // Grid 10 -> center 5, so the snake sits at (5,5)/(4,5)/(3,5).
    expect(state.snake[0]).toEqual({ x: 5, y: 5 });
  });

  it("spawns fresh food clear of the reset snake", () => {
    const state = newState();
    playUntilGameOver(state);
    resetState(state);
    // Math.floor(0.1 * 20) = 2, so the food lands at (2,2) — off the snake,
    // which occupies (8,10)/(9,10)/(10,10).
    expect(state.food).toEqual({ x: 2, y: 2 });
    expect(
      state.snake.some(
        (segment: Cell) =>
          segment.x === state.food.x && segment.y === state.food.y,
      ),
    ).toBe(false);
  });

  it("leaves a played-out round identical to a brand new one", () => {
    const played = newState();
    played.food = { x: 11, y: 10 };
    playUntilGameOver(played);
    resetState(played);
    expect(played).toEqual(newState());
  });

  it("hands back a state that ticks normally after the restart", () => {
    const state = newState();
    playUntilGameOver(state);
    resetState(state);
    tick(state);
    expect(state.snake[0]).toEqual({ x: 11, y: 10 });
    expect(state.gameOver).toBe(false);
    expect(state.score).toBe(0);
  });

  it("can restart a round that ended on a self-collision", () => {
    const state = newState();
    state.snake = coiledSnake();
    applyInput(state, DIRECTIONS.down);
    tick(state);
    expect(state.gameOver).toBe(true);
    resetState(state);
    expect(state.gameOver).toBe(false);
    expect(state.snake).toEqual(createInitialSnake(GRID_SIZE));
  });

  it("survives being restarted twice in a row", () => {
    const state = newState();
    playUntilGameOver(state);
    resetState(state);
    resetState(state);
    expect(state).toEqual(newState());
  });
});
