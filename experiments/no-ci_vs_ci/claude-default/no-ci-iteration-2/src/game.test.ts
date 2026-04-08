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

  it("should place the snake head at the center of the grid", () => {
    const snake = createInitialSnake();
    const head = snake[0];
    expect(head).toEqual({ x: 10, y: 10 });
  });

  it("should create segments extending to the left", () => {
    const snake = createInitialSnake();
    expect(snake[0]).toEqual({ x: 10, y: 10 }); // head
    expect(snake[1]).toEqual({ x: 9, y: 10 }); // body
    expect(snake[2]).toEqual({ x: 8, y: 10 }); // tail
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
    expect(newSnake[1]).toEqual({ x: 5, y: 5 });
    expect(newSnake[2]).toEqual({ x: 4, y: 5 });
  });

  it("should move snake left", () => {
    const snake = [
      { x: 5, y: 5 },
      { x: 6, y: 5 },
      { x: 7, y: 5 },
    ];
    const direction = { x: -1, y: 0 }; // left
    const newSnake = moveSnake(snake, direction);

    expect(newSnake[0]).toEqual({ x: 4, y: 5 }); // new head
  });

  it("should move snake up", () => {
    const snake = [
      { x: 5, y: 5 },
      { x: 5, y: 6 },
      { x: 5, y: 7 },
    ];
    const direction = { x: 0, y: -1 }; // up
    const newSnake = moveSnake(snake, direction);

    expect(newSnake[0]).toEqual({ x: 5, y: 4 }); // new head
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

  it("should not mutate the original snake array", () => {
    const snake = [
      { x: 5, y: 5 },
      { x: 4, y: 5 },
      { x: 3, y: 5 },
    ];
    const direction = { x: 1, y: 0 };
    const originalSnake = JSON.parse(JSON.stringify(snake));

    moveSnake(snake, direction);

    expect(snake).toEqual(originalSnake); // original should be unchanged
  });
});

describe("checkWallCollision", () => {
  const gridSize = 20;

  it("should return true when snake head hits left wall", () => {
    const head = { x: -1, y: 10 };
    expect(checkWallCollision(head, gridSize)).toBe(true);
  });

  it("should return true when snake head hits right wall", () => {
    const head = { x: 20, y: 10 };
    expect(checkWallCollision(head, gridSize)).toBe(true);
  });

  it("should return true when snake head hits top wall", () => {
    const head = { x: 10, y: -1 };
    expect(checkWallCollision(head, gridSize)).toBe(true);
  });

  it("should return true when snake head hits bottom wall", () => {
    const head = { x: 10, y: 20 };
    expect(checkWallCollision(head, gridSize)).toBe(true);
  });

  it("should return false when snake head is inside grid", () => {
    const head = { x: 10, y: 10 };
    expect(checkWallCollision(head, gridSize)).toBe(false);
  });

  it("should return false when snake head is at grid edge (inside)", () => {
    expect(checkWallCollision({ x: 0, y: 0 }, gridSize)).toBe(false);
    expect(checkWallCollision({ x: 19, y: 19 }, gridSize)).toBe(false);
  });
});

describe("checkSelfCollision", () => {
  it("should return true when snake head collides with body", () => {
    const snake = [
      { x: 5, y: 5 }, // head
      { x: 4, y: 5 },
      { x: 4, y: 6 },
      { x: 5, y: 6 },
      { x: 5, y: 5 }, // body segment at same position as head
    ];
    // After moving, if head position matches any body segment
    const headAtBodyPosition = [
      { x: 4, y: 5 }, // new head position
      { x: 5, y: 5 },
      { x: 4, y: 5 }, // collision here
      { x: 4, y: 6 },
    ];
    expect(checkSelfCollision(headAtBodyPosition)).toBe(true);
  });

  it("should return false when snake has no self collision", () => {
    const snake = [
      { x: 5, y: 5 },
      { x: 4, y: 5 },
      { x: 3, y: 5 },
    ];
    expect(checkSelfCollision(snake)).toBe(false);
  });

  it("should return false for a snake with only 3 segments", () => {
    const snake = [
      { x: 10, y: 10 },
      { x: 9, y: 10 },
      { x: 8, y: 10 },
    ];
    expect(checkSelfCollision(snake)).toBe(false);
  });

  it("should return true when head position matches any body segment", () => {
    const snake = [
      { x: 5, y: 5 }, // head
      { x: 6, y: 5 },
      { x: 6, y: 6 },
      { x: 5, y: 6 },
      { x: 5, y: 5 }, // tail at same position as head
    ];
    expect(checkSelfCollision(snake)).toBe(true);
  });
});

