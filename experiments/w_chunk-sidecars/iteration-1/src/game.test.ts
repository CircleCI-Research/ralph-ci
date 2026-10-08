import { describe, it, expect } from "vitest";
// @ts-expect-error - game.js is plain JS without types
import {
  createInitialSnake,
  moveSnake,
  checkWallCollision,
  checkSelfCollision,
  checkFoodCollision,
  spawnFood,
  getNewDirection,
  isGameOver,
} from "./game.js";

describe("createInitialSnake", () => {
  it("returns a 3-segment snake", () => {
    const snake = createInitialSnake();
    expect(snake).toHaveLength(3);
  });

  it("places the head near the center of a 20x20 grid", () => {
    const snake = createInitialSnake();
    const head = snake[0];
    expect(head.x).toBeGreaterThanOrEqual(5);
    expect(head.x).toBeLessThan(15);
    expect(head.y).toBeGreaterThanOrEqual(5);
    expect(head.y).toBeLessThan(15);
  });

  it("orients the body horizontally behind the head", () => {
    const snake = createInitialSnake();
    expect(snake[1].y).toBe(snake[0].y);
    expect(snake[2].y).toBe(snake[0].y);
    expect(snake[1].x).toBe(snake[0].x - 1);
    expect(snake[2].x).toBe(snake[0].x - 2);
  });

  it("returns segments with numeric x and y coordinates", () => {
    const snake = createInitialSnake();
    for (const segment of snake) {
      expect(typeof segment.x).toBe("number");
      expect(typeof segment.y).toBe("number");
    }
  });
});

describe("moveSnake", () => {
  it("moves the head one cell right when direction is 'right'", () => {
    const snake = [
      { x: 5, y: 5 },
      { x: 4, y: 5 },
      { x: 3, y: 5 },
    ];
    const result = moveSnake(snake, "right");
    expect(result[0]).toEqual({ x: 6, y: 5 });
  });

  it("moves the head one cell left when direction is 'left'", () => {
    const snake = [
      { x: 5, y: 5 },
      { x: 6, y: 5 },
      { x: 7, y: 5 },
    ];
    const result = moveSnake(snake, "left");
    expect(result[0]).toEqual({ x: 4, y: 5 });
  });

  it("moves the head one cell up when direction is 'up'", () => {
    const snake = [
      { x: 5, y: 5 },
      { x: 5, y: 6 },
      { x: 5, y: 7 },
    ];
    const result = moveSnake(snake, "up");
    expect(result[0]).toEqual({ x: 5, y: 4 });
  });

  it("moves the head one cell down when direction is 'down'", () => {
    const snake = [
      { x: 5, y: 5 },
      { x: 5, y: 4 },
      { x: 5, y: 3 },
    ];
    const result = moveSnake(snake, "down");
    expect(result[0]).toEqual({ x: 5, y: 6 });
  });

  it("preserves snake length when moving without eating", () => {
    const snake = [
      { x: 5, y: 5 },
      { x: 4, y: 5 },
      { x: 3, y: 5 },
    ];
    const result = moveSnake(snake, "right");
    expect(result).toHaveLength(snake.length);
  });

  it("shifts each body segment forward by one position", () => {
    const snake = [
      { x: 5, y: 5 },
      { x: 4, y: 5 },
      { x: 3, y: 5 },
    ];
    const result = moveSnake(snake, "right");
    expect(result[1]).toEqual({ x: 5, y: 5 });
    expect(result[2]).toEqual({ x: 4, y: 5 });
  });

  it("does not mutate the original snake array", () => {
    const snake = [
      { x: 5, y: 5 },
      { x: 4, y: 5 },
      { x: 3, y: 5 },
    ];
    const before = snake.map((s) => ({ ...s }));
    moveSnake(snake, "right");
    expect(snake).toEqual(before);
  });
});

