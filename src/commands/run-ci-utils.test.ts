import { describe, it, expect } from "vitest";
import {
  extractCommitDescription,
  extractCommitSummary,
  getCoAuthor,
  prettifyModelId,
} from "./run-ci";

describe("extractCommitSummary", () => {
  it("should extract summary from agent output", () => {
    const output =
      "Fixed the issue.\n<commit-summary>restore LEGAL_DISCLAIMER.md required by CI check</commit-summary>\n<promise>ci-fix-attempted</promise>";
    expect(extractCommitSummary(output)).toBe(
      "restore LEGAL_DISCLAIMER.md required by CI check",
    );
  });

  it("should return null when tag is not present", () => {
    const output = "Fixed the issue.\n<promise>ci-fix-attempted</promise>";
    expect(extractCommitSummary(output)).toBeNull();
  });

  it("should return null when tag is empty", () => {
    const output = "<commit-summary></commit-summary>";
    expect(extractCommitSummary(output)).toBeNull();
  });

  it("should return null when tag contains only whitespace", () => {
    const output = "<commit-summary>   \n  </commit-summary>";
    expect(extractCommitSummary(output)).toBeNull();
  });

  it("should trim whitespace from summary", () => {
    const output = "<commit-summary>  fix lint errors  </commit-summary>";
    expect(extractCommitSummary(output)).toBe("fix lint errors");
  });

  it("should handle multiline content by trimming", () => {
    const output =
      "<commit-summary>\nadd missing dependency\n</commit-summary>";
    expect(extractCommitSummary(output)).toBe("add missing dependency");
  });
});

describe("extractCommitDescription", () => {
  it("should extract multiline description from agent output", () => {
    const output = `Done!
<commit-description>
Implement snake movement with keyboard controls:
- Add moveSnake() with direction-based updates
- Create game loop using setInterval
- Write unit tests for movement functions
</commit-description>
<promise>success</promise>`;
    expect(extractCommitDescription(output)).toBe(
      "Implement snake movement with keyboard controls:\n- Add moveSnake() with direction-based updates\n- Create game loop using setInterval\n- Write unit tests for movement functions",
    );
  });

  it("should return null when tag is not present", () => {
    expect(extractCommitDescription("just some output")).toBeNull();
  });

  it("should return null when tag is empty", () => {
    expect(
      extractCommitDescription("<commit-description></commit-description>"),
    ).toBeNull();
  });

  it("should return null when tag contains only whitespace", () => {
    expect(
      extractCommitDescription(
        "<commit-description>   \n  </commit-description>",
      ),
    ).toBeNull();
  });
});

describe("prettifyModelId", () => {
  it("should convert API model ID to friendly name", () => {
    expect(prettifyModelId("claude-sonnet-4-20250514")).toBe("Claude Sonnet 4");
  });

  it("should handle version with minor number", () => {
    expect(prettifyModelId("claude-haiku-3-5-20241022")).toBe(
      "Claude Haiku 3.5",
    );
  });

  it("should pass through already-friendly names", () => {
    expect(prettifyModelId("Claude Sonnet 4")).toBe("Claude Sonnet 4");
  });

  it("should pass through unrecognized formats", () => {
    expect(prettifyModelId("some-other-model")).toBe("some-other-model");
  });

  it("should handle model ID without date suffix", () => {
    expect(prettifyModelId("claude-opus-4")).toBe("Claude Opus 4");
  });
});

describe("getCoAuthor", () => {
  it("should use model from config when provided", () => {
    expect(getCoAuthor({ runner: "claude", model: "Claude Sonnet 4.6" })).toBe(
      "Claude Sonnet 4.6 <noreply@anthropic.com>",
    );
  });

  it("should default to 'Claude' when model is not set", () => {
    expect(getCoAuthor({ runner: "claude" })).toBe(
      "Claude <noreply@anthropic.com>",
    );
  });

  it("should prefer runtimeModel over config.model", () => {
    expect(
      getCoAuthor(
        { runner: "claude", model: "Claude Opus" },
        "claude-sonnet-4-20250514",
      ),
    ).toBe("Claude Sonnet 4 <noreply@anthropic.com>");
  });

  it("should prettify runtimeModel API IDs", () => {
    expect(getCoAuthor({ runner: "claude" }, "claude-haiku-3-5-20241022")).toBe(
      "Claude Haiku 3.5 <noreply@anthropic.com>",
    );
  });

  it("should fall back to config.model when runtimeModel is undefined", () => {
    expect(
      getCoAuthor({ runner: "claude", model: "Claude Opus" }, undefined),
    ).toBe("Claude Opus <noreply@anthropic.com>");
  });

  it("should use custom model string", () => {
    expect(getCoAuthor({ runner: "claude", model: "Claude Opus" })).toBe(
      "Claude Opus <noreply@anthropic.com>",
    );
  });
});
