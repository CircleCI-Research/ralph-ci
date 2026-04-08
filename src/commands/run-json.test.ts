import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  loadTasks,
  selectNextTask,
  markTaskComplete,
  buildPromptContent,
  saveTasks,
  runJson,
  Task,
} from "./run-json.js";
import { FileSystem } from "../utils/file-helpers.js";
import type { AgentRunner, ClaudeResponse } from "../utils/claude-runner.js";

class MockFileSystem implements FileSystem {
  private files: Map<string, string> = new Map();

  async writeFile(filePath: string, content: string): Promise<void> {
    this.files.set(filePath, content);
  }

  async readFile(filePath: string): Promise<string> {
    const content = this.files.get(filePath);
    if (content === undefined) {
      throw new Error(`ENOENT: no such file or directory, open '${filePath}'`);
    }
    return content;
  }

  async exists(filePath: string): Promise<boolean> {
    // Check if it's an exact file match
    if (this.files.has(filePath)) {
      return true;
    }
    // Check if it's a directory (has files under it)
    const dirPrefix = filePath.endsWith("/") ? filePath : filePath + "/";
    for (const key of this.files.keys()) {
      if (key.startsWith(dirPrefix)) {
        return true;
      }
    }
    return false;
  }

  async mkdir(
    _dirPath: string,
    _options?: { recursive?: boolean },
  ): Promise<void> {
    // No-op for tests
  }

  setFile(filePath: string, content: string): void {
    this.files.set(filePath, content);
  }

  getFile(filePath: string): string | undefined {
    return this.files.get(filePath);
  }
}

