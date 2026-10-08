import { describe, it, expect } from "vitest";
import {
  createInitialSnake,
  createInitialState,
  moveSnake,
  checkWallCollision,
  checkSelfCollision,
  checkFoodCollision,
  spawnFood,
  getNewDirection,
  isGameOver,
  GRID_SIZE,
} from "./game.js";

describe("createInitialSnake", () => {
  it("returns an array of three segments", () => {
    const snake = createInitialSnake();
    expect(Array.isArray(snake)).toBe(true);
    expect(snake).toHaveLength(3);
  });

  it("places the head near the center of the grid", () => {
    const snake = createInitialSnake();
    expect(snake[0]).toEqual({ x: 10, y: 10 });
    expect(snake[0].x).toBeLessThan(GRID_SIZE);
    expect(snake[0].y).toBeLessThan(GRID_SIZE);
  });

  it("places body segments horizontally to the left of the head", () => {
    const snake = createInitialSnake();
    expect(snake[1]).toEqual({ x: 9, y: 10 });
    expect(snake[2]).toEqual({ x: 8, y: 10 });
  });

  it("returns a fresh array on each call (no shared state)", () => {
    const a = createInitialSnake();
    const b = createInitialSnake();
    expect(a).not.toBe(b);
    a[0].x = -1;
    expect(b[0].x).toBe(10);
  });
});

describe("moveSnake", () => {
  it("moves the head right by one cell", () => {
    const snake = [
      { x: 10, y: 10 },
      { x: 9, y: 10 },
      { x: 8, y: 10 },
    ];
    const next = moveSnake(snake, "right");
    expect(next[0]).toEqual({ x: 11, y: 10 });
  });

  it("moves the head up by one cell (y decreases)", () => {
    const snake = [
      { x: 10, y: 10 },
      { x: 9, y: 10 },
      { x: 8, y: 10 },
    ];
    const next = moveSnake(snake, "up");
    expect(next[0]).toEqual({ x: 10, y: 9 });
  });

  it("moves the head down by one cell (y increases)", () => {
    const snake = [
      { x: 10, y: 10 },
      { x: 9, y: 10 },
      { x: 8, y: 10 },
    ];
    const next = moveSnake(snake, "down");
    expect(next[0]).toEqual({ x: 10, y: 11 });
  });

  it("moves the head left by one cell", () => {
    const snake = [
      { x: 10, y: 10 },
      { x: 11, y: 10 },
      { x: 12, y: 10 },
    ];
    const next = moveSnake(snake, "left");
    expect(next[0]).toEqual({ x: 9, y: 10 });
  });

  it("preserves snake length and drops the tail when not growing", () => {
    const snake = [
      { x: 10, y: 10 },
      { x: 9, y: 10 },
      { x: 8, y: 10 },
    ];
    const next = moveSnake(snake, "right");
    expect(next).toHaveLength(3);
    expect(next[1]).toEqual({ x: 10, y: 10 });
    expect(next[2]).toEqual({ x: 9, y: 10 });
  });

  it("does not mutate the input snake array", () => {
    const snake = [
      { x: 10, y: 10 },
      { x: 9, y: 10 },
      { x: 8, y: 10 },
    ];
    const before = JSON.parse(JSON.stringify(snake));
    moveSnake(snake, "right");
    expect(snake).toEqual(before);
  });
});

describe("checkWallCollision", () => {
  it("returns false for a head inside the grid", () => {
    expect(checkWallCollision({ x: 0, y: 0 }, GRID_SIZE)).toBe(false);
    expect(checkWallCollision({ x: 10, y: 10 }, GRID_SIZE)).toBe(false);
    expect(
      checkWallCollision({ x: GRID_SIZE - 1, y: GRID_SIZE - 1 }, GRID_SIZE),
    ).toBe(false);
  });

  it("returns true when head x is below 0", () => {
    expect(checkWallCollision({ x: -1, y: 10 }, GRID_SIZE)).toBe(true);
  });

  it("returns true when head x is at gridSize", () => {
    expect(checkWallCollision({ x: GRID_SIZE, y: 10 }, GRID_SIZE)).toBe(true);
  });

  it("returns true when head y is below 0", () => {
    expect(checkWallCollision({ x: 10, y: -1 }, GRID_SIZE)).toBe(true);
  });

  it("returns true when head y is at gridSize", () => {
    expect(checkWallCollision({ x: 10, y: GRID_SIZE }, GRID_SIZE)).toBe(true);
  });
});

