/**
 * Review Gate — deterministic pre-push quality gate.
 *
 * Runs lint:fix + test:run (with hard timeout) between the Build Agent
 * finishing and the CLI pushing. No LLM involved — this is pure automation.
 *
 * The gate catches issues the Build Agent missed (e.g., ESLint quote style)
 * before they waste a CI run.
 */

import { execSync, spawn } from "child_process";
import { setTimeout, clearTimeout } from "timers";
import { existsSync } from "fs";
import path from "path";
import { ReviewGateConfig } from "./config.js";
import { c } from "./terminal.js";

/**
 * Find the nearest ancestor directory that contains a package.json.
 * pnpm commands (lint:fix, test:run) must run from a directory with a
 * package.json — feature/experiment subdirectories don't have one,
 * so we walk up to the repo root (or nearest package).
 *
 * Returns `workingDirectory` itself if it contains a package.json,
 * otherwise the nearest ancestor, or `workingDirectory` as fallback.
 */
function findPackageRoot(workingDirectory: string): string {
  let dir = path.resolve(workingDirectory);
  const root = path.parse(dir).root;

  while (dir !== root) {
    if (existsSync(path.join(dir, "package.json"))) {
      return dir;
    }
    dir = path.dirname(dir);
  }

  // Fallback: return original (pnpm will error, but that's what happened before)
  return workingDirectory;
}

export interface ReviewGateResult {
  passed: boolean;
  formatFixApplied: boolean;
  formatError: string | null;
  lintFixApplied: boolean;
  lintError: string | null;
  testsPass: boolean;
  testError: string | null;
  testTimedOut: boolean;
  durationMs: number;
}

/**
 * Run `pnpm format:fix` (Prettier) from the nearest package root.
 * Returns true if format:fix succeeded (or if there's no format script).
 */
export function runFormatFix(workingDirectory: string): {
  success: boolean;
  error: string | null;
  applied: boolean;
} {
  const packageRoot = findPackageRoot(workingDirectory);
  try {
    execSync("pnpm format:fix", {
      cwd: packageRoot,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 30_000, // 30s hard timeout for formatting
    });

    // Check if format:fix actually changed files
    let applied = false;
    try {
      const status = execSync("git status --porcelain", {
        cwd: workingDirectory,
        encoding: "utf-8",
      }).trim();
      applied = status.length > 0;
    } catch {
      // Can't check git status — assume no changes
    }

    return { success: true, error: null, applied };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);

    // If format:fix script doesn't exist, that's OK
    if (msg.includes("Missing script") || msg.includes("ENOENT")) {
      return { success: true, error: null, applied: false };
    }

    // Extract verbose output from execSync error
    let verboseError = msg;
    if (error && typeof error === "object") {
      const execError = error as { stdout?: unknown; stderr?: unknown };
      const stdout = execError.stdout ? String(execError.stdout).trim() : "";
      const stderr = execError.stderr ? String(execError.stderr).trim() : "";
      const parts: string[] = [];
      if (stderr) parts.push(stderr);
      if (stdout) parts.push(stdout);
      if (parts.length > 0) {
        verboseError = parts.join("\n\n");
      }
    }

    return { success: false, error: verboseError, applied: false };
  }
}

/**
 * Run `pnpm lint:fix` (ESLint) from the nearest package root.
 * Returns true if lint:fix succeeded (or if there's nothing to lint).
 */
export function runLintFix(workingDirectory: string): {
  success: boolean;
  error: string | null;
  applied: boolean;
} {
  const packageRoot = findPackageRoot(workingDirectory);
  try {
    execSync("pnpm lint:fix", {
      cwd: packageRoot,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 30_000, // 30s hard timeout for lint
    });

    // Check if lint:fix actually changed files
    let applied = false;
    try {
      const status = execSync("git status --porcelain", {
        cwd: workingDirectory,
        encoding: "utf-8",
      }).trim();
      applied = status.length > 0;
    } catch {
      // Can't check git status — assume no changes
    }

    return { success: true, error: null, applied };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);

    // If lint:fix fails because there's no lint script, that's OK
    if (msg.includes("Missing script") || msg.includes("ENOENT")) {
      return { success: true, error: null, applied: false };
    }

    // Extract verbose output from execSync error (stdout + stderr contain the actual lint errors)
    let verboseError = msg;
    if (error && typeof error === "object") {
      const execError = error as { stdout?: unknown; stderr?: unknown };
      const stdout = execError.stdout ? String(execError.stdout).trim() : "";
      const stderr = execError.stderr ? String(execError.stderr).trim() : "";
      const parts: string[] = [];
      if (stderr) parts.push(stderr);
      if (stdout) parts.push(stdout);
      if (parts.length > 0) {
        verboseError = parts.join("\n\n");
      }
    }

    return { success: false, error: verboseError, applied: false };
  }
}

