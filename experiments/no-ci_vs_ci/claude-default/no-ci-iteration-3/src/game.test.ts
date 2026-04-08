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
  it("should create a snake with 3 segments", () => {
    const snake = createInitialSnake();
    expect(snake).toHaveLength(3);
  });

  it("should position snake at center of grid facing right", () => {
    const snake = createInitialSnake();

    // Grid is 20x20, so center is at 10, 10
    expect(snake[0]).toEqual({ x: 10, y: 10 }); // Head
    expect(snake[1]).toEqual({ x: 9, y: 10 }); // Body
    expect(snake[2]).toEqual({ x: 8, y: 10 }); // Tail
  });

  it("should return an array of position objects", () => {
    const snake = createInitialSnake();

    snake.forEach((segment) => {
      expect(segment).toHaveProperty("x");
      expect(segment).toHaveProperty("y");
      expect(typeof segment.x).toBe("number");
      expect(typeof segment.y).toBe("number");
    });
  });
});

describe("moveSnake", () => {
  it("should move snake one cell in given direction", () => {
    const snake = [
      { x: 10, y: 10 },
      { x: 9, y: 10 },
      { x: 8, y: 10 },
    ];
    const direction = { dx: 1, dy: 0 }; // Moving right

    const newSnake = moveSnake(snake, direction);

    // Head should move one cell right
    expect(newSnake[0]).toEqual({ x: 11, y: 10 });
    // Body follows where head was
    expect(newSnake[1]).toEqual({ x: 10, y: 10 });
    expect(newSnake[2]).toEqual({ x: 9, y: 10 });
  });

  it("should move snake up when direction is up", () => {
    const snake = [
      { x: 10, y: 10 },
      { x: 10, y: 11 },
      { x: 10, y: 12 },
    ];
    const direction = { dx: 0, dy: -1 }; // Moving up

    const newSnake = moveSnake(snake, direction);

    expect(newSnake[0]).toEqual({ x: 10, y: 9 });
    expect(newSnake[1]).toEqual({ x: 10, y: 10 });
    expect(newSnake[2]).toEqual({ x: 10, y: 11 });
  });

  it("should not mutate the original snake array", () => {
    const snake = [
      { x: 10, y: 10 },
      { x: 9, y: 10 },
      { x: 8, y: 10 },
    ];
    const direction = { dx: 1, dy: 0 };
    const originalSnake = JSON.parse(JSON.stringify(snake));

    moveSnake(snake, direction);

    // Original snake should be unchanged
    expect(snake).toEqual(originalSnake);
  });
});

describe("checkWallCollision", () => {
  it("should return true when head hits left wall", () => {
    const head = { x: -1, y: 10 };
    const gridSize = 20;

    expect(checkWallCollision(head, gridSize)).toBe(true);
  });

  it("should return true when head hits right wall", () => {
    const head = { x: 20, y: 10 };
    const gridSize = 20;

    expect(checkWallCollision(head, gridSize)).toBe(true);
  });

  it("should return true when head hits top wall", () => {
    const head = { x: 10, y: -1 };
    const gridSize = 20;

    expect(checkWallCollision(head, gridSize)).toBe(true);
  });

  it("should return true when head hits bottom wall", () => {
    const head = { x: 10, y: 20 };
    const gridSize = 20;

    expect(checkWallCollision(head, gridSize)).toBe(true);
  });

  it("should return false when head is within bounds", () => {
    const head = { x: 10, y: 10 };
    const gridSize = 20;

    expect(checkWallCollision(head, gridSize)).toBe(false);
  });

  it("should return false at grid edges (0 to gridSize-1)", () => {
    const gridSize = 20;

    expect(checkWallCollision({ x: 0, y: 0 }, gridSize)).toBe(false);
    expect(checkWallCollision({ x: 19, y: 19 }, gridSize)).toBe(false);
    expect(checkWallCollision({ x: 0, y: 19 }, gridSize)).toBe(false);
    expect(checkWallCollision({ x: 19, y: 0 }, gridSize)).toBe(false);
  });
});