describe("run-json helpers", () => {
  let mockFs: MockFileSystem;

  beforeEach(() => {
    mockFs = new MockFileSystem();
  });

  describe("loadTasks", () => {
    it("should load and validate a valid tasks.json", async () => {
      const tasksJson = [
        {
          category: "setup",
          description: "Setup project",
          steps: ["Step 1", "Step 2"],
          passes: false,
        },
        {
          category: "implementation",
          description: "Implement feature",
          steps: ["Step A"],
          passes: true,
        },
      ];

      mockFs.setFile("/test/tasks.json", JSON.stringify(tasksJson, null, 2));

      const tasks = await loadTasks("/test", mockFs);

      expect(tasks).toEqual(tasksJson);
      expect(tasks).toHaveLength(2);
    });

    it("should throw error if tasks.json is not valid JSON", async () => {
      mockFs.setFile("/test/tasks.json", "not valid json {");

      await expect(loadTasks("/test", mockFs)).rejects.toThrow(
        "tasks.json is not valid JSON",
      );
    });

    it("should throw error if tasks.json is not an array", async () => {
      mockFs.setFile("/test/tasks.json", JSON.stringify({ foo: "bar" }));

      await expect(loadTasks("/test", mockFs)).rejects.toThrow(
        "tasks.json must be a JSON array",
      );
    });

    it("should throw error if task is missing category field", async () => {
      const invalidTasks = [
        {
          description: "Test",
          steps: [],
          passes: false,
        },
      ];

      mockFs.setFile("/test/tasks.json", JSON.stringify(invalidTasks));

      await expect(loadTasks("/test", mockFs)).rejects.toThrow(
        "Task at index 0 missing required field: category (string)",
      );
    });

    it("should throw error if task is missing description field", async () => {
      const invalidTasks = [
        {
          category: "test",
          steps: [],
          passes: false,
        },
      ];

      mockFs.setFile("/test/tasks.json", JSON.stringify(invalidTasks));

      await expect(loadTasks("/test", mockFs)).rejects.toThrow(
        "Task at index 0 missing required field: description (string)",
      );
    });

    it("should throw error if task is missing steps field", async () => {
      const invalidTasks = [
        {
          category: "test",
          description: "Test",
          passes: false,
        },
      ];

      mockFs.setFile("/test/tasks.json", JSON.stringify(invalidTasks));

      await expect(loadTasks("/test", mockFs)).rejects.toThrow(
        "Task at index 0 missing required field: steps (array)",
      );
    });

    it("should throw error if task is missing passes field", async () => {
      const invalidTasks = [
        {
          category: "test",
          description: "Test",
          steps: [],
        },
      ];

      mockFs.setFile("/test/tasks.json", JSON.stringify(invalidTasks));

      await expect(loadTasks("/test", mockFs)).rejects.toThrow(
        "Task at index 0 missing required field: passes (boolean)",
      );
    });

    it("should allow additional fields beyond required ones", async () => {
      const tasksWithExtra = [
        {
          id: "task-1",
          category: "setup",
          description: "Setup",
          steps: ["Step 1"],
          passes: false,
          priority: "high",
        },
      ];

      mockFs.setFile("/test/tasks.json", JSON.stringify(tasksWithExtra));

      const tasks = await loadTasks("/test", mockFs);

      expect(tasks).toEqual(tasksWithExtra);
      expect(tasks[0]).toHaveProperty("id", "task-1");
      expect(tasks[0]).toHaveProperty("priority", "high");
    });
  });

  describe("selectNextTask", () => {
    it("should select the first task with passes !== true", () => {
      const tasks: Task[] = [
        {
          category: "setup",
          description: "Setup",
          steps: [],
          passes: true,
        },
        {
          category: "implementation",
          description: "Implement",
          steps: [],
          passes: false,
        },
        {
          category: "testing",
          description: "Test",
          steps: [],
          passes: false,
        },
      ];

      const result = selectNextTask(tasks);

      expect(result).not.toBeNull();
      expect(result?.index).toBe(1);
      expect(result?.task.description).toBe("Implement");
    });

    it("should return null if all tasks are complete", () => {
      const tasks: Task[] = [
        {
          category: "setup",
          description: "Setup",
          steps: [],
          passes: true,
        },
        {
          category: "implementation",
          description: "Implement",
          steps: [],
          passes: true,
        },
      ];

      const result = selectNextTask(tasks);

      expect(result).toBeNull();
    });

    it("should return null for empty task array", () => {
      const result = selectNextTask([]);

      expect(result).toBeNull();
    });

    it("should select first task if passes is false (not just !== true)", () => {
      const tasks: Task[] = [
        {
          category: "setup",
          description: "Setup",
          steps: [],
          passes: false,
        },
      ];

      const result = selectNextTask(tasks);

      expect(result).not.toBeNull();
      expect(result?.index).toBe(0);
    });
  });

  describe("markTaskComplete", () => {
    it("should mark the task at given index as complete", () => {
      const tasks: Task[] = [
        {
          category: "setup",
          description: "Setup",
          steps: [],
          passes: false,
        },
        {
          category: "implementation",
          description: "Implement",
          steps: [],
          passes: false,
        },
      ];

      const updated = markTaskComplete(tasks, 0);

      expect(updated[0].passes).toBe(true);
      expect(updated[1].passes).toBe(false);
      // Original should not be mutated
      expect(tasks[0].passes).toBe(false);
    });

    it("should preserve other task properties", () => {
      const tasks: Task[] = [
        {
          category: "setup",
          description: "Setup",
          steps: ["Step 1", "Step 2"],
          passes: false,
          customField: "value",
        },
      ];

      const updated = markTaskComplete(tasks, 0);

      expect(updated[0]).toEqual({
        category: "setup",
        description: "Setup",
        steps: ["Step 1", "Step 2"],
        passes: true,
        customField: "value",
      });
    });

    it("should throw error for invalid index (negative)", () => {
      const tasks: Task[] = [
        {
          category: "setup",
          description: "Setup",
          steps: [],
          passes: false,
        },
      ];

      expect(() => markTaskComplete(tasks, -1)).toThrow(
        "Invalid task index: -1",
      );
    });

    it("should throw error for invalid index (out of bounds)", () => {
      const tasks: Task[] = [
        {
          category: "setup",
          description: "Setup",
          steps: [],
          passes: false,
        },
      ];

      expect(() => markTaskComplete(tasks, 5)).toThrow("Invalid task index: 5");
    });
  });

  describe("buildPromptContent", () => {
    it("should build prompt content with task details", async () => {
      const promptTemplate = `@plan.md @activity.md @tasks.json

The CLI will insert the current task details here when invoking the agent.

## Additional Instructions

Do not edit tasks.json`;

      mockFs.setFile("/test/prompt.md", promptTemplate);

      const task: Task = {
        category: "implementation",
        description: "Implement feature X",
        steps: ["Step 1", "Step 2", "Step 3"],
        passes: false,
      };

      const result = await buildPromptContent("/test", task, 0, mockFs);

      expect(result).toContain("@plan.md @activity.md @tasks.json");
      expect(result).toContain("**Task Index:** 0");
      expect(result).toContain("**Category:** implementation");
      expect(result).toContain("**Description:** Implement feature X");
      expect(result).toContain("1. Step 1");
      expect(result).toContain("2. Step 2");
      expect(result).toContain("3. Step 3");
      expect(result).toContain(JSON.stringify(task, null, 2));
      expect(result).not.toContain(
        "The CLI will insert the current task details here when invoking the agent.",
      );
    });

    it("should use default template if prompt.md does not exist", async () => {
      const task: Task = {
        category: "setup",
        description: "Setup project",
        steps: ["Initialize"],
        passes: false,
      };

      const result = await buildPromptContent("/test", task, 2, mockFs);

      // Should contain elements from PROMPT_JSON_TEMPLATE
      expect(result).toContain("@plan.md @activity.md @tasks.json");
      expect(result).toContain("**Task Index:** 2");
      expect(result).toContain("**Category:** setup");
      expect(result).toContain("<promise>success</promise>");
    });

    it("should format steps as numbered list", async () => {
      mockFs.setFile(
        "/test/prompt.md",
        "The CLI will insert the current task details here when invoking the agent.",
      );

      const task: Task = {
        category: "test",
        description: "Test",
        steps: ["First", "Second", "Third"],
        passes: false,
      };

      const result = await buildPromptContent("/test", task, 0, mockFs);

      expect(result).toContain("1. First");
      expect(result).toContain("2. Second");
      expect(result).toContain("3. Third");
    });
  });

  describe("saveTasks", () => {
    it("should save tasks with proper JSON formatting and trailing newline", async () => {
      const tasks: Task[] = [
        {
          category: "setup",
          description: "Setup",
          steps: ["Step 1"],
          passes: true,
        },
        {
          category: "implementation",
          description: "Implement",
          steps: ["Step A", "Step B"],
          passes: false,
        },
      ];

      await saveTasks("/test", tasks, mockFs);

      const saved = mockFs.getFile("/test/tasks.json");
      expect(saved).toBeDefined();

      // Check formatting: 2-space indentation
      expect(saved).toContain('  "category": "setup"');
      expect(saved).toContain('  "steps": [');

      // Check trailing newline
      expect(saved?.endsWith("\n")).toBe(true);

      // Verify it's valid JSON
      const parsed = JSON.parse(saved!);
      expect(parsed).toEqual(tasks);
    });

    it("should preserve additional fields when saving", async () => {
      const tasks: Task[] = [
        {
          id: "task-1",
          category: "setup",
          description: "Setup",
          steps: [],
          passes: false,
          customField: "value",
        },
      ];

      await saveTasks("/test", tasks, mockFs);

      const saved = mockFs.getFile("/test/tasks.json");
      const parsed = JSON.parse(saved!);

      expect(parsed[0]).toHaveProperty("id", "task-1");
      expect(parsed[0]).toHaveProperty("customField", "value");
    });
  });

  describe("runJson", () => {
    let mockFs: MockFileSystem;
    let mockRunner: AgentRunner;
    let mockExit: ReturnType<typeof vi.spyOn>;
    let mockConsoleLog: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      mockFs = new MockFileSystem();
      mockExit = vi
        .spyOn(process, "exit")
        .mockImplementation((() => {}) as never);
      mockConsoleLog = vi.spyOn(console, "log").mockImplementation(() => {});

      // Clear mock call history before each test
      mockExit.mockClear();
      mockConsoleLog.mockClear();

      // Setup working directory (directory itself must exist)
      mockFs.setFile("/test/.placeholder", "");

      // Setup required files
      mockFs.setFile("/test/plan.md", "# Plan");
      mockFs.setFile(
        "/test/prompt.md",
        "The CLI will insert the current task details here when invoking the agent.",
      );
      mockFs.setFile("/test/activity.md", "# Activity");
    });

    it("should exit 0 when all tasks are already complete", async () => {
      const completeTasks: Task[] = [
        {
          category: "setup",
          description: "Setup",
          steps: ["Step 1"],
          passes: true,
        },
        {
          category: "implementation",
          description: "Implement",
          steps: ["Step A"],
          passes: true,
        },
      ];

      mockFs.setFile(
        "/test/tasks.json",
        JSON.stringify(completeTasks, null, 2),
      );

      mockRunner = {
        runClaude: vi.fn(),
      };

      await runJson(
        { workingDirectory: "/test", maxIterations: 5 },
        mockRunner,
        mockFs,
      );

      expect(mockExit).toHaveBeenCalledWith(0);
      expect(mockRunner.runClaude).not.toHaveBeenCalled();
    });

    it("should mark task complete and persist when <promise>success</promise> is found", async () => {
      const tasks: Task[] = [
        {
          category: "setup",
          description: "Setup project",
          steps: ["Step 1"],
          passes: false,
        },
      ];

      mockFs.setFile("/test/tasks.json", JSON.stringify(tasks, null, 2));

      const mockResponse: ClaudeResponse = {
        result: "Task completed successfully. <promise>success</promise>",
        usage: {
          input_tokens: 100,
          output_tokens: 50,
          cache_read_input_tokens: 0,
        },
        total_cost_usd: 0.01,
      };

      mockRunner = {
        runClaude: vi.fn().mockResolvedValue(mockResponse),
      };

      await runJson(
        { workingDirectory: "/test", maxIterations: 5 },
        mockRunner,
        mockFs,
      );

      // Should have called runner with promptContent
      expect(mockRunner.runClaude).toHaveBeenCalledTimes(1);
      expect(mockRunner.runClaude).toHaveBeenCalledWith({
        promptContent: expect.stringContaining("Setup project"),
        workingDirectory: "/test",
      });

      // Should have marked task as complete
      const savedTasks = JSON.parse(mockFs.getFile("/test/tasks.json")!);
      expect(savedTasks[0].passes).toBe(true);

      // Should exit 0 after completing all tasks
      expect(mockExit).toHaveBeenCalledWith(0);
    });

    it("should retry incomplete task on next attempt if no success promise found", async () => {
      const tasks: Task[] = [
        {
          category: "setup",
          description: "Setup project",
          steps: ["Step 1"],
          passes: false,
        },
      ];

      mockFs.setFile("/test/tasks.json", JSON.stringify(tasks, null, 2));

      const mockResponse: ClaudeResponse = {
        result: "Task not completed yet.",
        usage: {
          input_tokens: 100,
          output_tokens: 50,
          cache_read_input_tokens: 0,
        },
        total_cost_usd: 0.01,
      };

      mockRunner = {
        runClaude: vi.fn().mockResolvedValue(mockResponse),
      };

      await runJson(
        { workingDirectory: "/test", maxIterations: 2 },
        mockRunner,
        mockFs,
      );

      // Should have called runner twice (retrying same task)
      expect(mockRunner.runClaude).toHaveBeenCalledTimes(2);

      // Task should still be incomplete
      const savedTasks = JSON.parse(mockFs.getFile("/test/tasks.json")!);
      expect(savedTasks[0].passes).toBe(false);

      // Should exit 1 after max attempts
      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it("should process multiple tasks in sequence", async () => {
      const tasks: Task[] = [
        {
          category: "setup",
          description: "Task 1",
          steps: ["Step 1"],
          passes: false,
        },
        {
          category: "implementation",
          description: "Task 2",
          steps: ["Step A"],
          passes: false,
        },
      ];

      mockFs.setFile("/test/tasks.json", JSON.stringify(tasks, null, 2));

      const successResponse: ClaudeResponse = {
        result: "Done! <promise>success</promise>",
        usage: {
          input_tokens: 100,
          output_tokens: 50,
          cache_read_input_tokens: 0,
        },
        total_cost_usd: 0.01,
      };

      mockRunner = {
        runClaude: vi.fn().mockResolvedValue(successResponse),
      };

      await runJson(
        { workingDirectory: "/test", maxIterations: 5 },
        mockRunner,
        mockFs,
      );

      // Should have called runner twice (once per task)
      expect(mockRunner.runClaude).toHaveBeenCalledTimes(2);

      // First call should be for task 1
      expect(mockRunner.runClaude).toHaveBeenNthCalledWith(1, {
        promptContent: expect.stringContaining("Task 1"),
        workingDirectory: "/test",
      });

      // Second call should be for task 2
      expect(mockRunner.runClaude).toHaveBeenNthCalledWith(2, {
        promptContent: expect.stringContaining("Task 2"),
        workingDirectory: "/test",
      });

      // Both tasks should be marked complete
      const savedTasks = JSON.parse(mockFs.getFile("/test/tasks.json")!);
      expect(savedTasks[0].passes).toBe(true);
      expect(savedTasks[1].passes).toBe(true);

      // Should exit 0 after completing all tasks
      expect(mockExit).toHaveBeenCalledWith(0);
    });

    it("should exit 1 when max attempts reached with incomplete tasks", async () => {
      const tasks: Task[] = [
        {
          category: "setup",
          description: "Task 1",
          steps: ["Step 1"],
          passes: false,
        },
        {
          category: "implementation",
          description: "Task 2",
          steps: ["Step A"],
          passes: false,
        },
      ];

      mockFs.setFile("/test/tasks.json", JSON.stringify(tasks, null, 2));

      const mockResponse: ClaudeResponse = {
        result: "Not done yet.",
        usage: {
          input_tokens: 100,
          output_tokens: 50,
          cache_read_input_tokens: 0,
        },
        total_cost_usd: 0.01,
      };

      mockRunner = {
        runClaude: vi.fn().mockResolvedValue(mockResponse),
      };

      await runJson(
        { workingDirectory: "/test", maxIterations: 3 },
        mockRunner,
        mockFs,
      );

      // Should have called runner 3 times (max attempts)
      expect(mockRunner.runClaude).toHaveBeenCalledTimes(3);

      // All calls should be for task 1 (never completed)
      for (let i = 1; i <= 3; i++) {
        expect(mockRunner.runClaude).toHaveBeenNthCalledWith(i, {
          promptContent: expect.stringContaining("Task 1"),
          workingDirectory: "/test",
        });
      }

      // Tasks should still be incomplete
      const savedTasks = JSON.parse(mockFs.getFile("/test/tasks.json")!);
      expect(savedTasks[0].passes).toBe(false);
      expect(savedTasks[1].passes).toBe(false);

      // Should exit 1
      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it("should throw error if required files are missing", async () => {
      // Only create plan.md, missing other required files
      mockFs.setFile("/test/plan.md", "# Plan");

      mockRunner = {
        runClaude: vi.fn(),
      };

      await expect(
        runJson(
          { workingDirectory: "/test", maxIterations: 5 },
          mockRunner,
          mockFs,
        ),
      ).rejects.toThrow("Missing required files");
    });

    it("should throw error if tasks.json is invalid", async () => {
      mockFs.setFile("/test/plan.md", "# Plan");
      mockFs.setFile("/test/prompt.md", "# Prompt");
      mockFs.setFile("/test/activity.md", "# Activity");
      mockFs.setFile("/test/tasks.json", "invalid json {");

      mockRunner = {
        runClaude: vi.fn(),
      };

      await expect(
        runJson(
          { workingDirectory: "/test", maxIterations: 5 },
          mockRunner,
          mockFs,
        ),
      ).rejects.toThrow("Failed to load tasks.json");
    });

    it("should mark task complete by index, not by content matching", async () => {
      const tasks: Task[] = [
        {
          category: "setup",
          description: "Same description",
          steps: ["Step 1"],
          passes: true,
        },
        {
          category: "implementation",
          description: "Same description",
          steps: ["Step 2"],
          passes: false,
        },
      ];

      mockFs.setFile("/test/tasks.json", JSON.stringify(tasks, null, 2));

      const successResponse: ClaudeResponse = {
        result: "Done! <promise>success</promise>",
        usage: {
          input_tokens: 100,
          output_tokens: 50,
          cache_read_input_tokens: 0,
        },
        total_cost_usd: 0.01,
      };

      mockRunner = {
        runClaude: vi.fn().mockResolvedValue(successResponse),
      };

      await runJson(
        { workingDirectory: "/test", maxIterations: 5 },
        mockRunner,
        mockFs,
      );

      // Should have marked the second task (index 1) as complete
      const savedTasks = JSON.parse(mockFs.getFile("/test/tasks.json")!);
      expect(savedTasks[0].passes).toBe(true); // Was already true
      expect(savedTasks[1].passes).toBe(true); // Now marked true

      expect(mockExit).toHaveBeenCalledWith(0);
    });

    it("should log per-attempt token stats when usage is non-zero (Claude runner)", async () => {
      const tasks: Task[] = [
        {
          category: "setup",
          description: "Task 1",
          steps: ["Step 1"],
          passes: false,
        },
      ];

      mockFs.setFile("/test/tasks.json", JSON.stringify(tasks, null, 2));

      const mockResponse: ClaudeResponse = {
        result: "Done! <promise>success</promise>",
        usage: {
          input_tokens: 1500,
          output_tokens: 750,
          cache_read_input_tokens: 300,
        },
        total_cost_usd: 0.0234,
      };

      mockRunner = {
        runClaude: vi.fn().mockResolvedValue(mockResponse),
      };

      await runJson(
        { workingDirectory: "/test", maxIterations: 5 },
        mockRunner,
        mockFs,
      );

      // Should log per-attempt stats
      expect(mockConsoleLog).toHaveBeenCalledWith("Tokens In: 1500");
      expect(mockConsoleLog).toHaveBeenCalledWith("Tokens Out: 750");
      expect(mockConsoleLog).toHaveBeenCalledWith("Cache Read: 300");
      expect(mockConsoleLog).toHaveBeenCalledWith("Cost: $0.0234");

      // Should log cumulative stats
      expect(mockConsoleLog).toHaveBeenCalledWith("\nCumulative Stats:");
      expect(mockConsoleLog).toHaveBeenCalledWith("Total Tokens In: 1500");
      expect(mockConsoleLog).toHaveBeenCalledWith("Total Tokens Out: 750");
      expect(mockConsoleLog).toHaveBeenCalledWith("Total Cache Read: 300");
      expect(mockConsoleLog).toHaveBeenCalledWith("Total Cost: $0.0234");
    });

    it("should log duration when available but no token stats (Cursor runner)", async () => {
      const tasks: Task[] = [
        {
          category: "setup",
          description: "Task 1",
          steps: ["Step 1"],
          passes: false,
        },
      ];

      mockFs.setFile("/test/tasks.json", JSON.stringify(tasks, null, 2));

      const mockResponse: ClaudeResponse = {
        result: "Done! <promise>success</promise>",
        usage: {
          input_tokens: 0,
          output_tokens: 0,
          cache_read_input_tokens: 0,
        },
        total_cost_usd: 0,
        duration_ms: 5432,
      };

      mockRunner = {
        runClaude: vi.fn().mockResolvedValue(mockResponse),
      };

      await runJson(
        { workingDirectory: "/test", maxIterations: 5 },
        mockRunner,
        mockFs,
      );

      // Should log duration instead of token stats
      expect(mockConsoleLog).toHaveBeenCalledWith("Duration: 5432ms");

      // Should NOT log token stats
      expect(mockConsoleLog).not.toHaveBeenCalledWith(
        expect.stringContaining("Tokens In:"),
      );
      expect(mockConsoleLog).not.toHaveBeenCalledWith(
        expect.stringContaining("Cost:"),
      );
    });

    it("should accumulate stats across multiple attempts", async () => {
      const tasks: Task[] = [
        {
          category: "setup",
          description: "Task 1",
          steps: ["Step 1"],
          passes: false,
        },
        {
          category: "implementation",
          description: "Task 2",
          steps: ["Step 2"],
          passes: false,
        },
      ];

      mockFs.setFile("/test/tasks.json", JSON.stringify(tasks, null, 2));

      const mockResponse1: ClaudeResponse = {
        result: "Done! <promise>success</promise>",
        usage: {
          input_tokens: 1000,
          output_tokens: 500,
          cache_read_input_tokens: 100,
        },
        total_cost_usd: 0.01,
      };

      const mockResponse2: ClaudeResponse = {
        result: "Done! <promise>success</promise>",
        usage: {
          input_tokens: 2000,
          output_tokens: 1000,
          cache_read_input_tokens: 200,
        },
        total_cost_usd: 0.02,
      };

      mockRunner = {
        runClaude: vi
          .fn()
          .mockResolvedValueOnce(mockResponse1)
          .mockResolvedValueOnce(mockResponse2),
      };

      await runJson(
        { workingDirectory: "/test", maxIterations: 5 },
        mockRunner,
        mockFs,
      );

      // After first attempt, cumulative should match first response
      expect(mockConsoleLog).toHaveBeenCalledWith("Total Tokens In: 1000");
      expect(mockConsoleLog).toHaveBeenCalledWith("Total Tokens Out: 500");
      expect(mockConsoleLog).toHaveBeenCalledWith("Total Cache Read: 100");
      expect(mockConsoleLog).toHaveBeenCalledWith("Total Cost: $0.0100");

      // After second attempt, cumulative should be sum of both
      expect(mockConsoleLog).toHaveBeenCalledWith("Total Tokens In: 3000");
      expect(mockConsoleLog).toHaveBeenCalledWith("Total Tokens Out: 1500");
      expect(mockConsoleLog).toHaveBeenCalledWith("Total Cache Read: 300");
      expect(mockConsoleLog).toHaveBeenCalledWith("Total Cost: $0.0300");
    });

    it("should print attempt banner exactly once per runner call (no extra banners after completion)", async () => {
      // Regression test for: attempt banner should only print when a task is selected,
      // not after all tasks are complete
      const tasks: Task[] = [
        {
          category: "setup",
          description: "Task 1",
          steps: ["Step 1"],
          passes: false,
        },
        {
          category: "implementation",
          description: "Task 2",
          steps: ["Step 2"],
          passes: false,
        },
        {
          category: "docs",
          description: "Task 3",
          steps: ["Step 3"],
          passes: false,
        },
      ];

      mockFs.setFile("/test/tasks.json", JSON.stringify(tasks, null, 2));

      const successResponse: ClaudeResponse = {
        result: "Done! <promise>success</promise>",
        usage: {
          input_tokens: 100,
          output_tokens: 50,
          cache_read_input_tokens: 0,
        },
        total_cost_usd: 0.01,
      };

      mockRunner = {
        runClaude: vi.fn().mockResolvedValue(successResponse),
      };

      await runJson(
        { workingDirectory: "/test", maxIterations: 10 },
        mockRunner,
        mockFs,
      );

      // Should have called runner exactly 3 times (once per task)
      expect(mockRunner.runClaude).toHaveBeenCalledTimes(3);

      // Count how many times the attempt banner was logged
      const attemptBannerCalls = mockConsoleLog.mock.calls.filter(
        (call) => call[0] && call[0].toString().includes("--- Attempt"),
      );

      // Should have exactly 3 attempt banners (one per runner call, no extra banner after completion)
      expect(attemptBannerCalls).toHaveLength(3);
      expect(attemptBannerCalls[0][0]).toContain("--- Attempt 1/10 ---");
      expect(attemptBannerCalls[1][0]).toContain("--- Attempt 2/10 ---");
      expect(attemptBannerCalls[2][0]).toContain("--- Attempt 3/10 ---");

      // Should exit 0 after all tasks complete
      expect(mockExit).toHaveBeenCalledWith(0);
    });
  });
});
