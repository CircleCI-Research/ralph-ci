#!/usr/bin/env node

import { Command } from "commander";
import { createSettings } from "./commands/create-settings.js";
import { scaffold } from "./commands/scaffold.js";
import { scaffoldJson } from "./commands/scaffold-json.js";
import { scaffoldCI } from "./commands/scaffold-ci.js";
import { run as runMarkdown } from "./commands/run.js";
import { runJson } from "./commands/run-json.js";
import { runCI } from "./commands/run-ci.js";
import { checkCI } from "./commands/check-ci.js";

const program = new Command();

program
  .name("ralphci")
  .description("RalphCI - CI-aware AI coding loops that ship with confidence")
  .version("1.0.0");

// Register commands
program
  .command("create-settings")
  .description("Create .claude/settings.json and .mcp.json configuration files")
  .option(
    "-w, --working-directory <path>",
    "Working directory (default: current directory)",
  )
  .option("-f, --force", "Overwrite existing files")
  .action(async (options) => {
    try {
      await createSettings({
        workingDirectory: options.workingDirectory,
        force: options.force,
      });
    } catch (error) {
      console.error(
        `Error: ${error instanceof Error ? error.message : String(error)}`,
      );
      process.exit(1);
    }
  });

program
  .command("check-ci")
  .description("Verify CircleCI API connection and token validity")
  .option("-v, --verbose", "Show additional details")
  .action(async (options) => {
    try {
      await checkCI({
        verbose: options.verbose,
      });
    } catch (error) {
      console.error(
        `Error: ${error instanceof Error ? error.message : String(error)}`,
      );
      process.exit(1);
    }
  });

program
  .command("scaffold")
  .description(
    "Create RalphCI workflow files (activity.md, plan.md, tasks.json, prompt.md, ralphci.json)",
  )
  .option(
    "-w, --working-directory <path>",
    "Working directory (default: current directory)",
  )
  .option("-f, --force", "Overwrite existing files")
  .option(
    "--branch-strategy <strategy>",
    "Branch strategy: feature-branch or direct-to-main",
    "feature-branch",
  )
  .option(
    "--no-approval-gate",
    "Disable approval gate (auto-deploy when CI green)",
  )
  .option("--no-auto-push", "Disable automatic git push after commits")
  .option("--no-ci", "Disable CircleCI integration (local-only workflow)")
  .action(async (options) => {
    try {
      await scaffoldCI({
        workingDirectory: options.workingDirectory,
        force: options.force,
        branchStrategy: options.branchStrategy as
          | "feature-branch"
          | "direct-to-main",
        approvalGate: options.approvalGate,
        autoPush: options.autoPush,
        ciEnabled: options.ci,
      });
    } catch (error) {
      console.error(
        `Error: ${error instanceof Error ? error.message : String(error)}`,
      );
      process.exit(1);
    }
  });

program
  .command("scaffold-md")
  .description("(Legacy) Create markdown workflow files")
  .option(
    "-w, --working-directory <path>",
    "Working directory (default: current directory)",
  )
  .option("-f, --force", "Overwrite existing files")
  .action(async (options) => {
    try {
      await scaffold({
        workingDirectory: options.workingDirectory,
        force: options.force,
      });
    } catch (error) {
      console.error(
        `Error: ${error instanceof Error ? error.message : String(error)}`,
      );
      process.exit(1);
    }
  });

program
  .command("scaffold-json")
  .description("(Legacy) Create JSON workflow files without CI integration")
  .option(
    "-w, --working-directory <path>",
    "Working directory (default: current directory)",
  )
  .option("-f, --force", "Overwrite existing files")
  .action(async (options) => {
    try {
      await scaffoldJson({
        workingDirectory: options.workingDirectory,
        force: options.force,
      });
    } catch (error) {
      console.error(
        `Error: ${error instanceof Error ? error.message : String(error)}`,
      );
      process.exit(1);
    }
  });

