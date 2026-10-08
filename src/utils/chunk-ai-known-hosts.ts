/**
 * Chunk CLI and RalphCI tar-ssh both use `chunk_ai` SSH identity and
 * `chunk_ai_known_hosts` next to it (TOFU). E2B sidecar endpoints reuse hostnames
 * when VMs recycle, so stored keys go stale and Go/ssh2 reject with "host key mismatch".
 * Pruning `.e2b.app` lines before connecting forces a safe re-TOFU for those hosts only.
 */
import * as fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const CHUNK_AI_KNOWN_HOSTS_BASENAME = "chunk_ai_known_hosts";

/** Same resolution as Chunk CLI and RalphCI `tar-ssh` (see `chunk-sidecar-tar-sync.ts`). */
export function resolveChunkSshIdentityPath(): string {
  return (
    process.env.CHUNK_IDENTITY_FILE?.trim() ||
    process.env.RALPHCI_CHUNK_IDENTITY_FILE?.trim() ||
    path.join(os.homedir(), ".ssh", "chunk_ai")
  );
}

export function resolveChunkAiKnownHostsPath(): string {
  return path.join(
    path.dirname(resolveChunkSshIdentityPath()),
    CHUNK_AI_KNOWN_HOSTS_BASENAME,
  );
}

/**
 * Drop known_hosts lines that reference E2B sidecar hostnames (ephemeral SSH keys).
 * @returns counts and optional read/write error (non-fatal for callers).
 */
export function pruneE2bHostKeysFromChunkAiKnownHosts(): {
  pruned: number;
  knownHostsPath: string;
  error: string | null;
} {
  const knownHostsPath = resolveChunkAiKnownHostsPath();
  if (!fs.existsSync(knownHostsPath)) {
    return { pruned: 0, knownHostsPath, error: null };
  }

  let content: string;
  try {
    content = fs.readFileSync(knownHostsPath, "utf8");
  } catch (e) {
    return {
      pruned: 0,
      knownHostsPath,
      error: e instanceof Error ? e.message : String(e),
    };
  }

  const lines = content.split(/\r?\n/);
  const kept: string[] = [];
  let pruned = 0;
  for (const line of lines) {
    if (line.includes(".e2b.app")) {
      pruned++;
      continue;
    }
    kept.push(line);
  }

  if (pruned === 0) {
    return { pruned: 0, knownHostsPath, error: null };
  }

  const newContent =
    kept.join("\n").replace(/\n+$/, "") +
    (kept.some((l) => l.length > 0) ? "\n" : "");

  try {
    fs.writeFileSync(knownHostsPath, newContent, "utf8");
  } catch (e) {
    return {
      pruned,
      knownHostsPath,
      error: e instanceof Error ? e.message : String(e),
    };
  }

  return { pruned, knownHostsPath, error: null };
}
