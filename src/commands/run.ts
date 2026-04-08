import path from "path";
import {
  validateWorkingDirectory,
  validateRequiredFiles,
} from "../utils/validation.js";
import { CommandError } from "../utils/errors.js";
import { AgentRunner, DefaultClaudeRunner } from "../utils/claude-runner.js";
import { CursorRunner } from "../utils/cursor-runner.js";
import { loadConfig } from "../utils/config.js";

export interface RunOptions {
  workingDirectory: string;
  maxIterations: number;
}

interface IterationStats {
  iteration: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cost: number;
}

interface CumulativeStats {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheReadTokens: number;
  totalCost: number;
}

export async function run(
  options: RunOptions,
  runner?: AgentRunner,
): Promise<void> {
  const { workingDirectory, maxIterations } = options;

  // Validate working directory exists
  await validateWorkingDirectory(workingDirectory);

  // Load config and select runner if not provided
  let configSource = "unknown";
  let configPath: string | undefined;
  let runnerType = "unknown";
  let model: string | undefined;

  if (!runner) {
    const configResult = await loadConfig(workingDirectory, process.cwd());
    const config = configResult.config;

    // Store config info for summary logging
    configSource = configResult.source;
    configPath = configResult.path;
    runnerType = config.runner;
    model = config.model;

    // Log config information
    console.log("\n--- Configuration ---");
    if (configResult.source === "default") {
      console.log("Using default config (no ralphci.json found)");
    } else if (configResult.source === "working-directory") {
      console.log(`Config loaded from: ${configResult.path}`);
    } else if (configResult.source === "root-directory") {
      console.log(`Config loaded from: ${configResult.path}`);
    }
    console.log(`Runner: ${config.runner}`);
    if (config.model) {
      console.log(`Model: ${config.model}`);
    }
    console.log("");

    if (config.runner === "cursor") {
      runner = new CursorRunner(config.model);
    } else {
      runner = new DefaultClaudeRunner();
    }
  }

  // Helper function to log config summary
  const logConfigSummary = () => {
    // Only log summary if we have config info (runner was not provided directly)
    if (runnerType === "unknown") {
      return;
    }
    console.log("\n--- Configuration Summary ---");
    console.log(`Runner: ${runnerType}`);
    if (model) {
      console.log(`Model: ${model}`);
    }
    if (configSource === "default") {
      console.log("Config source: default");
    } else if (configSource === "working-directory") {
      console.log(`Config source: working directory (${configPath})`);
    } else if (configSource === "root-directory") {
      console.log(`Config source: root directory (${configPath})`);
    }
  };

  // Validate required files exist
  const requiredFiles = ["plan.md", "prompt.md", "activity.md"];
  const validation = await validateRequiredFiles(
    workingDirectory,
    requiredFiles,
  );

  if (!validation.valid) {
    throw new CommandError(
      `Missing required files: ${validation.missing.join(", ")}\n` +
        `Run 'ralphci scaffold -w ${workingDirectory}' to create the necessary files.`,
    );
  }

  const promptPath = path.join(workingDirectory, "prompt.md");

  // Initialize cumulative stats
  const cumulative: CumulativeStats = {
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCacheReadTokens: 0,
    totalCost: 0,
  };

  // Run the loop
  for (let iteration = 1; iteration <= maxIterations; iteration++) {
    console.log(`\n--- Iteration ${iteration}/${maxIterations} ---`);

    try {
      // Call Claude CLI
      const response = await runner.runClaude({
        promptPath,
        workingDirectory,
      });

      // Update cumulative stats
      cumulative.totalInputTokens += response.usage.input_tokens;
      cumulative.totalOutputTokens += response.usage.output_tokens;
      cumulative.totalCacheReadTokens += response.usage.cache_read_input_tokens;
      cumulative.totalCost += response.total_cost_usd;

      // Print per-iteration stats
      const iterationStats: IterationStats = {
        iteration,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        cacheReadTokens: response.usage.cache_read_input_tokens,
        cost: response.total_cost_usd,
      };

      // Only show token/cost stats if they are non-zero (Claude mode)
      const hasTokenStats =
        iterationStats.inputTokens > 0 ||
        iterationStats.outputTokens > 0 ||
        iterationStats.cost > 0;

      if (hasTokenStats) {
        console.log(`Tokens In: ${iterationStats.inputTokens}`);
        console.log(`Tokens Out: ${iterationStats.outputTokens}`);
        console.log(`Cache Read: ${iterationStats.cacheReadTokens}`);
        console.log(`Cost: $${iterationStats.cost.toFixed(4)}`);

        // Print cumulative stats
        console.log("\nCumulative Stats:");
        console.log(`Total Tokens In: ${cumulative.totalInputTokens}`);
        console.log(`Total Tokens Out: ${cumulative.totalOutputTokens}`);
        console.log(`Total Cache Read: ${cumulative.totalCacheReadTokens}`);
        console.log(`Total Cost: $${cumulative.totalCost.toFixed(4)}`);
      } else if (response.duration_ms !== undefined) {
        // Show duration for Cursor mode
        console.log(`Duration: ${response.duration_ms}ms`);
      }

      // Check for completion
      if (response.result.includes("<promise>COMPLETE</promise>")) {
        console.log(
          `\n✓ Task completed successfully after ${iteration} iteration(s)!`,
        );
        logConfigSummary();
        process.exit(0);
      }
    } catch (error) {
      logConfigSummary();
      if (error instanceof Error) {
        throw new CommandError(`Failed to run Claude CLI: ${error.message}`);
      }
      throw error;
    }
  }

  // Max iterations reached without completion
  console.log(
    `\n✗ Maximum iterations (${maxIterations}) reached without completion.`,
  );
  logConfigSummary();
  process.exit(1);
}
