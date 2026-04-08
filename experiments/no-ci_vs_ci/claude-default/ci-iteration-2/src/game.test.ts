import { describe, it, expect } from "vitest";
import {
  createInitialSnake,
  moveSnake,
  checkWallCollision,
  checkSelfCollision,
  getNewDirection,
  checkFoodCollision,
  spawnFood,
} from "./game.js";

describe("Snake Game - Core Logic", () => {
  describe("createInitialSnake", () => {
    it("should create a snake with 3 segments", () => {
      const snake = createInitialSnake();
      expect(snake).toHaveLength(3);
    });

    it("should position snake at center of grid (x:10, y:10)", () => {
      const snake = createInitialSnake();
      expect(snake[0]).toEqual({ x: 10, y: 10 }); // Head
      expect(snake[1]).toEqual({ x: 9, y: 10 }); // Body
      expect(snake[2]).toEqual({ x: 8, y: 10 }); // Tail
    });

    it("should create snake segments as objects with x and y coordinates", () => {
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
    it("should move snake head one unit in the given direction", () => {
      const snake = [
        { x: 10, y: 10 },
        { x: 9, y: 10 },
        { x: 8, y: 10 },
      ];
      const direction = { x: 1, y: 0 }; // Moving right

      const newSnake = moveSnake(snake, direction);

      expect(newSnake[0]).toEqual({ x: 11, y: 10 }); // Head moved right
    });

    it("should remove tail segment when moving (no growth)", () => {
      const snake = [
        { x: 10, y: 10 },
        { x: 9, y: 10 },
        { x: 8, y: 10 },
      ];
      const direction = { x: 0, y: 1 }; // Moving down

      const newSnake = moveSnake(snake, direction);

      expect(newSnake).toHaveLength(3); // Same length
      expect(newSnake[0]).toEqual({ x: 10, y: 11 }); // Head moved down
      expect(newSnake[1]).toEqual({ x: 10, y: 10 }); // Body is old head
      expect(newSnake[2]).toEqual({ x: 9, y: 10 }); // Tail is old body
    });

    it("should handle moving up (negative y direction)", () => {
      const snake = [
        { x: 10, y: 10 },
        { x: 10, y: 11 },
      ];
      const direction = { x: 0, y: -1 }; // Moving up

      const newSnake = moveSnake(snake, direction);

      expect(newSnake[0]).toEqual({ x: 10, y: 9 }); // Head moved up
    });

    it("should handle moving left (negative x direction)", () => {
      const snake = [
        { x: 10, y: 10 },
        { x: 11, y: 10 },
      ];
      const direction = { x: -1, y: 0 }; // Moving left

      const newSnake = moveSnake(snake, direction);

      expect(newSnake[0]).toEqual({ x: 9, y: 10 }); // Head moved left
    });

    it("should not mutate the original snake array", () => {
      const snake = [
        { x: 10, y: 10 },
        { x: 9, y: 10 },
      ];
      const direction = { x: 1, y: 0 };

      moveSnake(snake, direction);

      // Original should be unchanged
      expect(snake[0]).toEqual({ x: 10, y: 10 });
    });
  });

  describe("checkWallCollision", () => {
    it("should detect collision with left wall (x < 0)", () => {
      const head = { x: -1, y: 10 };
      expect(checkWallCollision(head, 20)).toBe(true);
    });

    it("should detect collision with right wall (x >= gridSize)", () => {
      const head = { x: 20, y: 10 };
      expect(checkWallCollision(head, 20)).toBe(true);
    });

    it("should detect collision with top wall (y < 0)", () => {
      const head = { x: 10, y: -1 };
      expect(checkWallCollision(head, 20)).toBe(true);
    });

    it("should detect collision with bottom wall (y >= gridSize)", () => {
      const head = { x: 10, y: 20 };
      expect(checkWallCollision(head, 20)).toBe(true);
    });

    it("should return false when head is within bounds", () => {
      const head = { x: 10, y: 10 };
      expect(checkWallCollision(head, 20)).toBe(false);
    });

    it("should return false for edge positions (0 to gridSize-1)", () => {
      expect(checkWallCollision({ x: 0, y: 0 }, 20)).toBe(false);
      expect(checkWallCollision({ x: 19, y: 19 }, 20)).toBe(false);
      expect(checkWallCollision({ x: 0, y: 19 }, 20)).toBe(false);
      expect(checkWallCollision({ x: 19, y: 0 }, 20)).toBe(false);
    });
  });

  describe("checkSelfCollision", () => {
    it("should detect collision when head overlaps with body segment", () => {
      const snake = [
        { x: 10, y: 10 }, // Head
        { x: 9, y: 10 },
        { x: 9, y: 11 },
        { x: 10, y: 11 },
        { x: 10, y: 10 }, // Collision with head!
      ];
      expect(checkSelfCollision(snake)).toBe(true);
    });

    it("should return false when snake has no self-collision", () => {
      const snake = [
        { x: 10, y: 10 },
        { x: 9, y: 10 },
        { x: 8, y: 10 },
      ];
      expect(checkSelfCollision(snake)).toBe(false);
    });

    it("should return false for minimal snake (length 1)", () => {
      const snake = [{ x: 10, y: 10 }];
      expect(checkSelfCollision(snake)).toBe(false);
    });

    it("should return false for snake with length 2", () => {
      const snake = [
        { x: 10, y: 10 },
        { x: 9, y: 10 },
      ];
      expect(checkSelfCollision(snake)).toBe(false);
    });

    it("should detect collision in middle of body", () => {
      const snake = [
        { x: 5, y: 5 }, // Head
        { x: 4, y: 5 },
        { x: 3, y: 5 },
        { x: 5, y: 5 }, // Collision
        { x: 6, y: 5 },
      ];
      expect(checkSelfCollision(snake)).toBe(true);
    });
  });

  describe("getNewDirection", () => {
    it("should prevent 180-degree turn from right to left", () => {
      const current = { x: 1, y: 0 }; // Moving right
      const input = { x: -1, y: 0 }; // Try to move left
      const result = getNewDirection(current, input);
      expect(result).toEqual(current); // Should keep moving right
    });

    it("should prevent 180-degree turn from left to right", () => {
      const current = { x: -1, y: 0 }; // Moving left
      const input = { x: 1, y: 0 }; // Try to move right
      const result = getNewDirection(current, input);
      expect(result).toEqual(current); // Should keep moving left
    });

    it("should prevent 180-degree turn from up to down", () => {
      const current = { x: 0, y: -1 }; // Moving up
      const input = { x: 0, y: 1 }; // Try to move down
      const result = getNewDirection(current, input);
      expect(result).toEqual(current); // Should keep moving up
    });

    it("should prevent 180-degree turn from down to up", () => {
      const current = { x: 0, y: 1 }; // Moving down
      const input = { x: 0, y: -1 }; // Try to move up
      const result = getNewDirection(current, input);
      expect(result).toEqual(current); // Should keep moving down
    });

    it("should allow 90-degree turn from right to down", () => {
      const current = { x: 1, y: 0 }; // Moving right
      const input = { x: 0, y: 1 }; // Turn down
      const result = getNewDirection(current, input);
      expect(result).toEqual(input); // Should allow turn
    });

    it("should allow 90-degree turn from down to left", () => {
      const current = { x: 0, y: 1 }; // Moving down
      const input = { x: -1, y: 0 }; // Turn left
      const result = getNewDirection(current, input);
      expect(result).toEqual(input); // Should allow turn
    });

    it("should keep current direction when input is same", () => {
      const current = { x: 1, y: 0 }; // Moving right
      const input = { x: 1, y: 0 }; // Keep moving right
      const result = getNewDirection(current, input);
      expect(result).toEqual(input);
    });
  });

  describe("checkFoodCollision", () => {
    it("should detect collision when head is at food position", () => {
      const head = { x: 5, y: 10 };
      const food = { x: 5, y: 10 };
      expect(checkFoodCollision(head, food)).toBe(true);
    });

    it("should return false when head is not at food position", () => {
      const head = { x: 5, y: 10 };
      const food = { x: 6, y: 10 };
      expect(checkFoodCollision(head, food)).toBe(false);
    });

    it("should return false when x matches but y differs", () => {
      const head = { x: 10, y: 10 };
      const food = { x: 10, y: 11 };
      expect(checkFoodCollision(head, food)).toBe(false);
    });

    it("should return false when y matches but x differs", () => {
      const head = { x: 10, y: 10 };
      const food = { x: 11, y: 10 };
      expect(checkFoodCollision(head, food)).toBe(false);
    });
  });

  describe("spawnFood", () => {
    it("should return a position within grid bounds", () => {
      const gridSize = 20;
      const snake = [{ x: 10, y: 10 }];
      const deterministicRandom = () => 0.5;

      const food = spawnFood(gridSize, snake, deterministicRandom);

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

      // Test multiple spawns to ensure food never spawns on snake
      for (let i = 0; i < 10; i++) {
        const food = spawnFood(gridSize, snake, Math.random);
        const isOnSnake = snake.some(
          (segment) => segment.x === food.x && segment.y === food.y,
        );
        expect(isOnSnake).toBe(false);
      }
    });

    it("should use provided random function for deterministic testing", () => {
      const gridSize = 20;
      const snake = [{ x: 10, y: 10 }];

      // Mock random that returns 0.5 for both x and y
      let callCount = 0;
      const deterministicRandom = () => {
        callCount++;
        return 0.5;
      };

      const food = spawnFood(gridSize, snake, deterministicRandom);

      expect(callCount).toBeGreaterThan(0); // Random was called
      expect(food.x).toBeGreaterThanOrEqual(0);
      expect(food.x).toBeLessThan(gridSize);
    });

    it("should return a food object with x and y properties", () => {
      const gridSize = 20;
      const snake = [{ x: 10, y: 10 }];

      const food = spawnFood(gridSize, snake, Math.random);

      expect(food).toHaveProperty("x");
      expect(food).toHaveProperty("y");
      expect(typeof food.x).toBe("number");
      expect(typeof food.y).toBe("number");
    });
  });
});