describe("checkSelfCollision", () => {
  it("should return true when head collides with body", () => {
    const snake = [
      { x: 10, y: 10 }, // Head
      { x: 9, y: 10 },
      { x: 9, y: 11 },
      { x: 10, y: 11 },
      { x: 10, y: 10 }, // Collides with head!
    ];

    expect(checkSelfCollision(snake)).toBe(true);
  });

  it("should return false when head does not collide with body", () => {
    const snake = [
      { x: 10, y: 10 },
      { x: 9, y: 10 },
      { x: 8, y: 10 },
    ];

    expect(checkSelfCollision(snake)).toBe(false);
  });

  it("should return false for a 3-segment snake (cannot self-collide)", () => {
    const snake = [
      { x: 10, y: 10 },
      { x: 9, y: 10 },
      { x: 8, y: 10 },
    ];

    expect(checkSelfCollision(snake)).toBe(false);
  });

  it("should return true when head position matches any body segment", () => {
    const snake = [
      { x: 5, y: 5 }, // Head
      { x: 4, y: 5 },
      { x: 4, y: 6 },
      { x: 5, y: 6 },
      { x: 5, y: 5 }, // Same as head
    ];

    expect(checkSelfCollision(snake)).toBe(true);
  });
});

describe("getNewDirection", () => {
  it("should prevent 180-degree turn from right to left", () => {
    const current = { dx: 1, dy: 0 }; // Moving right
    const input = { dx: -1, dy: 0 }; // Try to move left

    const result = getNewDirection(current, input);

    expect(result).toEqual(current); // Should stay moving right
  });

  it("should prevent 180-degree turn from up to down", () => {
    const current = { dx: 0, dy: -1 }; // Moving up
    const input = { dx: 0, dy: 1 }; // Try to move down

    const result = getNewDirection(current, input);

    expect(result).toEqual(current); // Should stay moving up
  });

  it("should allow 90-degree turn from right to up", () => {
    const current = { dx: 1, dy: 0 }; // Moving right
    const input = { dx: 0, dy: -1 }; // Turn up

    const result = getNewDirection(current, input);

    expect(result).toEqual(input); // Should turn up
  });

  it("should allow 90-degree turn from up to right", () => {
    const current = { dx: 0, dy: -1 }; // Moving up
    const input = { dx: 1, dy: 0 }; // Turn right

    const result = getNewDirection(current, input);

    expect(result).toEqual(input); // Should turn right
  });

  it("should allow continuing in same direction", () => {
    const current = { dx: 1, dy: 0 }; // Moving right
    const input = { dx: 1, dy: 0 }; // Keep moving right

    const result = getNewDirection(current, input);

    expect(result).toEqual(input);
  });
});

describe("checkFoodCollision", () => {
  it("should return true when head is at food position", () => {
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
    const head = { x: 5, y: 5 };
    const food = { x: 5, y: 6 };

    expect(checkFoodCollision(head, food)).toBe(false);
  });

  it("should return false when only y coordinate matches", () => {
    const head = { x: 5, y: 5 };
    const food = { x: 6, y: 5 };

    expect(checkFoodCollision(head, food)).toBe(false);
  });
});

describe("spawnFood", () => {
  it("should spawn food within grid bounds", () => {
    const gridSize = 20;
    const snake = [{ x: 10, y: 10 }];
    const mockRandom = () => 0.5; // Deterministic random

    const food = spawnFood(gridSize, snake, mockRandom);

    expect(food.x).toBeGreaterThanOrEqual(0);
    expect(food.x).toBeLessThan(gridSize);
    expect(food.y).toBeGreaterThanOrEqual(0);
    expect(food.y).toBeLessThan(gridSize);
  });

  it("should not spawn food on snake body", () => {
    const gridSize = 20;
    const snake = [
      { x: 10, y: 10 },
      { x: 9, y: 10 },
      { x: 8, y: 10 },
    ];

    // Use a deterministic sequence that will first try a snake position, then succeed
    let callCount = 0;
    const mockRandom = () => {
      // First two calls should try to place food at (10, 10) - on snake head
      // Next two calls should place food at (5, 5) - safe position
      if (callCount < 2) {
        callCount++;
        return 10 / gridSize; // Will produce x=10 or y=10
      }
      callCount++;
      return 5 / gridSize; // Will produce x=5 or y=5
    };

    const food = spawnFood(gridSize, snake, mockRandom);

    // Food should not be on any snake segment
    const isOnSnake = snake.some(
      (segment) => segment.x === food.x && segment.y === food.y,
    );
    expect(isOnSnake).toBe(false);
  });

  it("should return valid position object", () => {
    const gridSize = 20;
    const snake = [{ x: 10, y: 10 }];
    const mockRandom = () => 0.5;

    const food = spawnFood(gridSize, snake, mockRandom);

    expect(food).toHaveProperty("x");
    expect(food).toHaveProperty("y");
    expect(typeof food.x).toBe("number");
    expect(typeof food.y).toBe("number");
  });
});
