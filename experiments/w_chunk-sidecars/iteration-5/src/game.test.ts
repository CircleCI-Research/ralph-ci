import { describe, it, expect } from "vitest";
// @ts-expect-error - game.js is plain JS without type declarations
import {
  createInitialSnake,
  moveSnake,
  checkWallCollision,
  checkSelfCollision,
  checkFoodCollision,
  spawnFood,
  getNewDirection,
  GRID_SIZE,
} from "./game.js";

describe("createInitialSnake", () => {
  it("returns a snake of length 3", () => {
    const snake = createInitialSnake();
    expect(snake).toHaveLength(3);
  });

  it("places every segment inside the grid", () => {
    const snake = createInitialSnake();
    for (const segment of snake) {
      expect(segment.x).toBeGreaterThanOrEqual(0);
      expect(segment.x).toBeLessThan(GRID_SIZE);
      expect(segment.y).toBeGreaterThanOrEqual(0);
      expect(segment.y).toBeLessThan(GRID_SIZE);
    }
  });

  it("places segments in a horizontal line so the snake faces right", () => {
    const snake = createInitialSnake();
    const [head, ...rest] = snake;
    for (const segment of rest) {
      expect(segment.y).toBe(head.y);
      expect(segment.x).toBeLessThan(head.x);
    }
  });

  it("returns a fresh array each call so callers can mutate safely", () => {
    const first = createInitialSnake();
    const second = createInitialSnake();
    expect(first).not.toBe(second);
    expect(first).toEqual(second);
  });
});

describe("moveSnake", () => {
  it("moves the head one cell up when direction is 'up'", () => {
    const snake = [
      { x: 5, y: 5 },
      { x: 4, y: 5 },
      { x: 3, y: 5 },
    ];
    const result = moveSnake(snake, "up");
    expect(result[0]).toEqual({ x: 5, y: 4 });
  });

  it("moves the head one cell down when direction is 'down'", () => {
    const snake = [
      { x: 5, y: 5 },
      { x: 4, y: 5 },
    ];
    const result = moveSnake(snake, "down");
    expect(result[0]).toEqual({ x: 5, y: 6 });
  });

  it("moves the head one cell left when direction is 'left'", () => {
    const snake = [
      { x: 5, y: 5 },
      { x: 6, y: 5 },
    ];
    const result = moveSnake(snake, "left");
    expect(result[0]).toEqual({ x: 4, y: 5 });
  });

  it("moves the head one cell right when direction is 'right'", () => {
    const snake = [
      { x: 5, y: 5 },
      { x: 4, y: 5 },
    ];
    const result = moveSnake(snake, "right");
    expect(result[0]).toEqual({ x: 6, y: 5 });
  });

  it("preserves length and shifts the body forward (drops the tail)", () => {
    const snake = [
      { x: 5, y: 5 },
      { x: 4, y: 5 },
      { x: 3, y: 5 },
    ];
    const result = moveSnake(snake, "right");
    expect(result).toHaveLength(snake.length);
    // Old head becomes the second segment.
    expect(result[1]).toEqual({ x: 5, y: 5 });
    // The original tail (3, 5) is no longer present.
    expect(
      result.some((s: { x: number; y: number }) => s.x === 3 && s.y === 5),
    ).toBe(false);
  });

  it("does not mutate the input snake", () => {
    const snake = [
      { x: 5, y: 5 },
      { x: 4, y: 5 },
    ];
    const snapshot = JSON.parse(JSON.stringify(snake));
    moveSnake(snake, "right");
    expect(snake).toEqual(snapshot);
  });
});

describe("checkWallCollision", () => {
  it("returns false when the head is inside the grid", () => {
    expect(checkWallCollision({ x: 0, y: 0 }, GRID_SIZE)).toBe(false);
    expect(checkWallCollision({ x: 10, y: 10 }, GRID_SIZE)).toBe(false);
    expect(
      checkWallCollision({ x: GRID_SIZE - 1, y: GRID_SIZE - 1 }, GRID_SIZE),
    ).toBe(false);
  });

  it("returns true when the head crosses the left wall (x < 0)", () => {
    expect(checkWallCollision({ x: -1, y: 5 }, GRID_SIZE)).toBe(true);
  });

  it("returns true when the head crosses the top wall (y < 0)", () => {
    expect(checkWallCollision({ x: 5, y: -1 }, GRID_SIZE)).toBe(true);
  });

  it("returns true when the head crosses the right wall (x >= gridSize)", () => {
    expect(checkWallCollision({ x: GRID_SIZE, y: 5 }, GRID_SIZE)).toBe(true);
  });

  it("returns true when the head crosses the bottom wall (y >= gridSize)", () => {
    expect(checkWallCollision({ x: 5, y: GRID_SIZE }, GRID_SIZE)).toBe(true);
  });
});