describe("getNewDirection", () => {
  it("should allow changing from right to up", () => {
    const current = { x: 1, y: 0 }; // right
    const input = { x: 0, y: -1 }; // up
    expect(getNewDirection(current, input)).toEqual({ x: 0, y: -1 });
  });

  it("should allow changing from right to down", () => {
    const current = { x: 1, y: 0 }; // right
    const input = { x: 0, y: 1 }; // down
    expect(getNewDirection(current, input)).toEqual({ x: 0, y: 1 });
  });

  it("should prevent 180-degree turn from right to left", () => {
    const current = { x: 1, y: 0 }; // right
    const input = { x: -1, y: 0 }; // left (opposite)
    expect(getNewDirection(current, input)).toEqual({ x: 1, y: 0 }); // stays right
  });

  it("should prevent 180-degree turn from up to down", () => {
    const current = { x: 0, y: -1 }; // up
    const input = { x: 0, y: 1 }; // down (opposite)
    expect(getNewDirection(current, input)).toEqual({ x: 0, y: -1 }); // stays up
  });

  it("should prevent 180-degree turn from left to right", () => {
    const current = { x: -1, y: 0 }; // left
    const input = { x: 1, y: 0 }; // right (opposite)
    expect(getNewDirection(current, input)).toEqual({ x: -1, y: 0 }); // stays left
  });

  it("should prevent 180-degree turn from down to up", () => {
    const current = { x: 0, y: 1 }; // down
    const input = { x: 0, y: -1 }; // up (opposite)
    expect(getNewDirection(current, input)).toEqual({ x: 0, y: 1 }); // stays down
  });
});

describe("checkFoodCollision", () => {
  it("should return true when head position matches food position", () => {
    const head = { x: 10, y: 10 };
    const food = { x: 10, y: 10 };
    expect(checkFoodCollision(head, food)).toBe(true);
  });

  it("should return false when head and food are at different positions", () => {
    const head = { x: 10, y: 10 };
    const food = { x: 11, y: 10 };
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
  it("should spawn food at valid grid position", () => {
    const gridSize = 20;
    const snake = [
      { x: 10, y: 10 },
      { x: 9, y: 10 },
      { x: 8, y: 10 },
    ];
    const random = () => 0.5; // deterministic random for testing

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
    // Use a random function that returns different values - first attempt hits snake, second is valid
    let callCount = 0;
    const random = () => {
      callCount++;
      if (callCount <= 2) {
        return 0.5; // Will generate (10, 10) which is on snake head
      }
      return 0.3; // Will generate (6, 6) which is valid
    };

    const food = spawnFood(gridSize, snake, random);

    // Check that food is not on any snake segment
    const isOnSnake = snake.some(
      (segment) => segment.x === food.x && segment.y === food.y,
    );
    expect(isOnSnake).toBe(false);
  });

  it("should use provided random function", () => {
    const gridSize = 20;
    const snake = [{ x: 10, y: 10 }];
    // Random returns 0.25, so position should be 0.25 * 20 = 5 for both x and y
    const random = () => 0.25;

    const food = spawnFood(gridSize, snake, random);

    expect(food.x).toBe(5);
    expect(food.y).toBe(5);
  });

  it("should find valid position even when initial random hits snake", () => {
    const gridSize = 20;
    const snake = [
      { x: 5, y: 5 },
      { x: 4, y: 5 },
    ];

    // First call returns position that collides with snake, second call returns valid position
    let callCount = 0;
    const random = () => {
      callCount++;
      if (callCount <= 2) {
        return 0.25; // Will generate (5, 5) which is on snake head
      }
      return 0.3; // Will generate (6, 6) which is valid
    };

    const food = spawnFood(gridSize, snake, random);

    // Should eventually find a valid position not on snake
    const isOnSnake = snake.some(
      (segment) => segment.x === food.x && segment.y === food.y,
    );
    expect(isOnSnake).toBe(false);
  });
});
