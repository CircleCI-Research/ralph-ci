import { spawn, type ChildProcess, type SpawnOptions } from "child_process";

export interface PreventSleepHandle {
  stop(): void;
}

export type SpawnPreventSleep = (
  command: string,
  args: readonly string[],
  options: SpawnOptions,
) => ChildProcess;

/**
 * Keep macOS awake for the duration of a RalphCI run using `caffeinate`.
 * Prevents idle/system/display sleep from freezing agent timers mid-run.
 *
 * No-op on non-macOS platforms or when `caffeinate` is unavailable.
 */
export function startPreventSleep(
  pid: number = process.pid,
  spawnFn: SpawnPreventSleep = spawn,
): PreventSleepHandle | null {
  if (process.platform !== "darwin") {
    return null;
  }

  let proc: ChildProcess | null = null;
  try {
    proc = spawnFn("caffeinate", ["-dims", "-w", String(pid)], {
      stdio: "ignore",
    });
  } catch {
    return null;
  }

  proc.on("error", () => {
    proc = null;
  });

  return {
    stop() {
      if (proc && proc.exitCode === null && !proc.killed) {
        proc.kill("SIGTERM");
      }
      proc = null;
    },
  };
}
