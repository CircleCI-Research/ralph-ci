/**
 * Verify Chunk CLI installation, auth, and basic project/sidecar readiness.
 */

import path from "path";
import { execFileSync } from "child_process";
import { getChunkVersion } from "../utils/chunk-cli.js";

export interface CheckChunkOptions {
  verbose?: boolean;
  /** Repository root (default: cwd) */
  workingDirectory?: string;
  /**
   * When Chunk is missing, try `brew install CircleCI-Public/circleci/chunk` if Homebrew is on PATH.
   * Default true. Use false (or CLI `--no-brew-install`) in CI or when installs must not run automatically.
   */
  brewInstallWhenMissing?: boolean;
}

const AUTH_TIMEOUT_MS = 20_000;
const LIST_TIMEOUT_MS = 25_000;
const SIDECAR_TIMEOUT_MS = 20_000;
const BREW_VERSION_TIMEOUT_MS = 10_000;
/** Homebrew installs can take several minutes on a cold cache. */
const BREW_INSTALL_TIMEOUT_MS = 900_000;

function isHomebrewAvailable(): boolean {
  try {
    execFileSync("brew", ["--version"], {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      timeout: BREW_VERSION_TIMEOUT_MS,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Run `brew install` for the Chunk tap. Uses inherited stdio so the user sees progress.
 * Throws if brew exits non-zero.
 */
export function installChunkViaHomebrew(): void {
  execFileSync("brew", ["install", "CircleCI-Public/circleci/chunk"], {
    stdio: "inherit",
    timeout: BREW_INSTALL_TIMEOUT_MS,
    env: {
      ...process.env,
      HOMEBREW_NO_AUTO_UPDATE: process.env.HOMEBREW_NO_AUTO_UPDATE ?? "1",
    },
  });
}

function runChunk(
  args: string[],
  cwd: string,
  timeoutMs: number,
): { ok: true; output: string } | { ok: false; output: string } {
  try {
    const output = execFileSync("chunk", args, {
      cwd,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      timeout: timeoutMs,
    }).trim();
    return { ok: true, output };
  } catch (error) {
    let msg = error instanceof Error ? error.message : String(error);
    if (error && typeof error === "object") {
      const execError = error as { stdout?: unknown; stderr?: unknown };
      const stdout = execError.stdout ? String(execError.stdout).trim() : "";
      const stderr = execError.stderr ? String(execError.stderr).trim() : "";
      const parts = [stderr, stdout].filter(Boolean);
      if (parts.length > 0) {
        msg = parts.join("\n\n");
      }
    }
    return { ok: false, output: msg };
  }
}

function resolveChunkVersionOrExit(
  cwd: string,
  brewInstallWhenMissing: boolean,
): string {
  let version = getChunkVersion(cwd);
  if (version) {
    return version;
  }

  if (
    brewInstallWhenMissing &&
    (process.platform === "darwin" || process.platform === "linux") &&
    isHomebrewAvailable()
  ) {
    try {
      console.log("❌ Chunk CLI not found.");
      console.log(
        "\n📦 Installing Chunk via Homebrew (use --no-brew-install to skip)...\n",
      );
      installChunkViaHomebrew();
      version = getChunkVersion(cwd);
      if (version) {
        return version;
      }
      console.log("");
      console.log(
        "❌ Homebrew finished but `chunk` is still not on PATH. Open a new terminal or run: hash -r",
      );
      process.exit(1);
    } catch (error) {
      console.log("");
      console.log(
        `❌ Homebrew install failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      console.log("");
      console.log(
        "   Try manually: brew install CircleCI-Public/circleci/chunk",
      );
      process.exit(1);
    }
  }

  console.log("❌ Chunk CLI not found or not working.");
  if (!brewInstallWhenMissing) {
    console.log(
      "   (Automatic brew install was disabled — re-run without --no-brew-install to try Homebrew.)",
    );
  } else if (!isHomebrewAvailable()) {
    console.log(
      "   Homebrew not found on PATH. Install Chunk manually or install Homebrew first:",
    );
  }
  console.log("   Install: brew install CircleCI-Public/circleci/chunk");
  console.log("   Docs: https://github.com/CircleCI-Public/chunk-cli");
  process.exit(1);
}

export function checkChunk(options: CheckChunkOptions = {}): void {
  const verbose = options.verbose ?? false;
  const brewInstallWhenMissing = options.brewInstallWhenMissing ?? true;
  const cwd = path.resolve(options.workingDirectory ?? process.cwd());

  console.log("🔍 Checking Chunk CLI (CircleCI sidecars)...\n");

  const version = resolveChunkVersionOrExit(cwd, brewInstallWhenMissing);

  console.log(`✅ Chunk CLI\n   ${version}`);

  const token = process.env.CIRCLE_TOKEN;
  if (verbose) {
    if (token) {
      console.log(`\n   CIRCLE_TOKEN prefix: ${token.substring(0, 8)}...`);
    } else {
      console.log(
        "\n   CIRCLE_TOKEN is not set (Chunk may use credentials from `chunk auth`)",
      );
    }
  } else if (!token) {
    console.log(
      "\n   ℹ️  CIRCLE_TOKEN unset — ok if you already ran `chunk auth set circleci`",
    );
  }

  console.log("\n🔗 Chunk auth status...");
  const auth = runChunk(["auth", "status"], cwd, AUTH_TIMEOUT_MS);
  if (!auth.ok) {
    console.log("❌ Chunk auth check failed.");
    console.log("");
    console.log(auth.output);
    console.log("");
    console.log("   Try: chunk auth set circleci");
    console.log(
      "   Ensure CIRCLE_TOKEN or Chunk-stored credentials are valid (see Chunk CLI docs).",
    );
    process.exit(1);
  }
  console.log("✅ Authenticated with Chunk");
  if (auth.output.length > 0) {
    const lines = auth.output.split("\n");
    const prefix = verbose ? lines : lines.slice(0, 12);
    for (const line of prefix) {
      console.log(`   ${line}`);
    }
    if (!verbose && lines.length > 12) {
      console.log(`   … (${lines.length - 12} more lines; use -v)`);
    }
  }

  console.log("\n📋 Configured validations (`chunk validate --list`)...");
  const list = runChunk(["validate", "--list"], cwd, LIST_TIMEOUT_MS);
  if (list.ok) {
    if (list.output.length > 0) {
      console.log(
        list.output
          .split("\n")
          .map((l) => `   ${l}`)
          .join("\n"),
      );
    } else {
      console.log(
        "   (no output — run `chunk init` if this project is not configured yet)",
      );
    }
  } else {
    console.log(
      "⚠️  Could not list validations — run `chunk init` in this repository if needed.",
    );
    if (verbose) {
      console.log("");
      console.log(
        list.output
          .split("\n")
          .map((l) => `   ${l}`)
          .join("\n"),
      );
    }
  }

  console.log("\n☁️  Active sidecar (`chunk sidecar current`)...");
  const sidecar = runChunk(["sidecar", "current"], cwd, SIDECAR_TIMEOUT_MS);
  if (sidecar.ok && sidecar.output.length > 0) {
    console.log(
      sidecar.output
        .split("\n")
        .map((l) => `   ${l}`)
        .join("\n"),
    );
    console.log(
      "\n✅ Chunk looks ready for Review Gate `chunkSidecar` remote validation.",
    );
  } else {
    console.log(
      "⚠️  No active sidecar (or `sidecar current` failed). Create/select one before `validate --remote`:",
    );
    console.log("   chunk sidecar create --name <name>");
    console.log("   # or: chunk sidecar use <id>");
    if (verbose && !sidecar.ok) {
      console.log("");
      console.log(
        sidecar.output
          .split("\n")
          .map((l) => `   ${l}`)
          .join("\n"),
      );
    }
    console.log(
      "\n✅ Chunk CLI and auth OK — finish sidecar setup to use reviewGate.chunkSidecar.",
    );
  }
}
