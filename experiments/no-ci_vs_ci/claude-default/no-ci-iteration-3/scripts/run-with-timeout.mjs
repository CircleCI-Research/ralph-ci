#!/usr/bin/env node
import { spawn } from "child_process";

const TIMEOUT_MS = 120_000; // 120 seconds
const args = process.argv.slice(2);

if (args.length === 0) {
  console.error("Usage: run-with-timeout.mjs <command> [args...]");
  process.exit(1);
}

const child = spawn(args[0], args.slice(1), {
  stdio: "inherit",
  shell: true,
});

const timeout = setTimeout(() => {
  console.error("\n⏱️  Test timeout exceeded (120s). Killing process...");
  child.kill("SIGTERM");
  setTimeout(() => child.kill("SIGKILL"), 1000);
}, TIMEOUT_MS);

child.on("exit", (code, signal) => {
  clearTimeout(timeout);
  if (signal) {
    console.error(`\nProcess killed with signal: ${signal}`);
    process.exit(124);
  }
  process.exit(code || 0);
});

child.on("error", (err) => {
  clearTimeout(timeout);
  console.error(`Failed to start process: ${err.message}`);
  process.exit(1);
});
