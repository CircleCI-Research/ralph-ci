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

  it("should position snake at center of 20x20 grid", () => {
    const snake = createInitialSnake();
    const head = snake[0];

    // Center of 20x20 grid is at position 10,10
    expect(head.x).toBe(10);
    expect(head.y).toBe(10);
  });

  it("should create snake facing right (horizontal)", () => {
    const snake = createInitialSnake();

    // Snake should extend to the left from head
    expect(snake[0].x).toBe(10); // head
    expect(snake[1].x).toBe(9); // body
    expect(snake[2].x).toBe(8); // tail

    // All segments should be on same y coordinate
    expect(snake[0].y).toBe(10);
    expect(snake[1].y).toBe(10);
    expect(snake[2].y).toBe(10);
  });

  it("should return array of objects with x and y properties", () => {
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
  it("should move snake head in the given direction", () => {
    const snake = [
      { x: 5, y: 5 },
      { x: 4, y: 5 },
      { x: 3, y: 5 },
    ];
    const direction = { x: 1, y: 0 }; // Move right

    const newSnake = moveSnake(snake, direction);

    expect(newSnake[0]).toEqual({ x: 6, y: 5 }); // New head position
  });

  it("should remove tail when not growing", () => {
    const snake = [
      { x: 5, y: 5 },
      { x: 4, y: 5 },
      { x: 3, y: 5 },
    ];
    const direction = { x: 1, y: 0 };

    const newSnake = moveSnake(snake, direction, false);

    expect(newSnake).toHaveLength(3); // Same length
    expect(newSnake[2]).toEqual({ x: 4, y: 5 }); // Old tail removed
  });

  it("should keep tail when growing", () => {
    const snake = [
      { x: 5, y: 5 },
      { x: 4, y: 5 },
      { x: 3, y: 5 },
    ];
    const direction = { x: 1, y: 0 };

    const newSnake = moveSnake(snake, direction, true);

    expect(newSnake).toHaveLength(4); // Grew by 1
    expect(newSnake[3]).toEqual({ x: 3, y: 5 }); // Old tail kept
  });

  it("should move in all four directions correctly", () => {
    const snake = [{ x: 5, y: 5 }];

    const movedUp = moveSnake(snake, { x: 0, y: -1 });
    expect(movedUp[0]).toEqual({ x: 5, y: 4 });

    const movedDown = moveSnake(snake, { x: 0, y: 1 });
    expect(movedDown[0]).toEqual({ x: 5, y: 6 });

    const movedLeft = moveSnake(snake, { x: -1, y: 0 });
    expect(movedLeft[0]).toEqual({ x: 4, y: 5 });

    const movedRight = moveSnake(snake, { x: 1, y: 0 });
    expect(movedRight[0]).toEqual({ x: 6, y: 5 });
  });
});

describe("checkWallCollision", () => {
  it("should detect collision with left wall", () => {
    const head = { x: -1, y: 5 };
    expect(checkWallCollision(head, 20)).toBe(true);
  });

  it("should detect collision with right wall", () => {
    const head = { x: 20, y: 5 };
    expect(checkWallCollision(head, 20)).toBe(true);
  });

  it("should detect collision with top wall", () => {
    const head = { x: 5, y: -1 };
    expect(checkWallCollision(head, 20)).toBe(true);
  });

  it("should detect collision with bottom wall", () => {
    const head = { x: 5, y: 20 };
    expect(checkWallCollision(head, 20)).toBe(true);
  });

  it("should return false when no collision", () => {
    const head = { x: 10, y: 10 };
    expect(checkWallCollision(head, 20)).toBe(false);
  });

  it("should return false at grid boundaries (inside)", () => {
    expect(checkWallCollision({ x: 0, y: 0 }, 20)).toBe(false);
    expect(checkWallCollision({ x: 19, y: 19 }, 20)).toBe(false);
  });
});

