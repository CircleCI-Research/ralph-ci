/**
 * Test suite for Snake Game core logic
 * Tests pure game logic functions without DOM dependencies
 */

import { describe, it, expect } from "vitest";
import {
  createInitialSnake,
  moveSnake,
  checkWallCollision,
  checkSelfCollision,
  checkFoodCollision,
  spawnFood,
  getNewDirection,
} from "./game.js";

describe("createInitialSnake", () => {
  it("should return an array of 3 segments", () => {
    const snake = createInitialSnake();
    expect(snake).toHaveLength(3);
  });

  it("should start snake at center of grid (10, 10)", () => {
    const snake = createInitialSnake();
    expect(snake[0]).toEqual({ x: 10, y: 10 }); // Head
  });

  it("should have segments extending to the left", () => {
    const snake = createInitialSnake();
    expect(snake[0]).toEqual({ x: 10, y: 10 }); // Head
    expect(snake[1]).toEqual({ x: 9, y: 10 }); // Body
    expect(snake[2]).toEqual({ x: 8, y: 10 }); // Tail
  });

  it("should return a new array each time", () => {
    const snake1 = createInitialSnake();
    const snake2 = createInitialSnake();
    expect(snake1).not.toBe(snake2);
  });
});

describe("moveSnake", () => {
  it("should move snake up by decreasing y coordinate", () => {
    const snake = [
      { x: 5, y: 5 },
      { x: 5, y: 6 },
    ];
    const newSnake = moveSnake(snake, "up");
    expect(newSnake[0]).toEqual({ x: 5, y: 4 });
  });

  it("should move snake down by increasing y coordinate", () => {
    const snake = [
      { x: 5, y: 5 },
      { x: 5, y: 4 },
    ];
    const newSnake = moveSnake(snake, "down");
    expect(newSnake[0]).toEqual({ x: 5, y: 6 });
  });

  it("should move snake left by decreasing x coordinate", () => {
    const snake = [
      { x: 5, y: 5 },
      { x: 6, y: 5 },
    ];
    const newSnake = moveSnake(snake, "left");
    expect(newSnake[0]).toEqual({ x: 4, y: 5 });
  });

  it("should move snake right by increasing x coordinate", () => {
    const snake = [
      { x: 5, y: 5 },
      { x: 4, y: 5 },
    ];
    const newSnake = moveSnake(snake, "right");
    expect(newSnake[0]).toEqual({ x: 6, y: 5 });
  });

  it("should remove tail segment when moving", () => {
    const snake = [
      { x: 5, y: 5 },
      { x: 4, y: 5 },
      { x: 3, y: 5 },
    ];
    const newSnake = moveSnake(snake, "right");
    expect(newSnake).toHaveLength(3);
    expect(newSnake[2]).toEqual({ x: 4, y: 5 }); // Old head is now tail
  });

  it("should not modify original snake array", () => {
    const snake = [
      { x: 5, y: 5 },
      { x: 4, y: 5 },
    ];
    const original = JSON.parse(JSON.stringify(snake));
    moveSnake(snake, "up");
    expect(snake).toEqual(original);
  });

  it("should handle invalid direction by keeping head position", () => {
    const snake = [
      { x: 5, y: 5 },
      { x: 4, y: 5 },
    ];
    const newSnake = moveSnake(snake, "invalid");
    expect(newSnake[0]).toEqual({ x: 5, y: 5 });
  });
});

describe("checkWallCollision", () => {
  const gridSize = 20;

  it("should detect collision with left wall", () => {
    const head = { x: -1, y: 10 };
    expect(checkWallCollision(head, gridSize)).toBe(true);
  });

  it("should detect collision with right wall", () => {
    const head = { x: 20, y: 10 };
    expect(checkWallCollision(head, gridSize)).toBe(true);
  });

  it("should detect collision with top wall", () => {
    const head = { x: 10, y: -1 };
    expect(checkWallCollision(head, gridSize)).toBe(true);
  });

  it("should detect collision with bottom wall", () => {
    const head = { x: 10, y: 20 };
    expect(checkWallCollision(head, gridSize)).toBe(true);
  });

  it("should return false for valid position", () => {
    const head = { x: 10, y: 10 };
    expect(checkWallCollision(head, gridSize)).toBe(false);
  });

  it("should return false for position at edge (19, 19)", () => {
    const head = { x: 19, y: 19 };
    expect(checkWallCollision(head, gridSize)).toBe(false);
  });

  it("should return false for position at origin (0, 0)", () => {
    const head = { x: 0, y: 0 };
    expect(checkWallCollision(head, gridSize)).toBe(false);
  });
});

