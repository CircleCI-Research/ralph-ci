import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    testTimeout: 10_000, // 10 seconds per test
    globals: false,
  },
});
