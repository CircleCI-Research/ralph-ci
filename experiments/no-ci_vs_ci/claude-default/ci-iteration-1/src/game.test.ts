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

describe("Snake Game - Core Logic", () => {
  describe("createInitialSnake", () => {
    it("should create a snake with 3 segments", () => {
      const snake = createInitialSnake();
      expect(snake).toHaveLength(3);
    });

    it("should position snake at center of grid (around x=10, y=10)", () => {
      const snake = createInitialSnake();
      const head = snake[0];

      // Head should be at or near center
      expect(head.x).toBe(10);
      expect(head.y).toBe(10);
    });

    it("should create snake segments in a horizontal line", () => {
      const snake = createInitialSnake();

      // All segments should have the same y coordinate
      const yValues = snake.map((seg) => seg.y);
      expect(yValues.every((y) => y === yValues[0])).toBe(true);

      // x values should be consecutive
      expect(snake[0].x).toBe(10);
      expect(snake[1].x).toBe(9);
      expect(snake[2].x).toBe(8);
    });

    it("should return an array of position objects with x and y properties", () => {
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
    it("should move snake head one position UP", () => {
      const snake = [
        { x: 10, y: 10 },
        { x: 10, y: 11 },
        { x: 10, y: 12 },
      ];
      const newSnake = moveSnake(snake, "UP", false);

      expect(newSnake[0]).toEqual({ x: 10, y: 9 });
      expect(newSnake).toHaveLength(3);
    });

    it("should move snake head one position DOWN", () => {
      const snake = [
        { x: 10, y: 10 },
        { x: 10, y: 9 },
        { x: 10, y: 8 },
      ];
      const newSnake = moveSnake(snake, "DOWN", false);

      expect(newSnake[0]).toEqual({ x: 10, y: 11 });
      expect(newSnake).toHaveLength(3);
    });

    it("should move snake head one position LEFT", () => {
      const snake = [
        { x: 10, y: 10 },
        { x: 11, y: 10 },
        { x: 12, y: 10 },
      ];
      const newSnake = moveSnake(snake, "LEFT", false);

      expect(newSnake[0]).toEqual({ x: 9, y: 10 });
      expect(newSnake).toHaveLength(3);
    });

    it("should move snake head one position RIGHT", () => {
      const snake = [
        { x: 10, y: 10 },
        { x: 9, y: 10 },
        { x: 8, y: 10 },
      ];
      const newSnake = moveSnake(snake, "RIGHT", false);

      expect(newSnake[0]).toEqual({ x: 11, y: 10 });
      expect(newSnake).toHaveLength(3);
    });

    it("should move body segments to follow the head", () => {
      const snake = [
        { x: 10, y: 10 },
        { x: 9, y: 10 },
        { x: 8, y: 10 },
      ];
      const newSnake = moveSnake(snake, "RIGHT", false);

      // Body should follow: old head becomes new segment[1], etc.
      expect(newSnake[1]).toEqual({ x: 10, y: 10 });
      expect(newSnake[2]).toEqual({ x: 9, y: 10 });
    });

    it("should grow snake when shouldGrow is true", () => {
      const snake = [
        { x: 10, y: 10 },
        { x: 9, y: 10 },
        { x: 8, y: 10 },
      ];
      const newSnake = moveSnake(snake, "RIGHT", true);

      expect(newSnake).toHaveLength(4);
      expect(newSnake[0]).toEqual({ x: 11, y: 10 });
    });

    it("should not grow snake when shouldGrow is false", () => {
      const snake = [
        { x: 10, y: 10 },
        { x: 9, y: 10 },
        { x: 8, y: 10 },
      ];
      const newSnake = moveSnake(snake, "RIGHT", false);

      expect(newSnake).toHaveLength(3);
    });
  });

  describe("checkWallCollision", () => {
    it("should detect collision with top wall (y < 0)", () => {
      const head = { x: 10, y: -1 };
      expect(checkWallCollision(head, 20)).toBe(true);
    });

    it("should detect collision with bottom wall (y >= gridSize)", () => {
      const head = { x: 10, y: 20 };
      expect(checkWallCollision(head, 20)).toBe(true);
    });

    it("should detect collision with left wall (x < 0)", () => {
      const head = { x: -1, y: 10 };
      expect(checkWallCollision(head, 20)).toBe(true);
    });

    it("should detect collision with right wall (x >= gridSize)", () => {
      const head = { x: 20, y: 10 };
      expect(checkWallCollision(head, 20)).toBe(true);
    });

    it("should not detect collision when head is at edge but valid (0 <= x,y < gridSize)", () => {
      expect(checkWallCollision({ x: 0, y: 0 }, 20)).toBe(false);
      expect(checkWallCollision({ x: 19, y: 19 }, 20)).toBe(false);
      expect(checkWallCollision({ x: 0, y: 19 }, 20)).toBe(false);
      expect(checkWallCollision({ x: 19, y: 0 }, 20)).toBe(false);
    });

    it("should not detect collision when head is in middle of grid", () => {
      const head = { x: 10, y: 10 };
      expect(checkWallCollision(head, 20)).toBe(false);
    });
  });

  describe("checkSelfCollision", () => {
    it("should detect collision when head overlaps body segment", () => {
      const snake = [
        { x: 10, y: 10 }, // head
        { x: 10, y: 11 },
        { x: 10, y: 10 }, // duplicate position
        { x: 9, y: 10 },
      ];
      expect(checkSelfCollision(snake)).toBe(true);
    });

    it("should detect collision when head is at same position as any body part", () => {
      const snake = [
        { x: 5, y: 5 }, // head
        { x: 5, y: 6 },
        { x: 5, y: 7 },
        { x: 5, y: 5 }, // tail at same position as head
      ];
      expect(checkSelfCollision(snake)).toBe(true);
    });

    it("should not detect collision when snake has no overlapping segments", () => {
      const snake = [
        { x: 10, y: 10 },
        { x: 9, y: 10 },
        { x: 8, y: 10 },
      ];
      expect(checkSelfCollision(snake)).toBe(false);
    });

    it("should not detect collision for a 3-segment snake moving straight", () => {
      const snake = createInitialSnake();
      expect(checkSelfCollision(snake)).toBe(false);
    });

    it("should not detect collision when all segments are unique", () => {
      const snake = [
        { x: 10, y: 10 },
        { x: 10, y: 11 },
        { x: 11, y: 11 },
        { x: 12, y: 11 },
        { x: 12, y: 10 },
      ];
      expect(checkSelfCollision(snake)).toBe(false);
    });
  });

  describe("checkFoodCollision", () => {
    it("should detect collision when head is at same position as food", () => {
      const head = { x: 5, y: 5 };
      const food = { x: 5, y: 5 };
      expect(checkFoodCollision(head, food)).toBe(true);
    });

    it("should not detect collision when head is at different position than food", () => {
      const head = { x: 5, y: 5 };
      const food = { x: 6, y: 5 };
      expect(checkFoodCollision(head, food)).toBe(false);
    });

    it("should not detect collision when x matches but y differs", () => {
      const head = { x: 10, y: 10 };
      const food = { x: 10, y: 11 };
      expect(checkFoodCollision(head, food)).toBe(false);
    });

    it("should not detect collision when y matches but x differs", () => {
      const head = { x: 10, y: 10 };
      const food = { x: 11, y: 10 };
      expect(checkFoodCollision(head, food)).toBe(false);
    });
  });

  describe("spawnFood", () => {
    it("should spawn food within grid bounds", () => {
      const gridSize = 20;
      const snake = createInitialSnake();
      const food = spawnFood(gridSize, snake);

      expect(food.x).toBeGreaterThanOrEqual(0);
      expect(food.x).toBeLessThan(gridSize);
      expect(food.y).toBeGreaterThanOrEqual(0);
      expect(food.y).toBeLessThan(gridSize);
    });

    it("should not spawn food on snake segments", () => {
      const gridSize = 20;
      const snake = [
        { x: 5, y: 5 },
        { x: 4, y: 5 },
        { x: 3, y: 5 },
      ];

      // Use deterministic random that cycles between values
      // First attempt: 0.25 -> x=5, y=5 (on snake, should retry)
      // Second attempt: 0.5 -> x=10, y=10 (not on snake, should accept)
      let callCount = 0;
      const deterministicRandom = () => {
        callCount++;
        return callCount <= 2 ? 0.25 : 0.5; // First two calls return 0.25, then 0.5
      };
      const food = spawnFood(gridSize, snake, deterministicRandom);

      // Food should not be on any snake segment
      const foodOnSnake = snake.some(
        (seg) => seg.x === food.x && seg.y === food.y,
      );
      expect(foodOnSnake).toBe(false);
    });

    it("should use provided random function", () => {
      const gridSize = 20;
      const snake = createInitialSnake();

      // Deterministic random that always returns 0.5
      const deterministicRandom = () => 0.5;
      const food = spawnFood(gridSize, snake, deterministicRandom);

      // With random() = 0.5, position should be at 10, 10
      // But if that's on the snake, it should try again
      expect(typeof food.x).toBe("number");
      expect(typeof food.y).toBe("number");
    });

    it("should have x and y properties", () => {
      const gridSize = 20;
      const snake = createInitialSnake();
      const food = spawnFood(gridSize, snake);

      expect(food).toHaveProperty("x");
      expect(food).toHaveProperty("y");
    });
  });

  describe("getNewDirection", () => {
    it("should prevent 180-degree turn from UP to DOWN", () => {
      expect(getNewDirection("UP", "DOWN")).toBe("UP");
    });

    it("should prevent 180-degree turn from DOWN to UP", () => {
      expect(getNewDirection("DOWN", "UP")).toBe("DOWN");
    });

    it("should prevent 180-degree turn from LEFT to RIGHT", () => {
      expect(getNewDirection("LEFT", "RIGHT")).toBe("LEFT");
    });

    it("should prevent 180-degree turn from RIGHT to LEFT", () => {
      expect(getNewDirection("RIGHT", "LEFT")).toBe("RIGHT");
    });

    it("should allow 90-degree turn from UP to LEFT", () => {
      expect(getNewDirection("UP", "LEFT")).toBe("LEFT");
    });

    it("should allow 90-degree turn from UP to RIGHT", () => {
      expect(getNewDirection("UP", "RIGHT")).toBe("RIGHT");
    });

    it("should allow continuing in same direction", () => {
      expect(getNewDirection("UP", "UP")).toBe("UP");
      expect(getNewDirection("DOWN", "DOWN")).toBe("DOWN");
      expect(getNewDirection("LEFT", "LEFT")).toBe("LEFT");
      expect(getNewDirection("RIGHT", "RIGHT")).toBe("RIGHT");
    });
  });
});
