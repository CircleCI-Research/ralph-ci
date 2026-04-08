#!/usr/bin/env node
/**
 * Cross-platform hard timeout wrapper for child processes.
 *
 * Usage:  node scripts/run-with-timeout.mjs <seconds> <command...>
 *
 * Exits with code 124 (same as GNU timeout) when the time limit is reached.
 *
 * Spawns the child in its own process group (detached) so that on exit
 * we can kill the entire group — this ensures vitest worker pools and
 * other child processes are cleaned up reliably.
 */
import { spawn } from "node:child_process";

const [secondsArg, ...cmdArgs] = process.argv.slice(2);
const seconds = Number(secondsArg);

if (!seconds || cmdArgs.length === 0) {
  console.error("Usage: run-with-timeout.mjs <seconds> <command...>");
  process.exit(1);
}

const child = spawn(cmdArgs[0], cmdArgs.slice(1), {
  stdio: "inherit",
  detached: true, // Create a new process group so we can kill the whole tree
});

// Don't let the detached child keep the parent alive on its own;
// we manage the lifecycle explicitly via the 'exit' handler below.
child.unref();

/**
 * Kill the entire process group (vitest + its worker pool).
 * Negative PID = send signal to every process in the group.
 */
function killGroup(signal = "SIGTERM") {
  try {
    process.kill(-child.pid, signal);
  } catch {
    /* group already dead */
  }
}

let exiting = false;

const timer = setTimeout(() => {
  console.error(
    `\n\n❌ HARD TIMEOUT: Tests exceeded ${seconds}s limit.\n` +
      "One or more tests are hanging or extremely slow.\n" +
      "Sending SIGINT to let vitest print its summary before exiting…\n",
  );

  // Step 1: SIGINT — vitest handles this gracefully and prints a report
  killGroup("SIGINT");

  // Step 2: After 5s, escalate to SIGTERM (vitest should have reported by now)
  setTimeout(() => {
    console.error("Escalating to SIGTERM…");
    killGroup("SIGTERM");
  }, 5000);

  // Step 3: After 8s total, SIGKILL and exit
  setTimeout(() => {
    killGroup("SIGKILL");
    if (!exiting) {
      exiting = true;
      console.error(
        "\nAction required: optimize or fix the slow/hanging tests before retrying.\n",
      );
      process.exit(124);
    }
  }, 7000);
}, seconds * 1000);

child.on("exit", (code) => {
  if (exiting) return;
  exiting = true;
  clearTimeout(timer);

  // Kill any remaining processes in the group (vitest workers, etc.)
  killGroup("SIGTERM");

  // Give stragglers a moment, then SIGKILL and exit
  setTimeout(() => {
    killGroup("SIGKILL");
    process.exit(code ?? 1);
  }, 500);
});

// Forward signals so Ctrl-C kills the whole group
for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    killGroup(sig);
  });
}