// Primary command: run (with CI enabled by default)
program
  .command("run")
  .description("Start the RalphCI loop (CI enabled by default)")
  .option(
    "-w, --working-directory <path>",
    "Working directory (default: current directory)",
  )
  .option(
    "-m, --max-iterations <number>",
    "Maximum loop iterations (default: 10)",
    parseInt,
  )
  .option("--unlimited", "Allow unlimited iterations (use with caution)")
  .option(
    "--ci-wait <seconds>",
    "Max seconds to wait for CI between iterations",
    parseInt,
  )
  .option("--no-auto-push", "Disable automatic git push")
  .option(
    "--push-every-commit",
    "Push after every commit (chatty mode, not recommended)",
  )
  .option(
    "--no-approval-gate",
    "Disable approval gate (auto-deploy when CI green)",
  )
  .option("--no-require-green", "Allow completion without CI verification")
  .option(
    "--branch-strategy <strategy>",
    "Branch strategy: feature-branch or direct-to-main",
  )
  .option("--no-ci", "Disable CircleCI integration (local-only workflow)")
  .option("--no-draft-pr", "Create PR as ready for review instead of draft")
  .option("-v, --verbose", "Enable verbose output for debugging")
  .option("--serve", "Enable local dev server (auto-enabled if src/ exists)")
  .option("--no-serve", "Disable local dev server")
  .option(
    "--serve-port <port>",
    "Port for local dev server (default: 3000)",
    parseInt,
  )
  .option("--serve-dir <directory>", "Directory to serve (default: src)")
  .action(async (options) => {
    try {
      const maxIterations = options.unlimited
        ? Infinity
        : options.maxIterations || 10;

      // Smart push is default (pushOnLocalSuccess: true)
      // --push-every-commit disables smart push (chatty mode)
      const pushOnLocalSuccess = !options.pushEveryCommit;

      // CI is enabled by default, can be disabled with --no-ci
      const ciEnabled = options.ci !== false;

      // Serve is auto-detected by default (enabled if src/ exists)
      // Can be explicitly enabled with --serve or disabled with --no-serve
      const serveEnabled = options.serve;

      await runCI({
        workingDirectory: options.workingDirectory || process.cwd(),
        maxIterations,
        unlimitedIterations: options.unlimited,
        ciWaitSeconds: options.ciWait,
        autoPush: options.autoPush,
        pushOnLocalSuccess,
        approvalGateEnabled: options.approvalGate,
        requireGreenBeforeComplete: options.requireGreen,
        branchStrategy: options.branchStrategy,
        ciEnabled,
        draftPR: options.draftPr,
        verbose: options.verbose,
        serveEnabled,
        servePort: options.servePort,
        serveDirectory: options.serveDir,
      });
    } catch (error) {
      console.error(
        `Error: ${error instanceof Error ? error.message : String(error)}`,
      );
      process.exit(1);
    }
  });

