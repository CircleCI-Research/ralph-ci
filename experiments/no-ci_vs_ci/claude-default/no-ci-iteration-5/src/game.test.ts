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
  it("should return a snake with 3 segments", () => {
    const snake = createInitialSnake();
    expect(snake).toHaveLength(3);
  });

  it("should start at center of grid (10, 10)", () => {
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
  it("should move snake head in the direction provided", () => {
    const snake = [
      { x: 10, y: 10 },
      { x: 9, y: 10 },
      { x: 8, y: 10 },
    ];
    const direction = { x: 1, y: 0 }; // moving right
    const newSnake = moveSnake(snake, direction, false);

    expect(newSnake[0]).toEqual({ x: 11, y: 10 }); // head moved right
  });

  it("should remove tail segment when not growing", () => {
    const snake = [
      { x: 10, y: 10 },
      { x: 9, y: 10 },
      { x: 8, y: 10 },
    ];
    const direction = { x: 0, y: 1 }; // moving down
    const newSnake = moveSnake(snake, direction, false);

    expect(newSnake).toHaveLength(3);
    expect(newSnake[0]).toEqual({ x: 10, y: 11 }); // head moved down
    expect(newSnake[1]).toEqual({ x: 10, y: 10 }); // old head becomes body
    expect(newSnake[2]).toEqual({ x: 9, y: 10 }); // tail removed
  });

  it("should keep tail segment when growing", () => {
    const snake = [
      { x: 10, y: 10 },
      { x: 9, y: 10 },
      { x: 8, y: 10 },
    ];
    const direction = { x: 1, y: 0 };
    const newSnake = moveSnake(snake, direction, true);

    expect(newSnake).toHaveLength(4); // grew by 1
    expect(newSnake[0]).toEqual({ x: 11, y: 10 }); // new head
  });
});

describe("checkWallCollision", () => {
  it("should detect collision with top wall", () => {
    const head = { x: 5, y: -1 };
    const gridSize = 20;
    expect(checkWallCollision(head, gridSize)).toBe(true);
  });

  it("should detect collision with bottom wall", () => {
    const head = { x: 5, y: 20 };
    const gridSize = 20;
    expect(checkWallCollision(head, gridSize)).toBe(true);
  });

  it("should detect collision with left wall", () => {
    const head = { x: -1, y: 5 };
    const gridSize = 20;
    expect(checkWallCollision(head, gridSize)).toBe(true);
  });

  it("should detect collision with right wall", () => {
    const head = { x: 20, y: 5 };
    const gridSize = 20;
    expect(checkWallCollision(head, gridSize)).toBe(true);
  });

  it("should not detect collision when inside grid", () => {
    const head = { x: 10, y: 10 };
    const gridSize = 20;
    expect(checkWallCollision(head, gridSize)).toBe(false);
  });
});

describe("checkSelfCollision", () => {
  it("should detect collision when head hits body", () => {
    const snake = [
      { x: 10, y: 10 }, // head
      { x: 9, y: 10 },
      { x: 9, y: 11 },
      { x: 10, y: 11 },
      { x: 10, y: 10 }, // loops back to head position
    ];
    expect(checkSelfCollision(snake)).toBe(true);
  });

  it("should not detect collision on short snake", () => {
    const snake = [
      { x: 10, y: 10 },
      { x: 9, y: 10 },
      { x: 8, y: 10 },
    ];
    expect(checkSelfCollision(snake)).toBe(false);
  });

  it("should not detect collision when head does not hit body", () => {
    const snake = [
      { x: 10, y: 10 },
      { x: 9, y: 10 },
      { x: 8, y: 10 },
      { x: 7, y: 10 },
    ];
    expect(checkSelfCollision(snake)).toBe(false);
  });
});

describe("checkFoodCollision", () => {
  it("should detect collision when head is at food position", () => {
    const head = { x: 15, y: 15 };
    const food = { x: 15, y: 15 };
    expect(checkFoodCollision(head, food)).toBe(true);
  });

  it("should not detect collision when head is not at food position", () => {
    const head = { x: 10, y: 10 };
    const food = { x: 15, y: 15 };
    expect(checkFoodCollision(head, food)).toBe(false);
  });
});

describe("spawnFood", () => {
  it("should spawn food within grid boundaries", () => {
    const gridSize = 20;
    const snake = createInitialSnake();
    const food = spawnFood(gridSize, snake);

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

    // Use deterministic random to control spawn position
    const deterministicRandom = () => 0.5; // will map to middle of grid
    const food = spawnFood(gridSize, snake, deterministicRandom);

    // Food should not be on any snake segment
    const onSnake = snake.some(
      (segment) => segment.x === food.x && segment.y === food.y,
    );
    expect(onSnake).toBe(false);
  });
});

describe("getNewDirection", () => {
  it("should accept valid direction change", () => {
    const current = { x: 1, y: 0 }; // moving right
    const input = { x: 0, y: 1 }; // want to move down
    const result = getNewDirection(current, input);

    expect(result).toEqual({ x: 0, y: 1 });
  });

  it("should prevent 180-degree turn (right to left)", () => {
    const current = { x: 1, y: 0 }; // moving right
    const input = { x: -1, y: 0 }; // trying to move left
    const result = getNewDirection(current, input);

    expect(result).toEqual({ x: 1, y: 0 }); // should keep current direction
  });

  it("should prevent 180-degree turn (up to down)", () => {
    const current = { x: 0, y: -1 }; // moving up
    const input = { x: 0, y: 1 }; // trying to move down
    const result = getNewDirection(current, input);

    expect(result).toEqual({ x: 0, y: -1 }); // should keep current direction
  });
});
