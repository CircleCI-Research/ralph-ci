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
    it("should create a snake with 3 segments starting at center", () => {
      const gridSize = 20;
      const snake = createInitialSnake(gridSize);

      // Snake should have 3 segments
      expect(snake).toHaveLength(3);

      // Each segment should have x and y coordinates
      expect(snake[0]).toHaveProperty("x");
      expect(snake[0]).toHaveProperty("y");

      // Head should be at the center
      const center = Math.floor(gridSize / 2);
      expect(snake[0].x).toBe(center);
      expect(snake[0].y).toBe(center);

      // Snake should be horizontal, extending to the left
      expect(snake[1].x).toBe(center - 1);
      expect(snake[1].y).toBe(center);
      expect(snake[2].x).toBe(center - 2);
      expect(snake[2].y).toBe(center);
    });
  });

  describe("moveSnake", () => {
    it("should move snake right by adding new head and removing tail", () => {
      const snake = [
        { x: 5, y: 5 },
        { x: 4, y: 5 },
        { x: 3, y: 5 },
      ];
      const direction = { x: 1, y: 0 }; // right
      const newSnake = moveSnake(snake, direction);

      expect(newSnake).toHaveLength(3);
      expect(newSnake[0]).toEqual({ x: 6, y: 5 }); // new head
      expect(newSnake[1]).toEqual({ x: 5, y: 5 }); // old head
      expect(newSnake[2]).toEqual({ x: 4, y: 5 }); // old body[0]
    });

    it("should move snake down", () => {
      const snake = [
        { x: 5, y: 5 },
        { x: 5, y: 4 },
        { x: 5, y: 3 },
      ];
      const direction = { x: 0, y: 1 }; // down
      const newSnake = moveSnake(snake, direction);

      expect(newSnake[0]).toEqual({ x: 5, y: 6 }); // new head
    });

    it("should grow snake when grow parameter is true", () => {
      const snake = [
        { x: 5, y: 5 },
        { x: 4, y: 5 },
        { x: 3, y: 5 },
      ];
      const direction = { x: 1, y: 0 };
      const newSnake = moveSnake(snake, direction, true);

      expect(newSnake).toHaveLength(4); // grew by 1
      expect(newSnake[0]).toEqual({ x: 6, y: 5 }); // new head
      expect(newSnake[3]).toEqual({ x: 3, y: 5 }); // tail preserved
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
  });

  describe("checkSelfCollision", () => {
    it("should detect when head collides with body", () => {
      const snake = [
        { x: 5, y: 5 }, // head
        { x: 4, y: 5 },
        { x: 4, y: 6 },
        { x: 5, y: 6 },
        { x: 5, y: 5 }, // body segment at same position as head
      ];
      expect(checkSelfCollision(snake)).toBe(true);
    });

    it("should return false when no self collision", () => {
      const snake = [
        { x: 5, y: 5 },
        { x: 4, y: 5 },
        { x: 3, y: 5 },
      ];
      expect(checkSelfCollision(snake)).toBe(false);
    });

    it("should return false for minimal snake (head + 1 segment)", () => {
      const snake = [
        { x: 5, y: 5 },
        { x: 4, y: 5 },
      ];
      expect(checkSelfCollision(snake)).toBe(false);
    });
  });

  describe("checkFoodCollision", () => {
    it("should detect when head is on food", () => {
      const head = { x: 10, y: 10 };
      const food = { x: 10, y: 10 };
      expect(checkFoodCollision(head, food)).toBe(true);
    });

    it("should return false when head is not on food", () => {
      const head = { x: 10, y: 10 };
      const food = { x: 11, y: 10 };
      expect(checkFoodCollision(head, food)).toBe(false);
    });
  });

  describe("spawnFood", () => {
    it("should spawn food at random position not on snake", () => {
      const gridSize = 20;
      const snake = [
        { x: 10, y: 10 },
        { x: 9, y: 10 },
        { x: 8, y: 10 },
      ];
      // Use deterministic random for testing
      const random = () => 0.5;
      const food = spawnFood(gridSize, snake, random);

      expect(food).toHaveProperty("x");
      expect(food).toHaveProperty("y");
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

      // Food should not be at any snake segment position
      const isOnSnake = snake.some(
        (segment) => segment.x === food.x && segment.y === food.y,
      );
      expect(isOnSnake).toBe(false);
    });
  });

  describe("getNewDirection", () => {
    it("should prevent 180-degree turn when moving right", () => {
      const currentDirection = { x: 1, y: 0 }; // right
      const inputDirection = { x: -1, y: 0 }; // left
      const result = getNewDirection(currentDirection, inputDirection);
      expect(result).toEqual({ x: 1, y: 0 }); // stays right
    });

    it("should prevent 180-degree turn when moving up", () => {
      const currentDirection = { x: 0, y: -1 }; // up
      const inputDirection = { x: 0, y: 1 }; // down
      const result = getNewDirection(currentDirection, inputDirection);
      expect(result).toEqual({ x: 0, y: -1 }); // stays up
    });

    it("should allow perpendicular turn from right to up", () => {
      const currentDirection = { x: 1, y: 0 }; // right
      const inputDirection = { x: 0, y: -1 }; // up
      const result = getNewDirection(currentDirection, inputDirection);
      expect(result).toEqual({ x: 0, y: -1 }); // changes to up
    });

    it("should allow perpendicular turn from up to left", () => {
      const currentDirection = { x: 0, y: -1 }; // up
      const inputDirection = { x: -1, y: 0 }; // left
      const result = getNewDirection(currentDirection, inputDirection);
      expect(result).toEqual({ x: -1, y: 0 }); // changes to left
    });
  });
});
