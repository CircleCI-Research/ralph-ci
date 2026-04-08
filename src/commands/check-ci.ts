/**
 * Command to verify CircleCI API connection and token validity.
 */

// Node.js 18+ has native fetch
declare const fetch: typeof globalThis.fetch;

import { execSync } from "child_process";
import { parseProjectSlug, fetchCIStatus } from "../utils/circleci-api.js";

interface CheckCIOptions {
  verbose?: boolean;
}

/**
 * Get the current git branch name.
 */
function getCurrentBranch(): string | null {
  try {
    return execSync("git rev-parse --abbrev-ref HEAD", {
      encoding: "utf-8",
    }).trim();
  } catch {
    return null;
  }
}

/**
 * Get the git remote URL for origin.
 */
function getGitRemoteUrl(): string | null {
  try {
    return execSync("git remote get-url origin", { encoding: "utf-8" }).trim();
  } catch {
    return null;
  }
}

/**
 * Make a simple API call to verify the token works.
 */
async function verifyToken(
  token: string,
): Promise<{ valid: boolean; message: string; user?: string }> {
  try {
    const response = await fetch("https://circleci.com/api/v2/me", {
      headers: {
        "Circle-Token": token,
        "Content-Type": "application/json",
      },
    });

    if (response.ok) {
      const data = (await response.json()) as {
        name?: string;
        login?: string;
        id?: string;
      };
      const userName = data.name || data.login || data.id || "Unknown";
      return { valid: true, message: "Token is valid", user: userName };
    } else if (response.status === 401) {
      return {
        valid: false,
        message: "Token is invalid or expired (401 Unauthorized)",
      };
    } else {
      return {
        valid: false,
        message: `API returned status ${response.status}: ${response.statusText}`,
      };
    }
  } catch (error) {
    return {
      valid: false,
      message: `Connection error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export async function checkCI(options: CheckCIOptions = {}): Promise<void> {
  const { verbose } = options;

  console.log("🔍 Checking CircleCI connection...\n");

  // Step 1: Check for CIRCLE_TOKEN
  const token = process.env.CIRCLE_TOKEN;
  if (!token) {
    console.log("❌ CIRCLE_TOKEN environment variable is not set");
    console.log("\n   Set it with: export CIRCLE_TOKEN=your_token_here");
    console.log(
      "   Get a token from: https://app.circleci.com/settings/user/tokens",
    );
    process.exit(1);
  }

  console.log("✅ CIRCLE_TOKEN is set");
  if (verbose) {
    console.log(`   Token prefix: ${token.substring(0, 8)}...`);
  }

  // Step 2: Verify token with API call
  console.log("\n🔗 Verifying token with CircleCI API...");
  const tokenResult = await verifyToken(token);

  if (!tokenResult.valid) {
    console.log(`❌ ${tokenResult.message}`);
    process.exit(1);
  }

  console.log(`✅ ${tokenResult.message}`);
  if (tokenResult.user) {
    console.log(`   Authenticated as: ${tokenResult.user}`);
  }

  // Step 3: Check git context
  console.log("\n📁 Checking git context...");
  const remoteUrl = getGitRemoteUrl();
  const branch = getCurrentBranch();

  if (!remoteUrl) {
    console.log(
      "⚠️  No git remote found (not in a git repo or no 'origin' remote)",
    );
    console.log("\n✅ CircleCI connection verified! (token works)");
    return;
  }

  const projectSlug = parseProjectSlug(remoteUrl);
  if (!projectSlug) {
    console.log(`⚠️  Could not parse project slug from remote: ${remoteUrl}`);
    console.log("\n✅ CircleCI connection verified! (token works)");
    return;
  }

  console.log(`✅ Project: ${projectSlug}`);
  console.log(`   Branch: ${branch || "unknown"}`);

  // Step 4: Fetch CI status for current branch
  if (branch) {
    console.log("\n📊 Fetching CI status for current branch...");
    const ciStatus = await fetchCIStatus(projectSlug, branch, token);

    const statusEmoji: Record<string, string> = {
      success: "✅",
      failed: "❌",
      running: "🔄",
      not_run: "⏸️",
      unknown: "❓",
    };

    console.log(
      `${statusEmoji[ciStatus.status] || "❓"} CI Status: ${ciStatus.status}`,
    );
    if (ciStatus.message) {
      console.log(`   ${ciStatus.message}`);
    }
    if (ciStatus.pipelineNumber) {
      console.log(`   Pipeline #${ciStatus.pipelineNumber}`);
    }
    if (ciStatus.failedJobs && ciStatus.failedJobs.length > 0) {
      console.log(
        `   Failed jobs: ${ciStatus.failedJobs.map((j) => j.name).join(", ")}`,
      );
    }
  }

  console.log("\n✅ CircleCI connection verified!");
}
