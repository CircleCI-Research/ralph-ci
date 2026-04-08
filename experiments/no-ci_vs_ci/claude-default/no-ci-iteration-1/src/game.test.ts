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

describe("Snake Game Logic", () => {
  describe("createInitialSnake", () => {
    it("should create a snake with 3 segments", () => {
      const snake = createInitialSnake();
      expect(snake).toHaveLength(3);
    });

    it("should have head at position (10, 10)", () => {
      const snake = createInitialSnake();
      expect(snake[0]).toEqual({ x: 10, y: 10 });
    });

    it("should have segments in a horizontal line", () => {
      const snake = createInitialSnake();
      expect(snake[0]).toEqual({ x: 10, y: 10 });
      expect(snake[1]).toEqual({ x: 9, y: 10 });
      expect(snake[2]).toEqual({ x: 8, y: 10 });
    });
  });

  describe("moveSnake", () => {
    it("should move snake right by one cell", () => {
      const snake = [
        { x: 10, y: 10 },
        { x: 9, y: 10 },
        { x: 8, y: 10 },
      ];
      const newSnake = moveSnake(snake, "RIGHT", false);
      expect(newSnake[0]).toEqual({ x: 11, y: 10 });
      expect(newSnake[1]).toEqual({ x: 10, y: 10 });
      expect(newSnake[2]).toEqual({ x: 9, y: 10 });
    });

    it("should move snake left by one cell", () => {
      const snake = [
        { x: 10, y: 10 },
        { x: 11, y: 10 },
        { x: 12, y: 10 },
      ];
      const newSnake = moveSnake(snake, "LEFT", false);
      expect(newSnake[0]).toEqual({ x: 9, y: 10 });
      expect(newSnake[1]).toEqual({ x: 10, y: 10 });
      expect(newSnake[2]).toEqual({ x: 11, y: 10 });
    });

    it("should move snake up by one cell", () => {
      const snake = [
        { x: 10, y: 10 },
        { x: 10, y: 11 },
        { x: 10, y: 12 },
      ];
      const newSnake = moveSnake(snake, "UP", false);
      expect(newSnake[0]).toEqual({ x: 10, y: 9 });
      expect(newSnake[1]).toEqual({ x: 10, y: 10 });
      expect(newSnake[2]).toEqual({ x: 10, y: 11 });
    });

    it("should move snake down by one cell", () => {
      const snake = [
        { x: 10, y: 10 },
        { x: 10, y: 9 },
        { x: 10, y: 8 },
      ];
      const newSnake = moveSnake(snake, "DOWN", false);
      expect(newSnake[0]).toEqual({ x: 10, y: 11 });
      expect(newSnake[1]).toEqual({ x: 10, y: 10 });
      expect(newSnake[2]).toEqual({ x: 10, y: 9 });
    });

    it("should grow snake when grow is true", () => {
      const snake = [
        { x: 10, y: 10 },
        { x: 9, y: 10 },
        { x: 8, y: 10 },
      ];
      const newSnake = moveSnake(snake, "RIGHT", true);
      expect(newSnake).toHaveLength(4);
      expect(newSnake[0]).toEqual({ x: 11, y: 10 });
      expect(newSnake[1]).toEqual({ x: 10, y: 10 });
      expect(newSnake[2]).toEqual({ x: 9, y: 10 });
      expect(newSnake[3]).toEqual({ x: 8, y: 10 });
    });

    it("should not modify the original snake array", () => {
      const snake = [
        { x: 10, y: 10 },
        { x: 9, y: 10 },
        { x: 8, y: 10 },
      ];
      const originalHead = { ...snake[0] };
      moveSnake(snake, "RIGHT", false);
      expect(snake[0]).toEqual(originalHead);
    });
  });

  describe("checkWallCollision", () => {
    it("should detect collision with left wall", () => {
      const head = { x: -1, y: 10 };
      expect(checkWallCollision(head, 20)).toBe(true);
    });

    it("should detect collision with right wall", () => {
      const head = { x: 20, y: 10 };
      expect(checkWallCollision(head, 20)).toBe(true);
    });

    it("should detect collision with top wall", () => {
      const head = { x: 10, y: -1 };
      expect(checkWallCollision(head, 20)).toBe(true);
    });

    it("should detect collision with bottom wall", () => {
      const head = { x: 10, y: 20 };
      expect(checkWallCollision(head, 20)).toBe(true);
    });

    it("should return false when no collision", () => {
      const head = { x: 10, y: 10 };
      expect(checkWallCollision(head, 20)).toBe(false);
    });

    it("should return false at boundary but not out of bounds", () => {
      const head = { x: 0, y: 0 };
      expect(checkWallCollision(head, 20)).toBe(false);
    });

    it("should return false at max valid position", () => {
      const head = { x: 19, y: 19 };
      expect(checkWallCollision(head, 20)).toBe(false);
    });
  });

  describe("checkSelfCollision", () => {
    it("should detect collision when head overlaps body", () => {
      const snake = [
        { x: 10, y: 10 },
        { x: 11, y: 10 },
        { x: 11, y: 11 },
        { x: 10, y: 11 },
        { x: 10, y: 10 }, // Same as head
      ];
      expect(checkSelfCollision(snake)).toBe(true);
    });

    it("should return false when no self-collision", () => {
      const snake = [
        { x: 10, y: 10 },
        { x: 9, y: 10 },
        { x: 8, y: 10 },
      ];
      expect(checkSelfCollision(snake)).toBe(false);
    });

    it("should return false for minimum snake length (1 segment)", () => {
      const snake = [{ x: 10, y: 10 }];
      expect(checkSelfCollision(snake)).toBe(false);
    });

    it("should detect collision in middle of body", () => {
      const snake = [
        { x: 10, y: 10 },
        { x: 11, y: 10 },
        { x: 12, y: 10 },
        { x: 11, y: 10 }, // Duplicates segment at index 1
      ];
      expect(checkSelfCollision(snake)).toBe(true);
    });
  });

  describe("checkFoodCollision", () => {
    it("should detect collision when head is at food position", () => {
      const head = { x: 15, y: 15 };
      const food = { x: 15, y: 15 };
      expect(checkFoodCollision(head, food)).toBe(true);
    });

    it("should return false when head is not at food position", () => {
      const head = { x: 10, y: 10 };
      const food = { x: 15, y: 15 };
      expect(checkFoodCollision(head, food)).toBe(false);
    });

    it("should return false when x matches but y does not", () => {
      const head = { x: 15, y: 10 };
      const food = { x: 15, y: 15 };
      expect(checkFoodCollision(head, food)).toBe(false);
    });

    it("should return false when y matches but x does not", () => {
      const head = { x: 10, y: 15 };
      const food = { x: 15, y: 15 };
      expect(checkFoodCollision(head, food)).toBe(false);
    });
  });

  describe("spawnFood", () => {
    it("should spawn food within grid bounds", () => {
      const gridSize = 20;
      const snake = [{ x: 10, y: 10 }];
      const random = () => 0.5;
      const food = spawnFood(gridSize, snake, random);

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
      const random = () => 0.5;
      const food = spawnFood(gridSize, snake, random);

      const onSnake = snake.some(
        (segment) => segment.x === food.x && segment.y === food.y,
      );
      expect(onSnake).toBe(false);
    });

    it("should use deterministic random function", () => {
      const gridSize = 20;
      const snake = [{ x: 10, y: 10 }];
      const random = () => 0.25;

      const food1 = spawnFood(gridSize, snake, random);
      const food2 = spawnFood(gridSize, snake, random);

      expect(food1).toEqual(food2);
    });

    it("should spawn at different positions with different random values", () => {
      const gridSize = 20;
      const snake = [{ x: 10, y: 10 }];

      const food1 = spawnFood(gridSize, snake, () => 0.1);
      const food2 = spawnFood(gridSize, snake, () => 0.9);

      expect(food1).not.toEqual(food2);
    });
  });

  describe("getNewDirection", () => {
    it("should allow turning from RIGHT to UP", () => {
      expect(getNewDirection("RIGHT", "UP")).toBe("UP");
    });

    it("should allow turning from RIGHT to DOWN", () => {
      expect(getNewDirection("RIGHT", "DOWN")).toBe("DOWN");
    });

    it("should prevent turning from RIGHT to LEFT (180 degrees)", () => {
      expect(getNewDirection("RIGHT", "LEFT")).toBe("RIGHT");
    });

    it("should prevent turning from LEFT to RIGHT (180 degrees)", () => {
      expect(getNewDirection("LEFT", "RIGHT")).toBe("LEFT");
    });

    it("should prevent turning from UP to DOWN (180 degrees)", () => {
      expect(getNewDirection("UP", "DOWN")).toBe("UP");
    });

    it("should prevent turning from DOWN to UP (180 degrees)", () => {
      expect(getNewDirection("DOWN", "UP")).toBe("DOWN");
    });

    it("should maintain direction when same direction is input", () => {
      expect(getNewDirection("RIGHT", "RIGHT")).toBe("RIGHT");
    });

    it("should allow turning from UP to LEFT", () => {
      expect(getNewDirection("UP", "LEFT")).toBe("LEFT");
    });

    it("should allow turning from DOWN to RIGHT", () => {
      expect(getNewDirection("DOWN", "RIGHT")).toBe("RIGHT");
    });
  });
});