/**
 * Run `pnpm test:run` with a hard timeout.
 * Uses child_process.spawn so we can kill the tree on timeout.
 */
export async function runTestsWithTimeout(
  workingDirectory: string,
  timeoutSeconds: number,
): Promise<{ pass: boolean; timedOut: boolean; error: string | null }> {
  const packageRoot = findPackageRoot(workingDirectory);
  return new Promise((resolve) => {
    const child = spawn("pnpm", ["test:run"], {
      cwd: packageRoot,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let killed = false;

    child.stdout?.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr?.on("data", (data) => {
      stderr += data.toString();
    });

    const timer = setTimeout(() => {
      killed = true;
      child.kill("SIGKILL");
      // Also kill any child processes (vitest workers)
      try {
        execSync('pkill -9 -f "vitest/dist/workers/forks.js"', {
          encoding: "utf-8",
          stdio: ["pipe", "pipe", "pipe"],
        });
      } catch {
        // No orphans — fine
      }
    }, timeoutSeconds * 1000);

    child.on("close", (code) => {
      clearTimeout(timer);

      if (killed) {
        // Include all captured output so the Build Agent can see what was
        // running when the timeout hit (which tests started, which hung, etc.)
        const capturedOutput = (stdout + "\n" + stderr).trim();
        const outputLines = capturedOutput.split("\n");
        // Include up to the last 80 lines of output for maximum context
        const relevantOutput = outputLines.slice(-80).join("\n");

        const errorMsg = [
          `Tests timed out after ${timeoutSeconds}s.`,
          "The test suite did not complete — likely a hanging test, infinite loop, or unresolved promise.",
          "",
          "--- Test output captured before timeout ---",
          relevantOutput || "(no output captured)",
          "--- End of captured output ---",
        ].join("\n");

        resolve({
          pass: false,
          timedOut: true,
          error: errorMsg,
        });
        return;
      }

      if (code === 0) {
        resolve({ pass: true, timedOut: false, error: null });
      } else {
        // Extract useful error info from output — include generous context
        const output = (stderr + "\n" + stdout).trim();
        const lastLines = output.split("\n").slice(-50).join("\n");
        resolve({
          pass: false,
          timedOut: false,
          error: `Tests failed (exit code ${code}):\n${lastLines}`,
        });
      }
    });

    child.on("error", (err) => {
      clearTimeout(timer);

      // If test:run script doesn't exist, that's OK
      if (err.message.includes("ENOENT")) {
        resolve({ pass: true, timedOut: false, error: null });
        return;
      }

      resolve({
        pass: false,
        timedOut: false,
        error: `Failed to run tests: ${err.message}`,
      });
    });
  });
}

/**
 * Run the full Review Gate: format:fix → lint:fix → tests (with timeout).
 *
 * Returns a structured result indicating what passed, what failed,
 * and whether the gate overall passed.
 */
export async function runReviewGate(
  workingDirectory: string,
  config: ReviewGateConfig,
): Promise<ReviewGateResult> {
  const start = Date.now();

  console.log(c.cyan("\n  ─── Review Gate ───"));

  // Step 1: Format fix (Prettier)
  let formatFixApplied = false;
  let formatError: string | null = null;

  if (config.formatFixEnabled) {
    console.log(c.dim("  🎨 Running format:fix..."));
    const formatResult = runFormatFix(workingDirectory);

    if (formatResult.success) {
      if (formatResult.applied) {
        console.log(c.green("  ✓ format:fix applied formatting corrections"));
        formatFixApplied = true;

        // Stage the format fixes so they're included in the commit
        try {
          execSync("git add -A", { cwd: workingDirectory, encoding: "utf-8" });
        } catch {
          // Non-fatal
        }
      } else {
        console.log(c.green("  ✓ format:fix — no issues found"));
      }
    } else {
      console.log(c.red(`  ✗ format:fix failed: ${formatResult.error}`));
      formatError = formatResult.error;
    }
  } else {
    console.log(c.dim("  ⊘ format:fix disabled"));
  }

  // Step 2: Lint fix (ESLint)
  let lintFixApplied = false;
  let lintError: string | null = null;

  if (config.lintFixEnabled) {
    console.log(c.dim("  🔧 Running lint:fix..."));
    const lintResult = runLintFix(workingDirectory);

    if (lintResult.success) {
      if (lintResult.applied) {
        console.log(c.green("  ✓ lint:fix applied auto-corrections"));
        lintFixApplied = true;

        // Stage the lint fixes so they're included in the commit
        try {
          execSync("git add -A", { cwd: workingDirectory, encoding: "utf-8" });
        } catch {
          // Non-fatal
        }
      } else {
        console.log(c.green("  ✓ lint:fix — no issues found"));
      }
    } else {
      console.log(c.red(`  ✗ lint:fix failed: ${lintResult.error}`));
      lintError = lintResult.error;
    }
  } else {
    console.log(c.dim("  ⊘ lint:fix disabled"));
  }

  // Step 3: Tests with timeout
  let testsPass = true;
  let testError: string | null = null;
  let testTimedOut = false;

  if (config.testsEnabled) {
    console.log(
      c.dim(`  🧪 Running tests (timeout: ${config.testTimeoutSeconds}s)...`),
    );
    const testResult = await runTestsWithTimeout(
      workingDirectory,
      config.testTimeoutSeconds,
    );

    testsPass = testResult.pass;
    testTimedOut = testResult.timedOut;
    testError = testResult.error;

    if (testResult.pass) {
      console.log(c.green("  ✓ All tests pass"));
    } else if (testResult.timedOut) {
      console.log(
        c.red(`  ✗ Tests TIMED OUT after ${config.testTimeoutSeconds}s`),
      );
    } else {
      console.log(c.red("  ✗ Tests failed"));
    }
  } else {
    console.log(c.dim("  ⊘ Tests disabled"));
  }

  const durationMs = Date.now() - start;
  const passed = formatError === null && lintError === null && testsPass;

  if (passed) {
    console.log(
      c.green(`  ✓ Review Gate PASSED (${(durationMs / 1000).toFixed(1)}s)`),
    );
  } else {
    console.log(
      c.red(`  ✗ Review Gate FAILED (${(durationMs / 1000).toFixed(1)}s)`),
    );
  }

  console.log("");

  return {
    passed,
    formatFixApplied,
    formatError,
    lintFixApplied,
    lintError,
    testsPass,
    testError,
    testTimedOut,
    durationMs,
  };
}

/**
 * Build a feedback string from a failed Review Gate result.
 * This gets injected into the Build Agent's next iteration prompt
 * so it can fix the issue.
 */
export function buildReviewGateFeedback(result: ReviewGateResult): string {
  const lines: string[] = [
    "## ⚠️ Review Gate FAILED",
    "",
    "The automated Review Gate ran after your changes and found issues that must be fixed.",
    "",
  ];

  if (result.formatError) {
    lines.push("### Formatting Errors (Prettier)");
    lines.push("");
    lines.push("```");
    lines.push(result.formatError);
    lines.push("```");
    lines.push("");
  }

  if (result.lintError) {
    lines.push("### Lint Errors (ESLint)");
    lines.push("");
    lines.push("```");
    lines.push(result.lintError);
    lines.push("```");
    lines.push("");
  }

  if (result.testTimedOut) {
    lines.push("### Tests Timed Out");
    lines.push("");
    lines.push("The test suite did not complete within the timeout period.");
    lines.push(
      "This usually means a test is hanging (infinite loop, unresolved promise, or missing cleanup).",
    );
    lines.push("");
    if (result.testError) {
      lines.push("**Captured test output before timeout:**");
      lines.push("");
      lines.push("```");
      lines.push(result.testError);
      lines.push("```");
      lines.push("");
    }
    lines.push(
      "**Fix**: Check for tests that don't terminate. Ensure all async operations resolve and all timers are cleared.",
    );
    lines.push(
      "**Note**: You do NOT need to run tests yourself — the Review Gate runs them with a hard timeout.",
    );
    lines.push("");
  } else if (result.testError) {
    lines.push("### Test Failures");
    lines.push("");
    lines.push("```");
    lines.push(result.testError);
    lines.push("```");
    lines.push("");
  }

  lines.push("**You MUST fix these issues before the changes can be pushed.**");

  return lines.join("\n");
}
