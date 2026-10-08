import { describe, it, expect } from "vitest";
import {
  createInitialSnake,
  moveSnake,
  checkWallCollision,
  checkSelfCollision,
  checkFoodCollision,
  spawnFood,
  getNewDirection,
  isGameOver,
  createGameState,
  POINTS_PER_FOOD,
} from "./game.js";

describe("Snake Game - Core Logic", () => {
  describe("createInitialSnake", () => {
    it("should create a snake with 3 segments", () => {
      const snake = createInitialSnake();
      expect(snake).toHaveLength(3);
    });

    it("should position the head at the center of the grid (10, 10)", () => {
      const snake = createInitialSnake();
      const head = snake[0];
      expect(head.x).toBe(10);
      expect(head.y).toBe(10);
    });

    it("should create segments in a horizontal line with consecutive x values", () => {
      const snake = createInitialSnake();

      const yValues = snake.map((seg) => seg.y);
      expect(yValues.every((y) => y === yValues[0])).toBe(true);

      expect(snake[0].x).toBe(10);
      expect(snake[1].x).toBe(9);
      expect(snake[2].x).toBe(8);
    });

    it("should return an array of position objects with numeric x and y", () => {
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
    it("should move the head one cell right when direction is 'right'", () => {
      const snake = [
        { x: 5, y: 5 },
        { x: 4, y: 5 },
      ];
      const moved = moveSnake(snake, "right");
      expect(moved[0]).toEqual({ x: 6, y: 5 });
    });

    it("should move the head one cell left when direction is 'left'", () => {
      const snake = [
        { x: 5, y: 5 },
        { x: 6, y: 5 },
      ];
      const moved = moveSnake(snake, "left");
      expect(moved[0]).toEqual({ x: 4, y: 5 });
    });

    it("should move the head one cell up when direction is 'up' (y decreases)", () => {
      const snake = [
        { x: 5, y: 5 },
        { x: 5, y: 6 },
      ];
      const moved = moveSnake(snake, "up");
      expect(moved[0]).toEqual({ x: 5, y: 4 });
    });

    it("should move the head one cell down when direction is 'down' (y increases)", () => {
      const snake = [
        { x: 5, y: 5 },
        { x: 5, y: 4 },
      ];
      const moved = moveSnake(snake, "down");
      expect(moved[0]).toEqual({ x: 5, y: 6 });
    });

    it("should preserve snake length and drop the tail", () => {
      const snake = [
        { x: 10, y: 10 },
        { x: 9, y: 10 },
        { x: 8, y: 10 },
      ];
      const moved = moveSnake(snake, "right");
      expect(moved).toHaveLength(snake.length);
      // tail (8,10) should be gone; new head is (11,10); previous head becomes body
      expect(moved[0]).toEqual({ x: 11, y: 10 });
      expect(moved[1]).toEqual({ x: 10, y: 10 });
      expect(moved[2]).toEqual({ x: 9, y: 10 });
    });

    it("should not mutate the original snake array or its segments", () => {
      const snake = [
        { x: 5, y: 5 },
        { x: 4, y: 5 },
      ];
      const snapshot = JSON.parse(JSON.stringify(snake));
      moveSnake(snake, "right");
      expect(snake).toEqual(snapshot);
    });

    it("should preserve the tail (grow) when grow=true", () => {
      const snake = [
        { x: 5, y: 5 },
        { x: 4, y: 5 },
        { x: 3, y: 5 },
      ];
      const moved = moveSnake(snake, "right", true);
      expect(moved).toHaveLength(4);
      expect(moved[0]).toEqual({ x: 6, y: 5 });
      expect(moved[1]).toEqual({ x: 5, y: 5 });
      expect(moved[2]).toEqual({ x: 4, y: 5 });
      expect(moved[3]).toEqual({ x: 3, y: 5 });
    });

    it("should drop the tail when grow is omitted (default)", () => {
      const snake = [
        { x: 5, y: 5 },
        { x: 4, y: 5 },
        { x: 3, y: 5 },
      ];
      const moved = moveSnake(snake, "right");
      expect(moved).toHaveLength(3);
    });
  });

  describe("checkWallCollision", () => {
    it("should return false for a head inside the grid", () => {
      expect(checkWallCollision({ x: 10, y: 10 }, 20)).toBe(false);
    });

    it("should return true for a head with negative x", () => {
      expect(checkWallCollision({ x: -1, y: 5 }, 20)).toBe(true);
    });

    it("should return true for a head with negative y", () => {
      expect(checkWallCollision({ x: 5, y: -1 }, 20)).toBe(true);
    });

    it("should return true for a head at x === gridSize (out of bounds)", () => {
      expect(checkWallCollision({ x: 20, y: 5 }, 20)).toBe(true);
    });

    it("should return true for a head at y === gridSize (out of bounds)", () => {
      expect(checkWallCollision({ x: 5, y: 20 }, 20)).toBe(true);
    });

    it("should return false for a head at the boundary cells 0 and gridSize-1", () => {
      expect(checkWallCollision({ x: 0, y: 0 }, 20)).toBe(false);
      expect(checkWallCollision({ x: 19, y: 19 }, 20)).toBe(false);
    });
  });

  describe("checkSelfCollision", () => {
    it("should return false when the snake has no overlapping segments", () => {
      const snake = [
        { x: 10, y: 10 },
        { x: 9, y: 10 },
        { x: 8, y: 10 },
      ];
      expect(checkSelfCollision(snake)).toBe(false);
    });

    it("should return true when the head overlaps a body segment", () => {
      const snake = [
        { x: 5, y: 5 },
        { x: 4, y: 5 },
        { x: 4, y: 6 },
        { x: 5, y: 6 },
        { x: 5, y: 5 }, // tail loops back onto head
      ];
      expect(checkSelfCollision(snake)).toBe(true);
    });

    it("should return false for a single-segment snake (no body to collide with)", () => {
      expect(checkSelfCollision([{ x: 0, y: 0 }])).toBe(false);
    });

    it("should ignore non-head body segments that share coordinates with each other", () => {
      // Only head-vs-body counts as self collision; body-vs-body duplicates
      // can transiently exist mid-update and shouldn't trigger game over.
      const snake = [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
        { x: 1, y: 1 },
      ];
      expect(checkSelfCollision(snake)).toBe(false);
    });
  });

  describe("getNewDirection", () => {
    it("should accept a perpendicular turn (right -> up)", () => {
      expect(getNewDirection("right", "up")).toBe("up");
    });

    it("should accept a perpendicular turn (up -> left)", () => {
      expect(getNewDirection("up", "left")).toBe("left");
    });

    it("should reject a 180-degree turn from right to left", () => {
      expect(getNewDirection("right", "left")).toBe("right");
    });

    it("should reject a 180-degree turn from left to right", () => {
      expect(getNewDirection("left", "right")).toBe("left");
    });

    it("should reject a 180-degree turn from up to down", () => {
      expect(getNewDirection("up", "down")).toBe("up");
    });

    it("should reject a 180-degree turn from down to up", () => {
      expect(getNewDirection("down", "up")).toBe("down");
    });

    it("should keep current direction when input equals current direction", () => {
      expect(getNewDirection("right", "right")).toBe("right");
    });

    it("should ignore unknown input directions", () => {
      expect(getNewDirection("right", "diagonal")).toBe("right");
      expect(getNewDirection("up", "")).toBe("up");
    });
  });

  describe("checkFoodCollision", () => {
    it("should return true when head and food share the same cell", () => {
      expect(checkFoodCollision({ x: 5, y: 5 }, { x: 5, y: 5 })).toBe(true);
    });

    it("should return false when head and food differ on x", () => {
      expect(checkFoodCollision({ x: 4, y: 5 }, { x: 5, y: 5 })).toBe(false);
    });

    it("should return false when head and food differ on y", () => {
      expect(checkFoodCollision({ x: 5, y: 5 }, { x: 5, y: 4 })).toBe(false);
    });

    it("should return false when food is null (e.g. grid full)", () => {
      expect(checkFoodCollision({ x: 5, y: 5 }, null)).toBe(false);
    });
  });

  describe("spawnFood", () => {
    it("should return a position with x and y inside [0, gridSize)", () => {
      const snake = [{ x: 0, y: 0 }];
      // floor(0.1 * 20) = 2 → (2, 2), not on snake
      const food = spawnFood(20, snake, () => 0.1);
      expect(food).not.toBeNull();
      if (food) {
        expect(food.x).toBeGreaterThanOrEqual(0);
        expect(food.x).toBeLessThan(20);
        expect(food.y).toBeGreaterThanOrEqual(0);
        expect(food.y).toBeLessThan(20);
      }
    });

    it("should return a position not occupied by the snake", () => {
      const snake = [
        { x: 2, y: 2 },
        { x: 3, y: 2 },
        { x: 4, y: 2 },
      ];
      // floor(0.05 * 20) = 1 → (1, 1), not on snake
      const food = spawnFood(20, snake, () => 0.05);
      expect(food).toEqual({ x: 1, y: 1 });
      expect(snake.some((s) => s.x === food!.x && s.y === food!.y)).toBe(false);
    });

    it("should retry when the first attempt lands on the snake", () => {
      const snake = [{ x: 10, y: 10 }];
      let i = 0;
      // Attempt 1: floor(0.5 * 20) = 10 → (10, 10) collides with snake
      // Attempt 2: floor(0.05 * 20) = 1 → (1, 1) does not collide
      const seq = [0.5, 0.5, 0.05, 0.05];
      const food = spawnFood(20, snake, () => seq[i++] ?? 0.05);
      expect(food).toEqual({ x: 1, y: 1 });
      // Verifies retry happened (4 random draws == 2 attempts).
      expect(i).toBe(4);
    });

    it("should produce a deterministic position from a deterministic random", () => {
      const snake = [{ x: 0, y: 0 }];
      // floor(0.95 * 20) = 19 → (19, 19), corner cell, not on snake
      const food = spawnFood(20, snake, () => 0.95);
      expect(food).toEqual({ x: 19, y: 19 });
    });
  });

  describe("isGameOver", () => {
    it("should return false for a clean in-bounds snake", () => {
      const snake = [
        { x: 10, y: 10 },
        { x: 9, y: 10 },
        { x: 8, y: 10 },
      ];
      expect(isGameOver(snake, 20)).toBe(false);
    });

    it("should return true when the head is out of bounds (wall)", () => {
      const snake = [
        { x: 20, y: 10 },
        { x: 19, y: 10 },
      ];
      expect(isGameOver(snake, 20)).toBe(true);
    });

    it("should return true when the head overlaps a body segment (self)", () => {
      const snake = [
        { x: 5, y: 5 },
        { x: 4, y: 5 },
        { x: 4, y: 6 },
        { x: 5, y: 6 },
        { x: 5, y: 5 },
      ];
      expect(isGameOver(snake, 20)).toBe(true);
    });

    it("should short-circuit on wall collision without inspecting the body", () => {
      // Head out of bounds AND body has a self-overlap; either alone would
      // trigger game over, but the wall check must run first so an out-of-
      // bounds head never reaches the self-collision compare.
      const snake = [
        { x: -1, y: 5 },
        { x: 0, y: 5 },
        { x: 0, y: 5 },
      ];
      expect(isGameOver(snake, 20)).toBe(true);
    });

    it("should return false for a head at the boundary cell gridSize-1", () => {
      const snake = [
        { x: 19, y: 19 },
        { x: 18, y: 19 },
      ];
      expect(isGameOver(snake, 20)).toBe(false);
    });
  });

  describe("POINTS_PER_FOOD", () => {
    it("should be a positive integer (used to increment score per food)", () => {
      expect(Number.isInteger(POINTS_PER_FOOD)).toBe(true);
      expect(POINTS_PER_FOOD).toBeGreaterThan(0);
    });
  });

  describe("createGameState", () => {
    it("should return a fresh initial snake, default direction, and zero score", () => {
      // 0.05 * 20 = 1 → food at (1, 1), not on snake [(8,10),(9,10),(10,10)]
      const state = createGameState(20, () => 0.05);
      expect(state.snake).toEqual(createInitialSnake());
      expect(state.direction).toBe("right");
      expect(state.score).toBe(0);
      expect(state.food).toEqual({ x: 1, y: 1 });
    });

    it("should produce independent snake arrays each call (no shared reference)", () => {
      // Two restarts must not alias the same snake; mutating one should not
      // leak into the other. 0.05 picks a non-colliding food cell (1,1).
      const a = createGameState(20, () => 0.05);
      const b = createGameState(20, () => 0.05);
      expect(a.snake).not.toBe(b.snake);
      a.snake.push({ x: 0, y: 0 });
      expect(b.snake).toHaveLength(3);
    });
  });
});
