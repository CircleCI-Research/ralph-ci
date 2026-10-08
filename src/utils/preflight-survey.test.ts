import { describe, it, expect } from "vitest";
import {
  buildPreflightSurveyPrompt,
  isPreflightCompleteSignal,
} from "./preflight-survey.js";
import { generateValidationManifest } from "./validation-manifest.js";

describe("buildPreflightSurveyPrompt", () => {
  it("references manifest pointers and push mode", () => {
    const manifest = generateValidationManifest(process.cwd());
    const prompt = buildPreflightSurveyPrompt(
      "/tmp/run",
      process.cwd(),
      manifest,
      {
        pushMode: "epilogue",
        pushStrategyLabel:
          "epilogue (single push after all tasks locally green)",
      },
    );
    expect(prompt).toContain("preflight.md");
    expect(prompt).toContain("epilogue");
    expect(prompt).toContain("Validation Manifest");
    expect(prompt).not.toContain("create SNAKE.md");
  });
});

describe("isPreflightCompleteSignal", () => {
  it("detects preflight-complete tag", () => {
    expect(
      isPreflightCompleteSignal("<promise>preflight-complete</promise>"),
    ).toBe(true);
    expect(isPreflightCompleteSignal("<promise>success</promise>")).toBe(false);
  });
});
