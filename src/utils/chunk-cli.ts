/**
 * Shared helpers for invoking the CircleCI Chunk CLI from RalphCI.
 */

import { execFileSync } from "child_process";

const VERSION_TIMEOUT_MS = 8_000;

/**
 * Whether the Chunk CLI is on PATH and responds to `--version`.
 */
export function isChunkCliAvailable(): boolean {
  return getChunkVersion() !== null;
}

/**
 * Trimmed output of `chunk --version`, or null if the CLI is missing or errors.
 */
export function getChunkVersion(cwd?: string): string | null {
  try {
    return execFileSync("chunk", ["--version"], {
      cwd: cwd ?? process.cwd(),
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      timeout: VERSION_TIMEOUT_MS,
    }).trim();
  } catch {
    return null;
  }
}