describe("checkSelfCollision", () => {
  it("returns false for the initial snake (no overlap)", () => {
    expect(checkSelfCollision(createInitialSnake())).toBe(false);
  });

  it("returns false for a non-overlapping snake", () => {
    const snake = [
      { x: 5, y: 5 },
      { x: 4, y: 5 },
      { x: 3, y: 5 },
      { x: 2, y: 5 },
    ];
    expect(checkSelfCollision(snake)).toBe(false);
  });

  it("returns true when the head overlaps a body segment", () => {
    const snake = [
      { x: 5, y: 5 },
      { x: 4, y: 5 },
      { x: 4, y: 6 },
      { x: 5, y: 6 },
      { x: 5, y: 5 },
    ];
    expect(checkSelfCollision(snake)).toBe(true);
  });

  it("returns false for a single-segment snake", () => {
    expect(checkSelfCollision([{ x: 0, y: 0 }])).toBe(false);
  });
});

describe("checkFoodCollision", () => {
  it("returns true when head and food share the same cell", () => {
    expect(checkFoodCollision({ x: 5, y: 7 }, { x: 5, y: 7 })).toBe(true);
    expect(checkFoodCollision({ x: 0, y: 0 }, { x: 0, y: 0 })).toBe(true);
  });

  it("returns false when head and food are on different cells", () => {
    expect(checkFoodCollision({ x: 5, y: 7 }, { x: 6, y: 7 })).toBe(false);
    expect(checkFoodCollision({ x: 5, y: 7 }, { x: 5, y: 8 })).toBe(false);
    expect(checkFoodCollision({ x: 0, y: 0 }, { x: 1, y: 1 })).toBe(false);
  });

  it("returns false when there is no food (null/undefined)", () => {
    expect(checkFoodCollision({ x: 0, y: 0 }, null)).toBe(false);
    expect(checkFoodCollision({ x: 0, y: 0 }, undefined)).toBe(false);
  });
});

describe("spawnFood", () => {
  it("returns a position within the grid bounds", () => {
    // random=0.1 → Math.floor(0.1*20)=2 → (2,2). Snake at (0,0) so no collision.
    const snake = [{ x: 0, y: 0 }];
    const food = spawnFood(20, snake, () => 0.1);
    expect(food).toEqual({ x: 2, y: 2 });
    expect(food!.x).toBeGreaterThanOrEqual(0);
    expect(food!.x).toBeLessThan(20);
    expect(food!.y).toBeGreaterThanOrEqual(0);
    expect(food!.y).toBeLessThan(20);
  });

  it("does not place food on any snake segment", () => {
    // First attempt random=0.1 → (2,2) collides with snake; second random=0.5 → (10,10) does not.
    const snake = [
      { x: 2, y: 2 },
      { x: 1, y: 2 },
      { x: 0, y: 2 },
    ];
    const seq = [0.1, 0.1, 0.5, 0.5];
    let i = 0;
    const food = spawnFood(20, snake, () => seq[i++] ?? 0);
    expect(food).toEqual({ x: 10, y: 10 });
    // Verify the spot is not on the snake.
    expect(snake.some((s) => s.x === food!.x && s.y === food!.y)).toBe(false);
  });

  it("respects the grid size for smaller boards", () => {
    // gridSize=5, random=0.0 → (0,0). Snake at (3,3) so no collision.
    const food = spawnFood(5, [{ x: 3, y: 3 }], () => 0.0);
    expect(food).toEqual({ x: 0, y: 0 });
  });

  it("falls back deterministically when random keeps colliding", () => {
    // gridSize=2, snake occupies (0,0) and (1,1). Random always returns 0.5 →
    // Math.floor(0.5*2)=1 → (1,1) which is occupied. After maxAttempts=4 the
    // deterministic scan should find (1,0) (the first free cell in row-major order).
    const snake = [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ];
    const food = spawnFood(2, snake, () => 0.5);
    expect(food).toEqual({ x: 1, y: 0 });
  });
});

