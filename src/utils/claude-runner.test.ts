import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  DefaultClaudeRunner,
  transformFileReferences,
} from "./claude-runner.js";
import { spawn } from "child_process";
import { EventEmitter } from "events";

// Mock fs/promises
vi.mock("fs/promises", () => ({
  readFile: vi.fn(),
  writeFile: vi.fn().mockResolvedValue(undefined),
  mkdtemp: vi.fn().mockResolvedValue("/tmp/ralphci-test123"),
  rm: vi.fn().mockResolvedValue(undefined),
}));

// Mock child_process
vi.mock("child_process", () => ({
  spawn: vi.fn(),
}));

function createMockSpawn(jsonResponse: object, streamMode = false) {
  const mockProcess = new EventEmitter() as ReturnType<typeof spawn> & {
    stdout: EventEmitter;
    stderr: EventEmitter;
  };
  mockProcess.stdout = new EventEmitter();
  mockProcess.stderr = new EventEmitter();

  vi.mocked(spawn).mockImplementation(() => {
    // Emit the response asynchronously
    setTimeout(() => {
      if (streamMode) {
        // Emit stream-json events (line-delimited JSON)
        const resp = jsonResponse as {
          result: string;
          usage: object;
          total_cost_usd: number;
          model?: string;
        };
        mockProcess.stdout.emit(
          "data",
          JSON.stringify({ type: "result", ...resp }) + "\n",
        );
      } else {
        mockProcess.stdout.emit("data", JSON.stringify(jsonResponse));
      }
      mockProcess.emit("close", 0);
    }, 0);
    return mockProcess;
  });

  return mockProcess;
}

describe("DefaultClaudeRunner", () => {
  let runner: DefaultClaudeRunner;

  beforeEach(() => {
    vi.clearAllMocks();
    runner = new DefaultClaudeRunner();
  });

  describe("transformFileReferences utility", () => {
    it("should transform @ references when working directory is not current directory", () => {
      const content = "@plan.md @activity.md\n\nSome instructions here.";
      const result = transformFileReferences(content, "features/auth");
      expect(result).toBe(
        "@features/auth/plan.md @features/auth/activity.md\n\nSome instructions here.",
      );
    });

    it("should not transform @ references when working directory is current directory (.)", () => {
      const content = "@plan.md @activity.md\n\nSome instructions here.";
      const result = transformFileReferences(content, ".");
      expect(result).toBe("@plan.md @activity.md\n\nSome instructions here.");
    });

    it("should not transform @ references when working directory is current directory (./)", () => {
      const content = "@plan.md @activity.md\n\nSome instructions here.";
      const result = transformFileReferences(content, "./");
      expect(result).toBe("@plan.md @activity.md\n\nSome instructions here.");
    });

    it("should normalize working directory by removing trailing slashes", () => {
      const content = "@plan.md";
      const result = transformFileReferences(content, "features/auth/");
      expect(result).toBe("@features/auth/plan.md");
    });

    it("should transform .md and .json file references", () => {
      const content = "@plan.md @README.md @config.json @tasks.json";
      const result = transformFileReferences(content, "features/auth");
      expect(result).toBe(
        "@features/auth/plan.md @features/auth/README.md @features/auth/config.json @features/auth/tasks.json",
      );
    });

    it("should not transform @ references that are not .md or .json files", () => {
      const content =
        "@plan.md @anthropic/sdk @user@example.com @something-else @config.json";
      const result = transformFileReferences(content, "features/auth");
      expect(result).toBe(
        "@features/auth/plan.md @anthropic/sdk @user@example.com @something-else @features/auth/config.json",
      );
    });
  });

  describe("runClaude", () => {
    const validResponse = {
      result: "Success",
      usage: {
        input_tokens: 100,
        output_tokens: 50,
        cache_read_input_tokens: 0,
      },
      total_cost_usd: 0.01,
    };

    it("should spawn claude with stream-json by default (verbose=true)", async () => {
      const promptContent = "@plan.md\n\nWork on this task.";
      const workingDirectory = "features/auth";

      createMockSpawn(validResponse, true);

      await runner.runClaude({
        promptContent,
        workingDirectory,
      });

      expect(vi.mocked(spawn)).toHaveBeenCalledWith(
        "claude",
        [
          "/tmp/ralphci-test123/prompt.md",
          "--output-format",
          "stream-json",
          "--dangerously-skip-permissions",
          "--print",
          "--verbose",
        ],
        expect.objectContaining({
          cwd: workingDirectory,
          stdio: ["ignore", "pipe", "pipe"],
        }),
      );
    });

    it("should spawn claude with json when verbose=false", async () => {
      const promptContent = "@plan.md\n\nWork on this task.";
      const workingDirectory = "features/auth";

      createMockSpawn(validResponse, false);

      await runner.runClaude({
        promptContent,
        workingDirectory,
        verbose: false,
      });

      expect(vi.mocked(spawn)).toHaveBeenCalledWith(
        "claude",
        [
          "/tmp/ralphci-test123/prompt.md",
          "--output-format",
          "json",
          "--dangerously-skip-permissions",
          "--print",
        ],
        expect.objectContaining({
          cwd: workingDirectory,
          stdio: ["ignore", "pipe", "pipe"],
        }),
      );
    });

    it("should return parsed response from stream-json (verbose=true)", async () => {
      createMockSpawn(validResponse, true);

      const result = await runner.runClaude({
        promptContent: "Test prompt",
        workingDirectory: ".",
      });

      expect(result).toEqual({
        result: "Success",
        usage: {
          input_tokens: 100,
          output_tokens: 50,
          cache_read_input_tokens: 0,
        },
        total_cost_usd: 0.01,
      });
    });

    it("should return parsed response from json (verbose=false)", async () => {
      createMockSpawn(validResponse, false);

      const result = await runner.runClaude({
        promptContent: "Test prompt",
        workingDirectory: ".",
        verbose: false,
      });

      expect(result).toEqual({
        result: "Success",
        usage: {
          input_tokens: 100,
          output_tokens: 50,
          cache_read_input_tokens: 0,
        },
        total_cost_usd: 0.01,
      });
    });

    it("should throw error when both promptPath and promptContent are provided", async () => {
      await expect(
        runner.runClaude({
          promptPath: "/path/to/prompt.md",
          promptContent: "Some content",
          workingDirectory: ".",
        }),
      ).rejects.toThrow(
        "Exactly one of promptPath or promptContent must be provided",
      );
    });

    it("should throw error when neither promptPath nor promptContent are provided", async () => {
      await expect(
        runner.runClaude({
          workingDirectory: ".",
        }),
      ).rejects.toThrow(
        "Exactly one of promptPath or promptContent must be provided",
      );
    });
  });
});