describe("checkSelfCollision", () => {
  it("should detect collision when head hits body", () => {
    const snake = [
      { x: 5, y: 5 }, // head at same position as body segment
      { x: 6, y: 5 },
      { x: 6, y: 6 },
      { x: 5, y: 6 },
      { x: 5, y: 5 }, // body segment at head position
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

  it("should return false for snake with only one segment", () => {
    const snake = [{ x: 5, y: 5 }];
    expect(checkSelfCollision(snake)).toBe(false);
  });

  it("should return false for snake with two segments", () => {
    const snake = [
      { x: 5, y: 5 },
      { x: 4, y: 5 },
    ];
    expect(checkSelfCollision(snake)).toBe(false);
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

  it("should return false when only x or y matches", () => {
    const head = { x: 10, y: 10 };

    const foodSameX = { x: 10, y: 11 };
    expect(checkFoodCollision(head, foodSameX)).toBe(false);

    const foodSameY = { x: 11, y: 10 };
    expect(checkFoodCollision(head, foodSameY)).toBe(false);
  });
});

describe("spawnFood", () => {
  it("should spawn food within grid boundaries", () => {
    const snake = [{ x: 0, y: 0 }];
    const gridSize = 20;

    // Use deterministic random for testing
    const mockRandom = () => 0.5;
    const food = spawnFood(gridSize, snake, mockRandom);

    expect(food.x).toBeGreaterThanOrEqual(0);
    expect(food.x).toBeLessThan(gridSize);
    expect(food.y).toBeGreaterThanOrEqual(0);
    expect(food.y).toBeLessThan(gridSize);
  });

  it("should not spawn food on snake body", () => {
    const snake = [
      { x: 5, y: 5 },
      { x: 5, y: 6 },
      { x: 5, y: 7 },
    ];
    const gridSize = 20;

    // Mock random to try snake positions first, then empty position
    let callCount = 0;
    const mockRandom = () => {
      callCount++;
      // First few calls return positions on snake
      if (callCount <= 2) return 0.25; // x: 5
      if (callCount <= 4) return 0.25; // y: 5
      // Then return a safe position
      return 0.5; // x: 10, y: 10
    };

    const food = spawnFood(gridSize, snake, mockRandom);

    // Food should not be on any snake segment
    const isOnSnake = snake.some(
      (segment) => segment.x === food.x && segment.y === food.y,
    );
    expect(isOnSnake).toBe(false);
  });

  it("should return a position with x and y properties", () => {
    const snake = [{ x: 0, y: 0 }];
    const food = spawnFood(20, snake, () => 0.5);

    expect(food).toHaveProperty("x");
    expect(food).toHaveProperty("y");
    expect(typeof food.x).toBe("number");
    expect(typeof food.y).toBe("number");
  });
});

describe("getNewDirection", () => {
  it("should allow perpendicular direction changes", () => {
    const current = { x: 1, y: 0 }; // Moving right

    const upInput = { x: 0, y: -1 };
    expect(getNewDirection(current, upInput)).toEqual(upInput);

    const downInput = { x: 0, y: 1 };
    expect(getNewDirection(current, downInput)).toEqual(downInput);
  });

  it("should prevent 180-degree turns", () => {
    const current = { x: 1, y: 0 }; // Moving right
    const opposite = { x: -1, y: 0 }; // Try to move left

    expect(getNewDirection(current, opposite)).toEqual(current);
  });

  it("should prevent reverse direction for all axes", () => {
    // Right -> Left
    expect(getNewDirection({ x: 1, y: 0 }, { x: -1, y: 0 })).toEqual({
      x: 1,
      y: 0,
    });

    // Left -> Right
    expect(getNewDirection({ x: -1, y: 0 }, { x: 1, y: 0 })).toEqual({
      x: -1,
      y: 0,
    });

    // Up -> Down
    expect(getNewDirection({ x: 0, y: -1 }, { x: 0, y: 1 })).toEqual({
      x: 0,
      y: -1,
    });

    // Down -> Up
    expect(getNewDirection({ x: 0, y: 1 }, { x: 0, y: -1 })).toEqual({
      x: 0,
      y: 1,
    });
  });

  it("should allow continuing in same direction", () => {
    const current = { x: 1, y: 0 };
    expect(getNewDirection(current, current)).toEqual(current);
  });
});
