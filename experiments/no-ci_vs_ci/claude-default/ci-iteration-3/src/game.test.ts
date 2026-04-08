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

    it("should place snake in the center of a 20x20 grid", () => {
      const snake = createInitialSnake();
      // Snake should start horizontally in the middle
      expect(snake[0]).toEqual({ x: 10, y: 10 }); // head
      expect(snake[1]).toEqual({ x: 9, y: 10 }); // body
      expect(snake[2]).toEqual({ x: 8, y: 10 }); // tail
    });

    it("should return an array of position objects with x and y coordinates", () => {
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
    it("should move snake right by adding new head and removing tail", () => {
      const snake = [
        { x: 5, y: 5 },
        { x: 4, y: 5 },
        { x: 3, y: 5 },
      ];
      const newSnake = moveSnake(snake, "right");
      expect(newSnake).toEqual([
        { x: 6, y: 5 },
        { x: 5, y: 5 },
        { x: 4, y: 5 },
      ]);
    });

    it("should move snake left", () => {
      const snake = [
        { x: 5, y: 5 },
        { x: 6, y: 5 },
        { x: 7, y: 5 },
      ];
      const newSnake = moveSnake(snake, "left");
      expect(newSnake).toEqual([
        { x: 4, y: 5 },
        { x: 5, y: 5 },
        { x: 6, y: 5 },
      ]);
    });

    it("should move snake up", () => {
      const snake = [
        { x: 5, y: 5 },
        { x: 5, y: 6 },
        { x: 5, y: 7 },
      ];
      const newSnake = moveSnake(snake, "up");
      expect(newSnake).toEqual([
        { x: 5, y: 4 },
        { x: 5, y: 5 },
        { x: 5, y: 6 },
      ]);
    });

    it("should move snake down", () => {
      const snake = [
        { x: 5, y: 5 },
        { x: 5, y: 4 },
        { x: 5, y: 3 },
      ];
      const newSnake = moveSnake(snake, "down");
      expect(newSnake).toEqual([
        { x: 5, y: 6 },
        { x: 5, y: 5 },
        { x: 5, y: 4 },
      ]);
    });
  });

  describe("checkWallCollision", () => {
    it("should return true when head is at left wall (x < 0)", () => {
      const head = { x: -1, y: 5 };
      expect(checkWallCollision(head, 20)).toBe(true);
    });

    it("should return true when head is at right wall (x >= gridSize)", () => {
      const head = { x: 20, y: 5 };
      expect(checkWallCollision(head, 20)).toBe(true);
    });

    it("should return true when head is at top wall (y < 0)", () => {
      const head = { x: 5, y: -1 };
      expect(checkWallCollision(head, 20)).toBe(true);
    });

    it("should return true when head is at bottom wall (y >= gridSize)", () => {
      const head = { x: 5, y: 20 };
      expect(checkWallCollision(head, 20)).toBe(true);
    });

    it("should return false when head is within bounds", () => {
      const head = { x: 10, y: 10 };
      expect(checkWallCollision(head, 20)).toBe(false);
    });
  });

  describe("checkSelfCollision", () => {
    it("should return true when head collides with body segment", () => {
      const snake = [
        { x: 5, y: 5 },
        { x: 4, y: 5 },
        { x: 5, y: 5 }, // duplicate position (head collides with tail)
      ];
      expect(checkSelfCollision(snake)).toBe(true);
    });

    it("should return false when snake has no self-collision", () => {
      const snake = [
        { x: 5, y: 5 },
        { x: 4, y: 5 },
        { x: 3, y: 5 },
      ];
      expect(checkSelfCollision(snake)).toBe(false);
    });

    it("should return true when head position matches any body segment", () => {
      const snake = [
        { x: 5, y: 5 },
        { x: 5, y: 6 },
        { x: 4, y: 6 },
        { x: 4, y: 5 },
        { x: 5, y: 5 }, // head collides with tail
      ];
      expect(checkSelfCollision(snake)).toBe(true);
    });
  });

  describe("getNewDirection", () => {
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

    it("should allow valid direction change from right to up", () => {
      expect(getNewDirection("right", "up")).toBe("up");
    });

    it("should allow valid direction change from right to down", () => {
      expect(getNewDirection("right", "down")).toBe("down");
    });

    it("should allow valid direction change from up to left", () => {
      expect(getNewDirection("up", "left")).toBe("left");
    });

    it("should keep current direction if input is same", () => {
      expect(getNewDirection("right", "right")).toBe("right");
    });
  });

  describe("checkFoodCollision", () => {
    it("should return true when head position matches food position", () => {
      const head = { x: 5, y: 5 };
      const food = { x: 5, y: 5 };
      expect(checkFoodCollision(head, food)).toBe(true);
    });

    it("should return false when head position does not match food position", () => {
      const head = { x: 5, y: 5 };
      const food = { x: 6, y: 6 };
      expect(checkFoodCollision(head, food)).toBe(false);
    });

    it("should return false when x matches but y differs", () => {
      const head = { x: 5, y: 5 };
      const food = { x: 5, y: 6 };
      expect(checkFoodCollision(head, food)).toBe(false);
    });

    it("should return false when y matches but x differs", () => {
      const head = { x: 5, y: 5 };
      const food = { x: 6, y: 5 };
      expect(checkFoodCollision(head, food)).toBe(false);
    });
  });

  describe("spawnFood", () => {
    it("should spawn food within grid bounds", () => {
      const snake = createInitialSnake();
      const food = spawnFood(20, snake, () => 0.5);
      expect(food.x).toBeGreaterThanOrEqual(0);
      expect(food.x).toBeLessThan(20);
      expect(food.y).toBeGreaterThanOrEqual(0);
      expect(food.y).toBeLessThan(20);
    });

    it("should not spawn food on snake position", () => {
      const snake = [
        { x: 10, y: 10 },
        { x: 9, y: 10 },
        { x: 8, y: 10 },
      ];
      // Use a deterministic random function that would try to spawn on snake first
      let callCount = 0;
      const deterministicRandom = () => {
        callCount++;
        // First call returns position on snake (10, 10)
        // Second call returns position not on snake
        return callCount === 1 ? 0.5 : 0.1;
      };
      const food = spawnFood(20, snake, deterministicRandom);
      // Should not be at any snake position
      const onSnake = snake.some(
        (segment) => segment.x === food.x && segment.y === food.y,
      );
      expect(onSnake).toBe(false);
    });

    it("should return food with x and y coordinates", () => {
      const snake = createInitialSnake();
      const food = spawnFood(20, snake, () => 0.5);
      expect(food).toHaveProperty("x");
      expect(food).toHaveProperty("y");
      expect(typeof food.x).toBe("number");
      expect(typeof food.y).toBe("number");
    });
  });
});