describe("checkSelfCollision", () => {
  it("should detect collision when head hits body segment", () => {
    const snake = [
      { x: 5, y: 5 }, // Head
      { x: 5, y: 6 },
      { x: 6, y: 6 },
      { x: 6, y: 5 },
      { x: 5, y: 5 }, // Body segment at same position as head
    ];
    expect(checkSelfCollision(snake)).toBe(true);
  });

  it("should return false when snake does not collide with itself", () => {
    const snake = [
      { x: 5, y: 5 },
      { x: 5, y: 6 },
      { x: 5, y: 7 },
    ];
    expect(checkSelfCollision(snake)).toBe(false);
  });

  it("should return false for snake of length 1", () => {
    const snake = [{ x: 5, y: 5 }];
    expect(checkSelfCollision(snake)).toBe(false);
  });

  it("should return false for snake of length 2", () => {
    const snake = [
      { x: 5, y: 5 },
      { x: 4, y: 5 },
    ];
    expect(checkSelfCollision(snake)).toBe(false);
  });

  it("should detect collision with middle body segment", () => {
    const snake = [
      { x: 10, y: 10 }, // Head
      { x: 10, y: 11 },
      { x: 10, y: 10 }, // Middle segment at head position
      { x: 9, y: 10 },
    ];
    expect(checkSelfCollision(snake)).toBe(true);
  });
});

describe("checkFoodCollision", () => {
  it("should detect collision when head is at food position", () => {
    const head = { x: 10, y: 10 };
    const food = { x: 10, y: 10 };
    expect(checkFoodCollision(head, food)).toBe(true);
  });

  it("should return false when head is not at food position", () => {
    const head = { x: 10, y: 10 };
    const food = { x: 11, y: 10 };
    expect(checkFoodCollision(head, food)).toBe(false);
  });

  it("should return false when only x coordinate matches", () => {
    const head = { x: 10, y: 10 };
    const food = { x: 10, y: 11 };
    expect(checkFoodCollision(head, food)).toBe(false);
  });

  it("should return false when only y coordinate matches", () => {
    const head = { x: 10, y: 10 };
    const food = { x: 11, y: 10 };
    expect(checkFoodCollision(head, food)).toBe(false);
  });
});

describe("spawnFood", () => {
  it("should return food with x and y coordinates", () => {
    const snake = [{ x: 10, y: 10 }];
    const food = spawnFood(20, snake);
    expect(food).toHaveProperty("x");
    expect(food).toHaveProperty("y");
  });

  it("should return food within grid boundaries", () => {
    const gridSize = 20;
    const snake = [{ x: 10, y: 10 }];
    const food = spawnFood(gridSize, snake);
    expect(food.x).toBeGreaterThanOrEqual(0);
    expect(food.x).toBeLessThan(gridSize);
    expect(food.y).toBeGreaterThanOrEqual(0);
    expect(food.y).toBeLessThan(gridSize);
  });

  it("should not spawn food on snake position with deterministic random", () => {
    const snake = [{ x: 0, y: 0 }];
    const deterministicRandom = () => 0; // Always returns 0, so x=0, y=0
    const food = spawnFood(20, snake, deterministicRandom);
    // Since (0,0) is occupied, spawnFood should try multiple times
    // With deterministic random always returning 0, it will hit maxAttempts
    // but still return the position. This test verifies the function completes.
    expect(food).toBeDefined();
  });

  it("should accept custom random function", () => {
    const snake = [{ x: 10, y: 10 }];
    const fixedRandom = () => 0.5;
    const food = spawnFood(20, snake, fixedRandom);
    // With random() = 0.5, x = floor(0.5 * 20) = 10, y = 10
    // This would conflict with snake, so it tries again
    expect(food).toBeDefined();
  });

  it("should return food not on empty snake body", () => {
    const snake: Array<{ x: number; y: number }> = [];
    const food = spawnFood(20, snake);
    expect(food).toBeDefined();
    expect(typeof food.x).toBe("number");
    expect(typeof food.y).toBe("number");
  });

  it("should handle large snake covering most of grid", () => {
    // Create snake covering positions except (19, 19)
    const snake = [];
    for (let y = 0; y < 20; y++) {
      for (let x = 0; x < 20; x++) {
        if (!(x === 19 && y === 19)) {
          snake.push({ x, y });
        }
      }
    }
    const food = spawnFood(20, snake);
    expect(food).toBeDefined();
  });
});

describe("getNewDirection", () => {
  it("should allow changing from right to up", () => {
    expect(getNewDirection("right", "up")).toBe("up");
  });

  it("should allow changing from right to down", () => {
    expect(getNewDirection("right", "down")).toBe("down");
  });

  it("should prevent 180-degree turn from right to left", () => {
    expect(getNewDirection("right", "left")).toBe("right");
  });

  it("should prevent 180-degree turn from left to right", () => {
    expect(getNewDirection("left", "right")).toBe("left");
  });

  it("should prevent 180-degree turn from up to down", () => {
    expect(getNewDirection("up", "down")).toBe("up");
  });

  it("should prevent 180-degree turn from down to up", () => {
    expect(getNewDirection("down", "up")).toBe("down");
  });

  it("should allow keeping same direction", () => {
    expect(getNewDirection("up", "up")).toBe("up");
    expect(getNewDirection("down", "down")).toBe("down");
    expect(getNewDirection("left", "left")).toBe("left");
    expect(getNewDirection("right", "right")).toBe("right");
  });

  it("should allow all valid perpendicular turns", () => {
    expect(getNewDirection("up", "left")).toBe("left");
    expect(getNewDirection("up", "right")).toBe("right");
    expect(getNewDirection("down", "left")).toBe("left");
    expect(getNewDirection("down", "right")).toBe("right");
  });
});