// Backwards compatibility alias for run-ci
program
  .command("run-ci")
  .description(
    '(Deprecated: use "run" instead) Start the RalphCI loop with CircleCI integration',
  )
  .option(
    "-w, --working-directory <path>",
    "Working directory (default: current directory)",
  )
  .option(
    "-m, --max-iterations <number>",
    "Maximum loop iterations (default: 10)",
    parseInt,
  )
  .option("--unlimited", "Allow unlimited iterations (use with caution)")
  .option(
    "--ci-wait <seconds>",
    "Max seconds to wait for CI between iterations",
    parseInt,
  )
  .option("--no-auto-push", "Disable automatic git push")
  .option(
    "--push-every-commit",
    "Push after every commit (chatty mode, not recommended)",
  )
  .option(
    "--no-approval-gate",
    "Disable approval gate (auto-deploy when CI green)",
  )
  .option("--no-require-green", "Allow completion without CI verification")
  .option(
    "--branch-strategy <strategy>",
    "Branch strategy: feature-branch or direct-to-main",
  )
  .option("--no-ci", "Disable CircleCI integration (local-only workflow)")
  .option("--no-draft-pr", "Create PR as ready for review instead of draft")
  .option("--serve", "Enable local dev server")
  .option("--no-serve", "Disable local dev server")
  .option(
    "--serve-port <port>",
    "Port for local dev server (default: 3000)",
    parseInt,
  )
  .option("--serve-dir <directory>", "Directory to serve (default: src)")
  .action(async (options) => {
    console.log(
      'Note: "run-ci" is deprecated. Use "run" instead (CI is enabled by default).\n',
    );
    try {
      const maxIterations = options.unlimited
        ? Infinity
        : options.maxIterations || 10;
      const pushOnLocalSuccess = !options.pushEveryCommit;
      const ciEnabled = options.ci !== false;

      await runCI({
        workingDirectory: options.workingDirectory || process.cwd(),
        maxIterations,
        unlimitedIterations: options.unlimited,
        ciWaitSeconds: options.ciWait,
        autoPush: options.autoPush,
        pushOnLocalSuccess,
        approvalGateEnabled: options.approvalGate,
        requireGreenBeforeComplete: options.requireGreen,
        branchStrategy: options.branchStrategy,
        ciEnabled,
        draftPR: options.draftPr,
        serveEnabled: options.serve,
        servePort: options.servePort,
        serveDirectory: options.serveDir,
      });
    } catch (error) {
      console.error(
        `Error: ${error instanceof Error ? error.message : String(error)}`,
      );
      process.exit(1);
    }
  });

// Backwards compatibility alias for scaffold-ci
program
  .command("scaffold-ci")
  .description(
    '(Deprecated: use "scaffold" instead) Create RalphCI workflow files',
  )
  .option(
    "-w, --working-directory <path>",
    "Working directory (default: current directory)",
  )
  .option("-f, --force", "Overwrite existing files")
  .option(
    "--branch-strategy <strategy>",
    "Branch strategy: feature-branch or direct-to-main",
    "feature-branch",
  )
  .option(
    "--no-approval-gate",
    "Disable approval gate (auto-deploy when CI green)",
  )
  .option("--no-auto-push", "Disable automatic git push after commits")
  .option("--no-ci", "Disable CircleCI integration (local-only workflow)")
  .action(async (options) => {
    console.log('Note: "scaffold-ci" is deprecated. Use "scaffold" instead.\n');
    try {
      await scaffoldCI({
        workingDirectory: options.workingDirectory,
        force: options.force,
        branchStrategy: options.branchStrategy as
          | "feature-branch"
          | "direct-to-main",
        approvalGate: options.approvalGate,
        autoPush: options.autoPush,
        ciEnabled: options.ci,
      });
    } catch (error) {
      console.error(
        `Error: ${error instanceof Error ? error.message : String(error)}`,
      );
      process.exit(1);
    }
  });

// Legacy commands
program
  .command("run-md")
  .description("(Legacy) Run the markdown workflow loop")
  .option(
    "-w, --working-directory <path>",
    "Working directory (default: current directory)",
  )
  .requiredOption(
    "-m, --max-iterations <number>",
    "Maximum loop iterations",
    parseInt,
  )
  .action(async (options) => {
    try {
      await runMarkdown({
        workingDirectory: options.workingDirectory || process.cwd(),
        maxIterations: options.maxIterations,
      });
    } catch (error) {
      console.error(
        `Error: ${error instanceof Error ? error.message : String(error)}`,
      );
      process.exit(1);
    }
  });

program
  .command("run-json")
  .description("(Legacy) Run the JSON workflow loop without CI integration")
  .option(
    "-w, --working-directory <path>",
    "Working directory (default: current directory)",
  )
  .requiredOption(
    "-m, --max-iterations <number>",
    "Maximum loop iterations",
    parseInt,
  )
  .action(async (options) => {
    try {
      await runJson({
        workingDirectory: options.workingDirectory || process.cwd(),
        maxIterations: options.maxIterations,
      });
    } catch (error) {
      console.error(
        `Error: ${error instanceof Error ? error.message : String(error)}`,
      );
      process.exit(1);
    }
  });

program.parse();
