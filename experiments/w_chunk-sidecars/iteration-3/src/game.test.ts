import { describe, it, expect } from "vitest";
import {
  createInitialSnake,
  createInitialState,
  moveSnake,
  growSnake,
  checkWallCollision,
  checkSelfCollision,
  checkFoodCollision,
  spawnFood,
  getNewDirection,
  tickGameState,
} from "./game.js";

type Segment = { x: number; y: number };

describe("Snake Game - Core Logic", () => {
  describe("createInitialSnake", () => {
    it("should create a snake with 3 segments", () => {
      const snake = createInitialSnake();
      expect(snake).toHaveLength(3);
    });

    it("should position head at center of grid (10, 10)", () => {
      const snake = createInitialSnake();
      expect(snake[0].x).toBe(10);
      expect(snake[0].y).toBe(10);
    });

    it("should create segments in a horizontal line with consecutive x values", () => {
      const snake = createInitialSnake();
      const yValues = snake.map((seg: Segment) => seg.y);
      expect(yValues.every((y: number) => y === yValues[0])).toBe(true);
      expect(snake[0].x).toBe(10);
      expect(snake[1].x).toBe(9);
      expect(snake[2].x).toBe(8);
    });

    it("should return position objects with numeric x and y properties", () => {
      const snake = createInitialSnake();
      snake.forEach((segment: Segment) => {
        expect(segment).toHaveProperty("x");
        expect(segment).toHaveProperty("y");
        expect(typeof segment.x).toBe("number");
        expect(typeof segment.y).toBe("number");
      });
    });
  });

  describe("moveSnake", () => {
    it("should move head one cell right when direction is right", () => {
      const snake: Segment[] = [
        { x: 5, y: 5 },
        { x: 4, y: 5 },
      ];
      expect(moveSnake(snake, "right")[0]).toEqual({ x: 6, y: 5 });
    });

    it("should move head one cell left when direction is left", () => {
      const snake: Segment[] = [
        { x: 5, y: 5 },
        { x: 6, y: 5 },
      ];
      expect(moveSnake(snake, "left")[0]).toEqual({ x: 4, y: 5 });
    });

    it("should move head one cell up when direction is up", () => {
      const snake: Segment[] = [
        { x: 5, y: 5 },
        { x: 5, y: 6 },
      ];
      expect(moveSnake(snake, "up")[0]).toEqual({ x: 5, y: 4 });
    });

    it("should move head one cell down when direction is down", () => {
      const snake: Segment[] = [
        { x: 5, y: 5 },
        { x: 5, y: 4 },
      ];
      expect(moveSnake(snake, "down")[0]).toEqual({ x: 5, y: 6 });
    });

    it("should preserve the snake's length when moving", () => {
      const snake: Segment[] = [
        { x: 5, y: 5 },
        { x: 4, y: 5 },
        { x: 3, y: 5 },
      ];
      expect(moveSnake(snake, "right")).toHaveLength(3);
    });

    it("should drop the original tail segment when moving", () => {
      const snake: Segment[] = [
        { x: 5, y: 5 },
        { x: 4, y: 5 },
        { x: 3, y: 5 },
      ];
      const moved = moveSnake(snake, "right");
      expect(moved.some((s: Segment) => s.x === 3 && s.y === 5)).toBe(false);
    });

    it("should not mutate the input snake", () => {
      const snake: Segment[] = [
        { x: 5, y: 5 },
        { x: 4, y: 5 },
      ];
      const snapshot = JSON.stringify(snake);
      moveSnake(snake, "right");
      expect(JSON.stringify(snake)).toBe(snapshot);
    });
  });

  describe("checkWallCollision", () => {
    const gridSize = 20;

    it("returns true when head is past the left wall", () => {
      expect(checkWallCollision({ x: -1, y: 5 }, gridSize)).toBe(true);
    });

    it("returns true when head is past the right wall", () => {
      expect(checkWallCollision({ x: 20, y: 5 }, gridSize)).toBe(true);
    });

    it("returns true when head is past the top wall", () => {
      expect(checkWallCollision({ x: 5, y: -1 }, gridSize)).toBe(true);
    });

    it("returns true when head is past the bottom wall", () => {
      expect(checkWallCollision({ x: 5, y: 20 }, gridSize)).toBe(true);
    });

    it("returns false when head is inside the grid", () => {
      expect(checkWallCollision({ x: 10, y: 10 }, gridSize)).toBe(false);
    });

    it("returns false for the corners at the inclusive edges", () => {
      expect(checkWallCollision({ x: 0, y: 0 }, gridSize)).toBe(false);
      expect(checkWallCollision({ x: 19, y: 19 }, gridSize)).toBe(false);
    });
  });

  describe("checkSelfCollision", () => {
    it("returns false for a fresh straight snake", () => {
      const snake: Segment[] = [
        { x: 5, y: 5 },
        { x: 4, y: 5 },
        { x: 3, y: 5 },
      ];
      expect(checkSelfCollision(snake)).toBe(false);
    });

    it("returns true when the head overlaps a body segment", () => {
      const snake: Segment[] = [
        { x: 5, y: 5 },
        { x: 4, y: 5 },
        { x: 4, y: 6 },
        { x: 5, y: 6 },
        { x: 5, y: 5 },
      ];
      expect(checkSelfCollision(snake)).toBe(true);
    });

    it("returns false for a single-segment snake", () => {
      expect(checkSelfCollision([{ x: 5, y: 5 }])).toBe(false);
    });
  });

  describe("growSnake", () => {
    it("adds a new head in the move direction and keeps the tail", () => {
      const snake: Segment[] = [
        { x: 5, y: 5 },
        { x: 4, y: 5 },
        { x: 3, y: 5 },
      ];
      const grown = growSnake(snake, "right");
      expect(grown).toHaveLength(4);
      expect(grown[0]).toEqual({ x: 6, y: 5 });
      expect(grown[grown.length - 1]).toEqual({ x: 3, y: 5 });
    });

    it("does not mutate the input snake", () => {
      const snake: Segment[] = [
        { x: 5, y: 5 },
        { x: 4, y: 5 },
      ];
      const snapshot = JSON.stringify(snake);
      growSnake(snake, "up");
      expect(JSON.stringify(snake)).toBe(snapshot);
    });
  });

  describe("checkFoodCollision", () => {
    it("returns true when head and food share coordinates", () => {
      expect(checkFoodCollision({ x: 4, y: 7 }, { x: 4, y: 7 })).toBe(true);
    });

    it("returns false when x differs", () => {
      expect(checkFoodCollision({ x: 3, y: 7 }, { x: 4, y: 7 })).toBe(false);
    });

    it("returns false when y differs", () => {
      expect(checkFoodCollision({ x: 4, y: 8 }, { x: 4, y: 7 })).toBe(false);
    });
  });

  describe("spawnFood", () => {
    const gridSize = 20;

    it("returns a position within the grid bounds", () => {
      const snake: Segment[] = [{ x: 0, y: 0 }];
      // 0.1 * 20 = 2 → (2, 2), safely off the snake
      const food = spawnFood(gridSize, snake, () => 0.1);
      expect(food.x).toBeGreaterThanOrEqual(0);
      expect(food.x).toBeLessThan(gridSize);
      expect(food.y).toBeGreaterThanOrEqual(0);
      expect(food.y).toBeLessThan(gridSize);
      expect(food).toEqual({ x: 2, y: 2 });
    });

    it("never returns a position occupied by the snake", () => {
      const snake: Segment[] = [
        { x: 10, y: 10 },
        { x: 9, y: 10 },
        { x: 8, y: 10 },
      ];
      // 0.25 * 20 = 5 → (5, 5), not on the snake
      const food = spawnFood(gridSize, snake, () => 0.25);
      const onSnake = snake.some(
        (s: Segment) => s.x === food.x && s.y === food.y,
      );
      expect(onSnake).toBe(false);
    });

    it("retries when the first candidate collides with the snake", () => {
      const snake: Segment[] = [
        { x: 10, y: 10 },
        { x: 9, y: 10 },
        { x: 8, y: 10 },
      ];
      // First (x,y) attempt: floor(0.5*20)=10 → (10,10) collides with head.
      // Second (x,y) attempt: floor(0.1*20)=2 → (2,2) is safe.
      const seq = [0.5, 0.5, 0.1, 0.1];
      let i = 0;
      const rng = () => seq[i++] ?? 0;
      const food = spawnFood(gridSize, snake, rng);
      expect(food).toEqual({ x: 2, y: 2 });
      // Two attempts × two coords = 4 rng calls
      expect(i).toBe(4);
    });
  });

  describe("createInitialState", () => {
    const gridSize = 20;

    it("returns a fresh state with the initial snake, food, score 0, and gameOver false", () => {
      // 0.1 * 20 = 2 → (2, 2), safely off the initial snake at (10,10)..(8,10)
      const state = createInitialState(gridSize, () => 0.1);
      expect(state.snake).toEqual(createInitialSnake());
      expect(state.food).toEqual({ x: 2, y: 2 });
      expect(state.score).toBe(0);
      expect(state.gameOver).toBe(false);
    });

    it("returns independent state objects across calls (restart safety)", () => {
      const a = createInitialState(gridSize, () => 0.1);
      const b = createInitialState(gridSize, () => 0.1);
      expect(a).not.toBe(b);
      expect(a.snake).not.toBe(b.snake);
      // Mutating one must not affect the other
      a.snake.push({ x: 0, y: 0 });
      a.score = 99;
      expect(b.snake).toHaveLength(3);
      expect(b.score).toBe(0);
    });

    it("places food off the snake using the injected random", () => {
      // 0.25 * 20 = 5 → (5, 5), not on the initial snake
      const state = createInitialState(gridSize, () => 0.25);
      const onSnake = state.snake.some(
        (s: Segment) => s.x === state.food.x && s.y === state.food.y,
      );
      expect(onSnake).toBe(false);
      expect(state.food).toEqual({ x: 5, y: 5 });
    });
  });

  describe("tickGameState", () => {
    const gridSize = 20;

    it("advances the snake on a normal tick (no collision, no food)", () => {
      const state = {
        snake: [
          { x: 5, y: 5 },
          { x: 4, y: 5 },
          { x: 3, y: 5 },
        ] as Segment[],
        food: { x: 15, y: 15 },
        score: 0,
        gameOver: false,
      };
      // random is unused on a non-eating tick, but provide a safe fake anyway
      const next = tickGameState(state, "right", gridSize, () => 0.1);
      expect(next.snake[0]).toEqual({ x: 6, y: 5 });
      expect(next.snake).toHaveLength(3);
      expect(next.score).toBe(0);
      expect(next.gameOver).toBe(false);
      expect(next.food).toEqual({ x: 15, y: 15 });
    });

    it("grows the snake, increments score, and respawns food when head lands on food", () => {
      const state = {
        snake: [
          { x: 10, y: 10 },
          { x: 9, y: 10 },
          { x: 8, y: 10 },
        ] as Segment[],
        food: { x: 11, y: 10 },
        score: 3,
        gameOver: false,
      };
      // 0.1 * 20 = 2 → (2, 2), safely off the grown snake
      const next = tickGameState(state, "right", gridSize, () => 0.1);
      expect(next.snake).toHaveLength(4);
      expect(next.snake[0]).toEqual({ x: 11, y: 10 });
      expect(next.score).toBe(4);
      expect(next.food).toEqual({ x: 2, y: 2 });
      expect(next.gameOver).toBe(false);
    });

    it("sets gameOver when the snake moves into a wall", () => {
      const state = {
        snake: [
          { x: 19, y: 10 },
          { x: 18, y: 10 },
          { x: 17, y: 10 },
        ] as Segment[],
        food: { x: 5, y: 5 },
        score: 7,
        gameOver: false,
      };
      const next = tickGameState(state, "right", gridSize, () => 0.1);
      expect(next.gameOver).toBe(true);
      // Score is preserved so the game-over screen can display it
      expect(next.score).toBe(7);
    });

    it("sets gameOver when the snake's new head overlaps its own body", () => {
      // After moving down, head (5,6) collides with last segment (5,6).
      const state = {
        snake: [
          { x: 5, y: 5 },
          { x: 6, y: 5 },
          { x: 6, y: 6 },
          { x: 5, y: 6 },
          { x: 4, y: 6 },
        ] as Segment[],
        food: { x: 15, y: 15 },
        score: 2,
        gameOver: false,
      };
      const next = tickGameState(state, "down", gridSize, () => 0.1);
      expect(next.gameOver).toBe(true);
      expect(next.score).toBe(2);
    });

    it("is a no-op once gameOver is true (does not move or change score)", () => {
      const state = {
        snake: [
          { x: 5, y: 5 },
          { x: 4, y: 5 },
        ] as Segment[],
        food: { x: 15, y: 15 },
        score: 9,
        gameOver: true,
      };
      const next = tickGameState(state, "right", gridSize, () => 0.1);
      expect(next).toBe(state);
    });

    it("does not mutate the input state on a normal tick", () => {
      const state = {
        snake: [
          { x: 5, y: 5 },
          { x: 4, y: 5 },
        ] as Segment[],
        food: { x: 15, y: 15 },
        score: 0,
        gameOver: false,
      };
      const snapshot = JSON.stringify(state);
      tickGameState(state, "right", gridSize, () => 0.1);
      expect(JSON.stringify(state)).toBe(snapshot);
    });
  });

  describe("getNewDirection", () => {
    it("returns the input direction when it is perpendicular to current", () => {
      expect(getNewDirection("right", "up")).toBe("up");
      expect(getNewDirection("right", "down")).toBe("down");
      expect(getNewDirection("up", "left")).toBe("left");
      expect(getNewDirection("up", "right")).toBe("right");
      expect(getNewDirection("down", "left")).toBe("left");
      expect(getNewDirection("down", "right")).toBe("right");
      expect(getNewDirection("left", "up")).toBe("up");
      expect(getNewDirection("left", "down")).toBe("down");
    });

    it("rejects a 180-degree reversal and keeps the current direction", () => {
      expect(getNewDirection("up", "down")).toBe("up");
      expect(getNewDirection("down", "up")).toBe("down");
      expect(getNewDirection("left", "right")).toBe("left");
      expect(getNewDirection("right", "left")).toBe("right");
    });

    it("returns the current direction when the input matches it", () => {
      expect(getNewDirection("up", "up")).toBe("up");
      expect(getNewDirection("right", "right")).toBe("right");
    });
  });
});