describe("isGameOver", () => {
  it("returns false for the initial snake well inside the grid", () => {
    expect(isGameOver(createInitialSnake(), GRID_SIZE)).toBe(false);
  });

  it("returns true when the head is out of bounds on any side", () => {
    expect(isGameOver([{ x: -1, y: 5 }], GRID_SIZE)).toBe(true);
    expect(isGameOver([{ x: GRID_SIZE, y: 5 }], GRID_SIZE)).toBe(true);
    expect(isGameOver([{ x: 5, y: -1 }], GRID_SIZE)).toBe(true);
    expect(isGameOver([{ x: 5, y: GRID_SIZE }], GRID_SIZE)).toBe(true);
  });

  it("returns true when the head overlaps a body segment", () => {
    const snake = [
      { x: 5, y: 5 },
      { x: 4, y: 5 },
      { x: 4, y: 6 },
      { x: 5, y: 6 },
      { x: 5, y: 5 },
    ];
    expect(isGameOver(snake, GRID_SIZE)).toBe(true);
  });

  it("returns false for a longer non-overlapping snake in-bounds", () => {
    const snake = [
      { x: 5, y: 5 },
      { x: 4, y: 5 },
      { x: 3, y: 5 },
      { x: 2, y: 5 },
    ];
    expect(isGameOver(snake, GRID_SIZE)).toBe(false);
  });

  it("returns false for empty or missing snake input", () => {
    expect(isGameOver([], GRID_SIZE)).toBe(false);
    // @ts-expect-error - exercising the null guard
    expect(isGameOver(null, GRID_SIZE)).toBe(false);
  });
});

describe("createInitialState", () => {
  it("returns a fresh state with the initial snake, score 0, and idle status", () => {
    // random=0.1 → Math.floor(0.1*20)=2 → food at (2,2). Initial snake is at
    // (10,10)/(9,10)/(8,10) so (2,2) does NOT collide — Rule 1 safe.
    const state = createInitialState(() => 0.1);
    expect(state.snake).toEqual([
      { x: 10, y: 10 },
      { x: 9, y: 10 },
      { x: 8, y: 10 },
    ]);
    expect(state.direction).toBe("right");
    expect(state.pendingDirection).toBe("right");
    expect(state.score).toBe(0);
    expect(state.status).toBe("idle");
  });

  it("places food within the grid and off the snake", () => {
    const state = createInitialState(() => 0.1);
    expect(state.food).toEqual({ x: 2, y: 2 });
    expect(state.food!.x).toBeGreaterThanOrEqual(0);
    expect(state.food!.x).toBeLessThan(GRID_SIZE);
    expect(state.food!.y).toBeGreaterThanOrEqual(0);
    expect(state.food!.y).toBeLessThan(GRID_SIZE);
    expect(
      state.snake.some((s) => s.x === state.food!.x && s.y === state.food!.y),
    ).toBe(false);
  });

  it("returns a fresh state on each call (no shared state)", () => {
    const a = createInitialState(() => 0.1);
    const b = createInitialState(() => 0.1);
    expect(a).not.toBe(b);
    expect(a.snake).not.toBe(b.snake);
    a.score = 99;
    a.snake[0].x = -1;
    expect(b.score).toBe(0);
    expect(b.snake[0].x).toBe(10);
  });
});

describe("getNewDirection", () => {
  it("returns the input direction for a valid non-opposite turn", () => {
    expect(getNewDirection("right", "up")).toBe("up");
    expect(getNewDirection("right", "down")).toBe("down");
    expect(getNewDirection("up", "left")).toBe("left");
    expect(getNewDirection("up", "right")).toBe("right");
  });

  it("returns the current direction when the input would be a 180-degree turn", () => {
    expect(getNewDirection("right", "left")).toBe("right");
    expect(getNewDirection("left", "right")).toBe("left");
    expect(getNewDirection("up", "down")).toBe("up");
    expect(getNewDirection("down", "up")).toBe("down");
  });

  it("returns the current direction when the input is the same as current", () => {
    expect(getNewDirection("right", "right")).toBe("right");
    expect(getNewDirection("up", "up")).toBe("up");
  });

  it("returns the current direction for unknown inputs", () => {
    expect(getNewDirection("right", "diagonal")).toBe("right");
    expect(getNewDirection("up", "")).toBe("up");
  });
});
