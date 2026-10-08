/**
 * Cheap Chunk sidecar health probes for preflight (before Review Gate / AFK runs).
 */
import { execFileSync } from "child_process";

const EXEC_TIMEOUT_MS = 45_000;

export function isSidecarOutOfDateMessage(text: string): boolean {
  const t = text.toLowerCase();
  return (
    t.includes("sidecar is out of date") ||
    t.includes("this sidecar is out of date") ||
    (t.includes("out of date") && t.includes("sidecar"))
  );
}

export type SidecarHealthResult =
  | { ok: true; detail: string }
  | { ok: false; stale: boolean; detail: string };

/**
 * Probe the active sidecar with `chunk sidecar exec --command true`.
 * Detects Chunk's "sidecar is out of date" failure without a full validate.
 */
export function probeActiveSidecarHealth(cwd?: string): SidecarHealthResult {
  const workdir = cwd ?? process.cwd();
  try {
    const output = execFileSync(
      "chunk",
      ["sidecar", "exec", "--command", "true"],
      {
        cwd: workdir,
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
        timeout: EXEC_TIMEOUT_MS,
      },
    );
    return { ok: true, detail: (output ?? "").trim() || "exec ok" };
  } catch (error) {
    let detail = error instanceof Error ? error.message : String(error);
    if (error && typeof error === "object") {
      const execError = error as { stdout?: unknown; stderr?: unknown };
      const stdout = execError.stdout ? String(execError.stdout).trim() : "";
      const stderr = execError.stderr ? String(execError.stderr).trim() : "";
      const parts = [stderr, stdout].filter(Boolean);
      if (parts.length > 0) detail = parts.join("\n\n");
    }
    return {
      ok: false,
      stale: isSidecarOutOfDateMessage(detail),
      detail,
    };
  }
}
