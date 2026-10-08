import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
    exclude: ["**/node_modules/**", "experiments/**", "features/**", "**/._*"],
    testTimeout: 10_000,
    hookTimeout: 10_000,
  },
});