describe("checkSelfCollision", () => {
  it("returns false for a snake whose head does not overlap any body segment", () => {
    const snake = [
      { x: 5, y: 5 },
      { x: 4, y: 5 },
      { x: 3, y: 5 },
    ];
    expect(checkSelfCollision(snake)).toBe(false);
  });

  it("returns true when the head overlaps a body segment", () => {
    // Snake doubles back on itself: head at (3,5) re-enters the segment at index 2.
    const snake = [
      { x: 3, y: 5 },
      { x: 4, y: 5 },
      { x: 3, y: 5 },
      { x: 2, y: 5 },
    ];
    expect(checkSelfCollision(snake)).toBe(true);
  });

  it("returns false for a single-segment snake (no body to collide with)", () => {
    expect(checkSelfCollision([{ x: 5, y: 5 }])).toBe(false);
  });
});

describe("checkFoodCollision", () => {
  it("returns true when the head sits on the food", () => {
    expect(checkFoodCollision({ x: 5, y: 5 }, { x: 5, y: 5 })).toBe(true);
    expect(checkFoodCollision({ x: 0, y: 0 }, { x: 0, y: 0 })).toBe(true);
  });

  it("returns false when only x matches but y differs", () => {
    expect(checkFoodCollision({ x: 5, y: 5 }, { x: 5, y: 6 })).toBe(false);
  });

  it("returns false when only y matches but x differs", () => {
    expect(checkFoodCollision({ x: 5, y: 5 }, { x: 6, y: 5 })).toBe(false);
  });

  it("returns false when neither coordinate matches", () => {
    expect(checkFoodCollision({ x: 5, y: 5 }, { x: 9, y: 1 })).toBe(false);
  });
});

describe("spawnFood", () => {
  it("returns a position inside the grid when the random draw is free", () => {
    // Math.floor(0.1 * 20) = 2 → (2, 2). createInitialSnake occupies
    // (10,10), (9,10), (8,10), so (2,2) is guaranteed free on attempt 1.
    const snake = createInitialSnake();
    const food = spawnFood(GRID_SIZE, snake, () => 0.1);
    expect(food).toEqual({ x: 2, y: 2 });
    expect(food.x).toBeGreaterThanOrEqual(0);
    expect(food.x).toBeLessThan(GRID_SIZE);
    expect(food.y).toBeGreaterThanOrEqual(0);
    expect(food.y).toBeLessThan(GRID_SIZE);
  });

  it("retries when the random position lands on the snake", () => {
    // Snake occupies a single cell at (2, 2).
    // Attempt 1: random=0.1,0.1 → (2,2) → on snake, retry.
    // Attempt 2: random=0.5,0.5 → (10,10) → free, return.
    const snake = [{ x: 2, y: 2 }];
    const seq = [0.1, 0.1, 0.5, 0.5];
    let i = 0;
    const food = spawnFood(GRID_SIZE, snake, () => seq[i++]);
    expect(food).toEqual({ x: 10, y: 10 });
  });

  it("never returns a position that overlaps the snake", () => {
    // Snake at (10,10), (9,10), (8,10). The first three random draws all
    // collide with the snake; the fourth draw lands on (7, 10), which is
    // free. Verifies the retry loop walks past multiple collisions.
    const snake = createInitialSnake();
    const seq = [0.5, 0.5, 0.45, 0.5, 0.4, 0.5, 0.35, 0.5];
    let i = 0;
    const food = spawnFood(GRID_SIZE, snake, () => seq[i++]);
    expect(food).toEqual({ x: 7, y: 10 });
    expect(
      snake.some(
        (s: { x: number; y: number }) => s.x === food.x && s.y === food.y,
      ),
    ).toBe(false);
  });
});

describe("getNewDirection", () => {
  it("returns the input direction when it is a legal 90-degree turn", () => {
    expect(getNewDirection("up", "left")).toBe("left");
    expect(getNewDirection("up", "right")).toBe("right");
    expect(getNewDirection("down", "left")).toBe("left");
    expect(getNewDirection("down", "right")).toBe("right");
    expect(getNewDirection("left", "up")).toBe("up");
    expect(getNewDirection("left", "down")).toBe("down");
    expect(getNewDirection("right", "up")).toBe("up");
    expect(getNewDirection("right", "down")).toBe("down");
  });

  it("returns the current direction on a 180-degree reversal attempt", () => {
    expect(getNewDirection("up", "down")).toBe("up");
    expect(getNewDirection("down", "up")).toBe("down");
    expect(getNewDirection("left", "right")).toBe("left");
    expect(getNewDirection("right", "left")).toBe("right");
  });

  it("returns the current direction when the input matches it", () => {
    expect(getNewDirection("up", "up")).toBe("up");
    expect(getNewDirection("right", "right")).toBe("right");
  });

  it("returns the current direction when the input is unknown", () => {
    expect(getNewDirection("up", "diagonal")).toBe("up");
    expect(getNewDirection("right", "")).toBe("right");
    expect(getNewDirection("left", null)).toBe("left");
    expect(getNewDirection("down", undefined)).toBe("down");
  });
});