describe("checkWallCollision", () => {
  const gridSize = 20;

  it("returns true when head x is less than 0", () => {
    expect(checkWallCollision({ x: -1, y: 5 }, gridSize)).toBe(true);
  });

  it("returns true when head x is equal to gridSize", () => {
    expect(checkWallCollision({ x: 20, y: 5 }, gridSize)).toBe(true);
  });

  it("returns true when head y is less than 0", () => {
    expect(checkWallCollision({ x: 5, y: -1 }, gridSize)).toBe(true);
  });

  it("returns true when head y is equal to gridSize", () => {
    expect(checkWallCollision({ x: 5, y: 20 }, gridSize)).toBe(true);
  });

  it("returns false when head is inside the grid", () => {
    expect(checkWallCollision({ x: 10, y: 10 }, gridSize)).toBe(false);
  });

  it("returns false at the boundary cells (0 and gridSize - 1)", () => {
    expect(checkWallCollision({ x: 0, y: 0 }, gridSize)).toBe(false);
    expect(checkWallCollision({ x: 19, y: 19 }, gridSize)).toBe(false);
  });
});

describe("checkSelfCollision", () => {
  it("returns false for a fresh snake (head does not overlap body)", () => {
    const snake = [
      { x: 5, y: 5 },
      { x: 4, y: 5 },
      { x: 3, y: 5 },
    ];
    expect(checkSelfCollision(snake)).toBe(false);
  });

  it("returns true when the head overlaps a body segment", () => {
    const snake = [
      { x: 5, y: 5 },
      { x: 5, y: 4 },
      { x: 4, y: 4 },
      { x: 4, y: 5 },
      { x: 5, y: 5 },
    ];
    expect(checkSelfCollision(snake)).toBe(true);
  });

  it("returns false for a single-segment snake", () => {
    const snake = [{ x: 5, y: 5 }];
    expect(checkSelfCollision(snake)).toBe(false);
  });
});

describe("checkFoodCollision", () => {
  it("returns true when head and food share the same coordinates", () => {
    expect(checkFoodCollision({ x: 5, y: 5 }, { x: 5, y: 5 })).toBe(true);
  });

  it("returns true at the origin (0, 0)", () => {
    expect(checkFoodCollision({ x: 0, y: 0 }, { x: 0, y: 0 })).toBe(true);
  });

  it("returns false when x coordinates differ", () => {
    expect(checkFoodCollision({ x: 5, y: 5 }, { x: 6, y: 5 })).toBe(false);
  });

  it("returns false when y coordinates differ", () => {
    expect(checkFoodCollision({ x: 5, y: 5 }, { x: 5, y: 6 })).toBe(false);
  });

  it("returns false when both coordinates differ", () => {
    expect(checkFoodCollision({ x: 5, y: 5 }, { x: 7, y: 8 })).toBe(false);
  });
});

describe("spawnFood", () => {
  it("returns coordinates inside the grid", () => {
    // Snake at (0,0) only; random=0.5 yields (2,2) on a 5x5 grid — no collision.
    const snake = [{ x: 0, y: 0 }];
    const food = spawnFood(5, snake, () => 0.5);
    expect(food.x).toBeGreaterThanOrEqual(0);
    expect(food.x).toBeLessThan(5);
    expect(food.y).toBeGreaterThanOrEqual(0);
    expect(food.y).toBeLessThan(5);
  });

  it("returns the random-derived position when it does not collide", () => {
    // random=0.0 → (0, 0); snake does not occupy (0, 0), so first try wins.
    const snake = [
      { x: 2, y: 2 },
      { x: 1, y: 2 },
      { x: 0, y: 2 },
    ];
    const food = spawnFood(5, snake, () => 0.0);
    expect(food).toEqual({ x: 0, y: 0 });
  });

  it("retries when the first candidate collides with the snake", () => {
    // First pair (0.4, 0.4) → (2, 2) which IS the snake head → retry.
    // Second pair (0.0, 0.0) → (0, 0) which is NOT on the snake → return.
    const snake = [
      { x: 2, y: 2 },
      { x: 1, y: 2 },
      { x: 0, y: 2 },
    ];
    const seq = [0.4, 0.4, 0.0, 0.0];
    let i = 0;
    const food = spawnFood(5, snake, () => seq[i++] ?? 0);
    expect(food).toEqual({ x: 0, y: 0 });
    expect(snake.some((s) => s.x === food.x && s.y === food.y)).toBe(false);
  });

  it("never returns a position occupied by the snake (multi-retry sequence)", () => {
    // Three colliding picks then a clear one. Sequence is intentionally bounded.
    const snake = [
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 3, y: 1 },
    ];
    // (0.25,0.25)→(1,1) collide; (0.5,0.25)→(2,1) collide; (0.75,0.25)→(3,1) collide;
    // (0.0,0.75)→(0,3) clear.
    const seq = [0.25, 0.25, 0.5, 0.25, 0.75, 0.25, 0.0, 0.75];
    let i = 0;
    const food = spawnFood(4, snake, () => seq[i++] ?? 0);
    expect(food).toEqual({ x: 0, y: 3 });
    expect(snake.some((s) => s.x === food.x && s.y === food.y)).toBe(false);
  });
});

