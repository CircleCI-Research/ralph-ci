import { describe, it, expect, beforeEach, vi } from "vitest";
import { run } from "./run.js";
import { AgentRunner, AgentResponse } from "../utils/claude-runner.js";
import { CommandError } from "../utils/errors.js";
import * as validation from "../utils/validation.js";
import * as config from "../utils/config.js";
import * as path from "path";

// Mock validation module
vi.mock("../utils/validation.js", () => ({
  validateWorkingDirectory: vi.fn(),
  validateRequiredFiles: vi.fn(),
}));

// Mock config module
vi.mock("../utils/config.js", () => ({
  loadConfig: vi.fn(),
}));

// Mock process.exit to throw a predictable error
const mockExit = vi
  .spyOn(process, "exit")
  .mockImplementation((code?: string | number | null | undefined) => {
    throw new Error(`process.exit(${code})`);
  }) as any;

describe("run command", () => {
  const testDir = "/test/dir";

  beforeEach(() => {
    vi.clearAllMocks();
    mockExit.mockClear();
  });

  it("should validate working directory exists", async () => {
    vi.mocked(validation.validateWorkingDirectory).mockRejectedValue(
      new Error("Working directory does not exist"),
    );

    await expect(
      run({
        workingDirectory: testDir,
        maxIterations: 5,
      }),
    ).rejects.toThrow();
  });

  it("should validate required files exist", async () => {
    vi.mocked(validation.validateWorkingDirectory).mockResolvedValue();
    vi.mocked(validation.validateRequiredFiles).mockResolvedValue({
      valid: false,
      missing: ["plan.md", "prompt.md"],
    });

    // Mock config
    vi.mocked(config.loadConfig).mockResolvedValue({
      config: {
        runner: "claude",
      },
      source: "default",
    });

    await expect(
      run({
        workingDirectory: testDir,
        maxIterations: 5,
      }),
    ).rejects.toThrow(CommandError);
  });

  it("should run loop and exit with code 0 when COMPLETE is found", async () => {
    // Mock validation
    vi.mocked(validation.validateWorkingDirectory).mockResolvedValue();
    vi.mocked(validation.validateRequiredFiles).mockResolvedValue({
      valid: true,
      missing: [],
    });

    // Mock Claude runner
    const mockRunner: AgentRunner = {
      runClaude: vi.fn().mockResolvedValue({
        result: "Task is done. <promise>COMPLETE</promise>",
        usage: {
          input_tokens: 1000,
          output_tokens: 500,
          cache_read_input_tokens: 200,
        },
        total_cost_usd: 0.05,
      } as AgentResponse),
    };

    // Should exit with code 0
    await expect(
      run(
        {
          workingDirectory: testDir,
          maxIterations: 5,
        },
        mockRunner,
      ),
    ).rejects.toThrow(CommandError);

    // Verify process.exit was called with 0
    expect(mockExit).toHaveBeenCalledWith(0);

    // Verify Claude runner was called once
    expect(mockRunner.runClaude).toHaveBeenCalledTimes(1);
    expect(mockRunner.runClaude).toHaveBeenCalledWith({
      promptPath: path.join(testDir, "prompt.md"),
      workingDirectory: testDir,
    });
  });

  it("should run loop and exit with code 1 when max iterations reached", async () => {
    // Mock validation
    vi.mocked(validation.validateWorkingDirectory).mockResolvedValue();
    vi.mocked(validation.validateRequiredFiles).mockResolvedValue({
      valid: true,
      missing: [],
    });

    // Mock Claude runner (never returns COMPLETE)
    const mockRunner: AgentRunner = {
      runClaude: vi.fn().mockResolvedValue({
        result: "Still working on it...",
        usage: {
          input_tokens: 1000,
          output_tokens: 500,
          cache_read_input_tokens: 200,
        },
        total_cost_usd: 0.05,
      } as AgentResponse),
    };

    // Should exit with code 1 after max iterations
    await expect(
      run(
        {
          workingDirectory: testDir,
          maxIterations: 3,
        },
        mockRunner,
      ),
    ).rejects.toThrow();

    // Verify process.exit was called with 1
    expect(mockExit).toHaveBeenCalledWith(1);

    // Verify Claude runner was called 3 times
    expect(mockRunner.runClaude).toHaveBeenCalledTimes(3);
  });

  it("should track cumulative stats across iterations", async () => {
    // Mock validation
    vi.mocked(validation.validateWorkingDirectory).mockResolvedValue();
    vi.mocked(validation.validateRequiredFiles).mockResolvedValue({
      valid: true,
      missing: [],
    });

    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    // Mock Claude runner with different stats for each iteration
    let callCount = 0;
    const mockRunner: AgentRunner = {
      runClaude: vi.fn().mockImplementation(async () => {
        callCount++;
        return {
          result: "Working...",
          usage: {
            input_tokens: 1000 * callCount,
            output_tokens: 500 * callCount,
            cache_read_input_tokens: 200 * callCount,
          },
          total_cost_usd: 0.05 * callCount,
        } as AgentResponse;
      }),
    };

    // Run for 2 iterations
    await expect(
      run(
        {
          workingDirectory: testDir,
          maxIterations: 2,
        },
        mockRunner,
      ),
    ).rejects.toThrow();

    // Verify process.exit was called with 1
    expect(mockExit).toHaveBeenCalledWith(1);

    // Verify cumulative stats were logged
    const logs = consoleSpy.mock.calls.map((call) => call[0]);

    // After iteration 1: cumulative should be 1000, 500, 200, $0.05
    expect(logs).toContain("Total Tokens In: 1000");
    expect(logs).toContain("Total Tokens Out: 500");
    expect(logs).toContain("Total Cache Read: 200");
    expect(logs).toContain("Total Cost: $0.0500");

    // After iteration 2: cumulative should be 3000, 1500, 600, $0.15
    expect(logs).toContain("Total Tokens In: 3000");
    expect(logs).toContain("Total Tokens Out: 1500");
    expect(logs).toContain("Total Cache Read: 600");
    expect(logs).toContain("Total Cost: $0.1500");

    consoleSpy.mockRestore();
  });

  it("should handle Claude CLI errors gracefully", async () => {
    // Mock validation
    vi.mocked(validation.validateWorkingDirectory).mockResolvedValue();
    vi.mocked(validation.validateRequiredFiles).mockResolvedValue({
      valid: true,
      missing: [],
    });

    // Mock Claude runner that throws an error
    const mockRunner: AgentRunner = {
      runClaude: vi.fn().mockRejectedValue(new Error("Claude CLI failed")),
    };

    await expect(
      run(
        {
          workingDirectory: testDir,
          maxIterations: 5,
        },
        mockRunner,
      ),
    ).rejects.toThrow(CommandError);
  });

  it("should complete early if COMPLETE is found in later iteration", async () => {
    // Mock validation
    vi.mocked(validation.validateWorkingDirectory).mockResolvedValue();
    vi.mocked(validation.validateRequiredFiles).mockResolvedValue({
      valid: true,
      missing: [],
    });

    // Mock Claude runner that returns COMPLETE on 3rd iteration
    let callCount = 0;
    const mockRunner: AgentRunner = {
      runClaude: vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 3) {
          return {
            result: "All done! <promise>COMPLETE</promise>",
            usage: {
              input_tokens: 1000,
              output_tokens: 500,
              cache_read_input_tokens: 200,
            },
            total_cost_usd: 0.05,
          } as AgentResponse;
        }
        return {
          result: "Still working...",
          usage: {
            input_tokens: 1000,
            output_tokens: 500,
            cache_read_input_tokens: 200,
          },
          total_cost_usd: 0.05,
        } as AgentResponse;
      }),
    };

    // Should exit with code 0 after 3 iterations (not 5)
    await expect(
      run(
        {
          workingDirectory: testDir,
          maxIterations: 5,
        },
        mockRunner,
      ),
    ).rejects.toThrow(CommandError);

    // Verify process.exit was called with 0
    expect(mockExit).toHaveBeenCalledWith(0);

    // Verify Claude runner was called exactly 3 times
    expect(mockRunner.runClaude).toHaveBeenCalledTimes(3);
  });

  it("should use DefaultClaudeRunner when config specifies claude runner", async () => {
    // Mock validation
    vi.mocked(validation.validateWorkingDirectory).mockResolvedValue();
    vi.mocked(validation.validateRequiredFiles).mockResolvedValue({
      valid: true,
      missing: [],
    });

    // Mock config to return claude runner
    vi.mocked(config.loadConfig).mockResolvedValue({
      config: {
        runner: "claude",
      },
      source: "default",
    });

    // Mock runner to avoid actually calling CLI
    const mockRunner: AgentRunner = {
      runClaude: vi.fn().mockResolvedValue({
        result: "Task is done. <promise>COMPLETE</promise>",
        usage: {
          input_tokens: 1000,
          output_tokens: 500,
          cache_read_input_tokens: 200,
        },
        total_cost_usd: 0.05,
      } as AgentResponse),
    };

    await expect(
      run(
        {
          workingDirectory: testDir,
          maxIterations: 1,
        },
        mockRunner,
      ),
    ).rejects.toThrow();

    // Verify process.exit was called with 0
    expect(mockExit).toHaveBeenCalledWith(0);

    // Note: When runner is provided, loadConfig is not called
    // This test verifies that config-based runner selection doesn't interfere
    // when an explicit runner is passed in
  });

  it("should use CursorRunner when config specifies cursor runner", async () => {
    // Mock validation
    vi.mocked(validation.validateWorkingDirectory).mockResolvedValue();
    vi.mocked(validation.validateRequiredFiles).mockResolvedValue({
      valid: true,
      missing: [],
    });

    // Mock config to return cursor runner with custom model
    vi.mocked(config.loadConfig).mockResolvedValue({
      config: {
        runner: "cursor",
        model: "gpt-4",
      },
      source: "working-directory",
      path: "/test/dir/ralphci.json",
    });

    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await expect(
      run({
        workingDirectory: testDir,
        maxIterations: 1,
      }),
    ).rejects.toThrow();

    // Verify loadConfig was called with working directory and root directory
    expect(config.loadConfig).toHaveBeenCalledWith(testDir, expect.any(String));

    consoleSpy.mockRestore();
  });

  it("should skip token/cost display when usage is zero (Cursor mode)", async () => {
    // Mock validation
    vi.mocked(validation.validateWorkingDirectory).mockResolvedValue();
    vi.mocked(validation.validateRequiredFiles).mockResolvedValue({
      valid: true,
      missing: [],
    });

    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    // Mock runner with zero usage (like Cursor)
    const mockRunner: AgentRunner = {
      runClaude: vi.fn().mockResolvedValue({
        result: "Task is done. <promise>COMPLETE</promise>",
        usage: {
          input_tokens: 0,
          output_tokens: 0,
          cache_read_input_tokens: 0,
        },
        total_cost_usd: 0,
        duration_ms: 2525,
      } as AgentResponse),
    };

    await expect(
      run(
        {
          workingDirectory: testDir,
          maxIterations: 5,
        },
        mockRunner,
      ),
    ).rejects.toThrow();

    // Verify process.exit was called with 0
    expect(mockExit).toHaveBeenCalledWith(0);

    const logs = consoleSpy.mock.calls.map((call) => call[0]);

    // Should NOT show token/cost stats
    expect(logs).not.toContain(expect.stringContaining("Tokens In:"));
    expect(logs).not.toContain(expect.stringContaining("Total Cost:"));

    // Should show duration instead
    expect(logs).toContain("Duration: 2525ms");

    consoleSpy.mockRestore();
  });

  it("should show token/cost stats when usage is non-zero (Claude mode)", async () => {
    // Mock validation
    vi.mocked(validation.validateWorkingDirectory).mockResolvedValue();
    vi.mocked(validation.validateRequiredFiles).mockResolvedValue({
      valid: true,
      missing: [],
    });

    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    // Mock runner with non-zero usage (like Claude)
    const mockRunner: AgentRunner = {
      runClaude: vi.fn().mockResolvedValue({
        result: "Task is done. <promise>COMPLETE</promise>",
        usage: {
          input_tokens: 1000,
          output_tokens: 500,
          cache_read_input_tokens: 200,
        },
        total_cost_usd: 0.05,
      } as AgentResponse),
    };

    await expect(
      run(
        {
          workingDirectory: testDir,
          maxIterations: 5,
        },
        mockRunner,
      ),
    ).rejects.toThrow();

    // Verify process.exit was called with 0
    expect(mockExit).toHaveBeenCalledWith(0);

    const logs = consoleSpy.mock.calls.map((call) => call[0]);

    // Should show token/cost stats
    expect(logs).toContain("Tokens In: 1000");
    expect(logs).toContain("Tokens Out: 500");
    expect(logs).toContain("Cache Read: 200");
    expect(logs).toContain("Cost: $0.0500");

    // Should NOT show duration
    expect(logs).not.toContain(expect.stringContaining("Duration:"));

    consoleSpy.mockRestore();
  });

  it("should log config information when loading config from working directory", async () => {
    // Mock validation
    vi.mocked(validation.validateWorkingDirectory).mockResolvedValue();
    vi.mocked(validation.validateRequiredFiles).mockResolvedValue({
      valid: true,
      missing: [],
    });

    // Mock config to return working directory config with model
    vi.mocked(config.loadConfig).mockResolvedValue({
      config: {
        runner: "cursor",
        model: "gpt-4",
      },
      source: "working-directory",
      path: "/test/dir/ralphci.json",
    });

    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await expect(
      run({
        workingDirectory: testDir,
        maxIterations: 1,
      }),
    ).rejects.toThrow();

    const logs = consoleSpy.mock.calls.map((call) => call[0]);

    // Should log config information
    expect(logs).toContain("\n--- Configuration ---");
    expect(logs).toContain("Config loaded from: /test/dir/ralphci.json");
    expect(logs).toContain("Runner: cursor");
    expect(logs).toContain("Model: gpt-4");

    consoleSpy.mockRestore();
  });

  it("should log config information when using default config", async () => {
    // Mock validation
    vi.mocked(validation.validateWorkingDirectory).mockResolvedValue();
    vi.mocked(validation.validateRequiredFiles).mockResolvedValue({
      valid: true,
      missing: [],
    });

    // Mock config to return default config
    vi.mocked(config.loadConfig).mockResolvedValue({
      config: {
        runner: "claude",
      },
      source: "default",
    });

    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await expect(
      run({
        workingDirectory: testDir,
        maxIterations: 1,
      }),
    ).rejects.toThrow();

    const logs = consoleSpy.mock.calls.map((call) => call[0]);

    // Should log config information
    expect(logs).toContain("\n--- Configuration ---");
    expect(logs).toContain("Using default config (no ralphci.json found)");
    expect(logs).toContain("Runner: claude");
    expect(logs).not.toContain(expect.stringContaining("Model:"));

    consoleSpy.mockRestore();
  });

  it("should log config information when loading from root directory", async () => {
    // Mock validation
    vi.mocked(validation.validateWorkingDirectory).mockResolvedValue();
    vi.mocked(validation.validateRequiredFiles).mockResolvedValue({
      valid: true,
      missing: [],
    });

    // Mock config to return root directory config
    vi.mocked(config.loadConfig).mockResolvedValue({
      config: {
        runner: "claude",
      },
      source: "root-directory",
      path: "/root/ralphci.json",
    });

    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await expect(
      run({
        workingDirectory: testDir,
        maxIterations: 1,
      }),
    ).rejects.toThrow();

    const logs = consoleSpy.mock.calls.map((call) => call[0]);

    // Should log config information
    expect(logs).toContain("\n--- Configuration ---");
    expect(logs).toContain("Config loaded from: /root/ralphci.json");
    expect(logs).toContain("Runner: claude");

    consoleSpy.mockRestore();
  });

  it("should log config summary on successful completion", async () => {
    // Mock validation
    vi.mocked(validation.validateWorkingDirectory).mockResolvedValue();
    vi.mocked(validation.validateRequiredFiles).mockResolvedValue({
      valid: true,
      missing: [],
    });

    // Mock config
    vi.mocked(config.loadConfig).mockResolvedValue({
      config: {
        runner: "cursor",
        model: "gpt-4",
      },
      source: "working-directory",
      path: "/test/dir/ralphci.json",
    });

    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    // Mock CursorRunner.runClaude to return completion
    const CursorRunner = await import("../utils/cursor-runner.js");
    const runClaudeSpy = vi
      .spyOn(CursorRunner.CursorRunner.prototype, "runClaude")
      .mockResolvedValue({
        result: "Task is done. <promise>COMPLETE</promise>",
        usage: {
          input_tokens: 0,
          output_tokens: 0,
          cache_read_input_tokens: 0,
        },
        total_cost_usd: 0,
      } as AgentResponse);

    await expect(
      run({
        workingDirectory: testDir,
        maxIterations: 5,
      }),
    ).rejects.toThrow();

    const logs = consoleSpy.mock.calls.map((call) => call[0]);

    // Should log config summary at the end
    expect(logs).toContain("\n--- Configuration Summary ---");
    expect(logs).toContain("Runner: cursor");
    expect(logs).toContain("Model: gpt-4");
    expect(logs).toContain(
      "Config source: working directory (/test/dir/ralphci.json)",
    );

    runClaudeSpy.mockRestore();
    consoleSpy.mockRestore();
  });

  it("should log config summary when max iterations reached", async () => {
    // Mock validation
    vi.mocked(validation.validateWorkingDirectory).mockResolvedValue();
    vi.mocked(validation.validateRequiredFiles).mockResolvedValue({
      valid: true,
      missing: [],
    });

    // Mock config with default
    vi.mocked(config.loadConfig).mockResolvedValue({
      config: {
        runner: "claude",
      },
      source: "default",
    });

    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    // Mock DefaultClaudeRunner.runClaude to never complete
    const ClaudeRunner = await import("../utils/claude-runner.js");
    const runClaudeSpy = vi
      .spyOn(ClaudeRunner.DefaultClaudeRunner.prototype, "runClaude")
      .mockResolvedValue({
        result: "Still working...",
        usage: {
          input_tokens: 1000,
          output_tokens: 500,
          cache_read_input_tokens: 200,
        },
        total_cost_usd: 0.05,
      } as AgentResponse);

    await expect(
      run({
        workingDirectory: testDir,
        maxIterations: 2,
      }),
    ).rejects.toThrow();

    const logs = consoleSpy.mock.calls.map((call) => call[0]);

    // Should log config summary at the end
    expect(logs).toContain("\n--- Configuration Summary ---");
    expect(logs).toContain("Runner: claude");
    expect(logs).toContain("Config source: default");

    runClaudeSpy.mockRestore();
    consoleSpy.mockRestore();
  });

  it("should log config summary on error", async () => {
    // Mock validation
    vi.mocked(validation.validateWorkingDirectory).mockResolvedValue();
    vi.mocked(validation.validateRequiredFiles).mockResolvedValue({
      valid: true,
      missing: [],
    });

    // Mock config
    vi.mocked(config.loadConfig).mockResolvedValue({
      config: {
        runner: "claude",
      },
      source: "root-directory",
      path: "/root/ralphci.json",
    });

    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    // Mock DefaultClaudeRunner.runClaude to throw an error
    const ClaudeRunner = await import("../utils/claude-runner.js");
    const runClaudeSpy = vi
      .spyOn(ClaudeRunner.DefaultClaudeRunner.prototype, "runClaude")
      .mockRejectedValue(new Error("Claude CLI failed"));

    await expect(
      run({
        workingDirectory: testDir,
        maxIterations: 5,
      }),
    ).rejects.toThrow(CommandError);

    const logs = consoleSpy.mock.calls.map((call) => call[0]);

    // Should log config summary before error is thrown
    expect(logs).toContain("\n--- Configuration Summary ---");
    expect(logs).toContain("Runner: claude");
    expect(logs).toContain(
      "Config source: root directory (/root/ralphci.json)",
    );

    runClaudeSpy.mockRestore();
    consoleSpy.mockRestore();
  });
});
