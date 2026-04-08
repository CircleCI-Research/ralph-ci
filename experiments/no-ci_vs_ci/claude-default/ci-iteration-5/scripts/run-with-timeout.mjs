#!/usr/bin/env node

import { spawn } from "child_process";

const TIMEOUT_MS = 120_000; // 120 seconds

const [cmd, ...args] = process.argv.slice(2);

if (!cmd) {
  console.error("Usage: node run-with-timeout.mjs <command> [args...]");
  process.exit(1);
}

const child = spawn(cmd, args, {
  stdio: "inherit",
  shell: true,
});

const timer = setTimeout(() => {
  console.error(
    `\n⏱️  Test suite exceeded ${TIMEOUT_MS / 1000}s timeout. Killing process.`,
  );
  child.kill("SIGTERM");
  setTimeout(() => child.kill("SIGKILL"), 5000);
}, TIMEOUT_MS);

child.on("exit", (code) => {
  clearTimeout(timer);
  process.exit(code ?? 124);
});

child.on("error", (err) => {
  clearTimeout(timer);
  console.error("Failed to start process:", err);
  process.exit(1);
});