describe("getNewDirection", () => {
  it("returns the input direction when it is perpendicular to current", () => {
    expect(getNewDirection("right", "up")).toBe("up");
    expect(getNewDirection("right", "down")).toBe("down");
    expect(getNewDirection("up", "left")).toBe("left");
    expect(getNewDirection("up", "right")).toBe("right");
  });

  it("ignores a 180-degree reversal and keeps the current direction", () => {
    expect(getNewDirection("right", "left")).toBe("right");
    expect(getNewDirection("left", "right")).toBe("left");
    expect(getNewDirection("up", "down")).toBe("up");
    expect(getNewDirection("down", "up")).toBe("down");
  });

  it("keeps the current direction when input matches it", () => {
    expect(getNewDirection("right", "right")).toBe("right");
    expect(getNewDirection("up", "up")).toBe("up");
  });

  it("keeps the current direction for unknown input", () => {
    expect(getNewDirection("right", "diagonal")).toBe("right");
    expect(getNewDirection("up", "")).toBe("up");
  });
});

describe("isGameOver", () => {
  const gridSize = 20;

  it("returns false for a fresh snake inside the grid", () => {
    const snake = [
      { x: 10, y: 10 },
      { x: 9, y: 10 },
      { x: 8, y: 10 },
    ];
    expect(isGameOver(snake, gridSize)).toBe(false);
  });

  it("returns true when the head is past the right wall", () => {
    const snake = [
      { x: 20, y: 10 },
      { x: 19, y: 10 },
      { x: 18, y: 10 },
    ];
    expect(isGameOver(snake, gridSize)).toBe(true);
  });

  it("returns true when the head is past the left wall", () => {
    const snake = [
      { x: -1, y: 10 },
      { x: 0, y: 10 },
      { x: 1, y: 10 },
    ];
    expect(isGameOver(snake, gridSize)).toBe(true);
  });

  it("returns true when the head is past the top wall", () => {
    const snake = [
      { x: 10, y: -1 },
      { x: 10, y: 0 },
      { x: 10, y: 1 },
    ];
    expect(isGameOver(snake, gridSize)).toBe(true);
  });

  it("returns true when the head is past the bottom wall", () => {
    const snake = [
      { x: 10, y: 20 },
      { x: 10, y: 19 },
      { x: 10, y: 18 },
    ];
    expect(isGameOver(snake, gridSize)).toBe(true);
  });

  it("returns true when the head overlaps a body segment", () => {
    const snake = [
      { x: 5, y: 5 },
      { x: 5, y: 4 },
      { x: 4, y: 4 },
      { x: 4, y: 5 },
      { x: 5, y: 5 },
    ];
    expect(isGameOver(snake, gridSize)).toBe(true);
  });

  it("returns false for a single-segment snake inside the grid", () => {
    expect(isGameOver([{ x: 5, y: 5 }], gridSize)).toBe(false);
  });

  it("returns false for an empty snake (defensive)", () => {
    expect(isGameOver([], gridSize)).toBe(false);
  });
});
