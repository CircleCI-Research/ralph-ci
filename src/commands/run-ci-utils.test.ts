import { describe, it, expect } from "vitest";
import {
  applyInjectedCIToIterationMetric,
  buildCIDoctorPrompt,
  buildPromptContent,
  buildCiDoctorCommitBody,
  buildCiDoctorCommitSubject,
  buildIterationMetric,
  buildMissingPromiseTagReminder,
  computeBranchName,
  describePushStrategy,
  extractCommitDescription,
  extractCommitSummary,
  flattenPathForGitBranch,
  generateRunAttemptSuffix,
  getCoAuthor,
  hasOrchestratorCompletionTag,
  loadAfkMode,
  loadPreventSleepEnabled,
  loadGitConfig,
  maybeMarkFirstCIGreen,
  recordCIPushOutcome,
  prettifyModelId,
  resolveGitPushMode,
  shouldPollCIAfterIteration,
  shouldPushToRemote,
  updateMetricsSummary,
  type Metrics,
} from "./run-ci";
import type { FileSystem } from "../utils/file-helpers.js";

describe("buildCIDoctorPrompt", () => {
  it("adds Chunk-only preamble when pipeline is not failed and Chunk logs exist", () => {
    const prompt = buildCIDoctorPrompt(
      {
        status: { status: "success", branch: "main" },
        failureLogs: null,
        chunkSidecarFailureLogs: "## Chunk sidecar\n\nremote failed",
      },
      "/tmp/ws",
    );
    expect(prompt).toContain("Context: Chunk sidecar");
    expect(prompt).toContain("remote failed");
  });

  it("merges CircleCI and Chunk log sections when both are present", () => {
    const prompt = buildCIDoctorPrompt(
      {
        status: { status: "failed", branch: "main" },
        failureLogs: "circle stderr",
        chunkSidecarFailureLogs: "chunk stderr",
      },
      "/tmp/ws",
    );
    expect(prompt).not.toContain("Context: Chunk sidecar");
    expect(prompt).toContain("circle stderr");
    expect(prompt).toContain("chunk stderr");
  });

  it("adds failure-report and sidecar-only notes when configured", () => {
    const prompt = buildCIDoctorPrompt(
      {
        status: { status: "failed", branch: "main" },
        failureLogs: "lint error",
        logMode: "failure-report",
      },
      "/tmp/ws",
      { innerLoop: "sidecar-only" },
    );
    expect(prompt).toContain("pre-shaped report");
    expect(prompt).toContain("sidecar-only");
    expect(prompt).not.toContain("Failure Analysis Framework");
  });
});

describe("buildPromptContent", () => {
  const task = {
    category: "setup",
    description: "Example",
    steps: ["step one"],
    passes: false,
  };

  it("skips duplicate commit-description footer when template already has tag", async () => {
    const fs = {
      readFile: async (p: string) => {
        if (p.endsWith("prompt.md")) {
          return "@plan.md\n\n<commit-description>already here</commit-description>\n\nThe CLI will insert the current task details here when invoking the agent.";
        }
        throw new Error("ENOENT");
      },
    } as unknown as FileSystem;

    const result = await buildPromptContent(
      "/test",
      task,
      0,
      {
        enabled: false,
        provider: "none",
        waitForCI: false,
        maxCIWaitSeconds: 0,
        requireGreenBeforeComplete: false,
        approvalGateEnabled: false,
        branchStrategy: "feature-branch",
      },
      fs,
    );
    expect(result).toContain(
      "<commit-description>already here</commit-description>",
    );
    expect(result).not.toContain("## Commit Description");
  });

  it("uses manifest reminder after task 1", async () => {
    const fs = {
      readFile: async (p: string) => {
        if (p.endsWith("prompt.md")) {
          return "{{VALIDATION_MANIFEST}}\n\nThe CLI will insert the current task details here when invoking the agent.";
        }
        throw new Error("ENOENT");
      },
    } as unknown as FileSystem;

    const manifest = {
      generatedAt: "2026-01-01",
      innerGates: ["lint"],
      outerCiJobs: ["test"],
      gatePointers: [],
      markdown: "## Full manifest table",
    };

    const result = await buildPromptContent(
      "/test",
      task,
      2,
      {
        enabled: false,
        provider: "none",
        waitForCI: false,
        maxCIWaitSeconds: 0,
        requireGreenBeforeComplete: false,
        approvalGateEnabled: false,
        branchStrategy: "feature-branch",
      },
      fs,
      undefined,
      undefined,
      manifest,
      { includeValidationManifest: false },
    );
    expect(result).toContain("Gate pointers were injected on task 1");
    expect(result).not.toContain("Full manifest table");
  });

  it("inlines recent activity instead of @activity.md when log is long", async () => {
    const longActivity = Array.from(
      { length: 200 },
      (_, i) => `line ${i}`,
    ).join("\n");
    const fs = {
      readFile: async (p: string) => {
        if (p.endsWith("activity.md")) return longActivity;
        if (p.endsWith("prompt.md")) {
          return "@plan.md @activity.md\n\nThe CLI will insert the current task details here when invoking the agent.";
        }
        throw new Error("ENOENT");
      },
    } as unknown as FileSystem;

    const result = await buildPromptContent(
      "/test",
      task,
      0,
      {
        enabled: false,
        provider: "none",
        waitForCI: false,
        maxCIWaitSeconds: 0,
        requireGreenBeforeComplete: false,
        approvalGateEnabled: false,
        branchStrategy: "feature-branch",
      },
      fs,
      undefined,
      undefined,
      undefined,
      { activityRecentLineLimit: 50 },
    );
    expect(result).not.toContain("@activity.md");
    expect(result).toContain("Recent activity (last 50 of 200 lines");
    expect(result).toContain("line 199");
    expect(result).not.toContain("line 0\n");
  });
});

describe("hasOrchestratorCompletionTag", () => {
  it("returns true when any routing tag is present", () => {
    expect(
      hasOrchestratorCompletionTag("Done.\n<promise>success</promise>"),
    ).toBe(true);
    expect(
      hasOrchestratorCompletionTag("<promise>ci-fix-attempted</promise>"),
    ).toBe(true);
    expect(hasOrchestratorCompletionTag("<promise>COMPLETE</promise>")).toBe(
      true,
    );
  });

  it("returns false when tags are absent or malformed", () => {
    expect(hasOrchestratorCompletionTag("still working")).toBe(false);
    expect(hasOrchestratorCompletionTag("promise>success</promise>")).toBe(
      false,
    );
  });
});

describe("buildMissingPromiseTagReminder", () => {
  it("mentions task index and streak count", () => {
    const r = buildMissingPromiseTagReminder(5, 2);
    expect(r).toContain("task 5");
    expect(r).toContain("attempt **2**");
    expect(r).toContain("<promise>success</promise>");
  });

  it("marks needs-human disabled when AFK", () => {
    const r = buildMissingPromiseTagReminder(1, 1, { afk: true });
    expect(r).toContain("**disabled** (AFK / unattended)");
  });
});

describe("flattenPathForGitBranch", () => {
  it("replaces path separators so refs cannot nest", () => {
    expect(
      flattenPathForGitBranch(
        "experiments/cost-of-a-green-pr/runs/control/calibration",
      ),
    ).toBe("experiments__cost-of-a-green-pr__runs__control__calibration");
  });

  it("normalizes leading/trailing slashes and backslashes", () => {
    expect(flattenPathForGitBranch("/a/b/")).toBe("a__b");
    expect(flattenPathForGitBranch("a\\b\\c")).toBe("a__b__c");
  });
});

describe("generateRunAttemptSuffix", () => {
  it("returns 8 hex chars by default", () => {
    const s = generateRunAttemptSuffix();
    expect(s).toMatch(/^[0-9a-f]{8}$/);
  });

  it("differs across calls", () => {
    expect(generateRunAttemptSuffix()).not.toBe(generateRunAttemptSuffix());
  });
});

describe("computeBranchName", () => {
  it("uses experiment__uniqueId__attempt", () => {
    const name = computeBranchName(
      "/ignored/working/dir",
      "cost-of-a-green-pr-control-calibration",
      "deadbeef",
    );
    expect(name).toBe(
      "experiment__cost-of-a-green-pr-control-calibration__deadbeef",
    );
  });

  it("uses a fresh attempt suffix when none is provided", () => {
    const a = computeBranchName(
      "/tmp",
      "cost-of-a-green-pr-control-calibration",
    );
    const b = computeBranchName(
      "/tmp",
      "cost-of-a-green-pr-control-calibration",
    );
    expect(a).not.toBe(b);
    expect(a).toMatch(
      /^experiment__cost-of-a-green-pr-control-calibration__[0-9a-f]{8}$/,
    );
  });

  it("flattens slashes in uniqueId if present", () => {
    expect(computeBranchName("/tmp", "foo/bar", "abcd1234")).toBe(
      "experiment__foo__bar__abcd1234",
    );
  });
});

describe("loadAfkMode", () => {
  it("returns true only when afk is exactly true", async () => {
    const fs = {
      readFile: async () => JSON.stringify({ afk: true }),
    } as unknown as FileSystem;
    expect(await loadAfkMode("/tmp/ws", fs)).toBe(true);
  });

  it("returns false when missing or not true", async () => {
    const missing = {
      readFile: async () => {
        throw new Error("ENOENT");
      },
    } as unknown as FileSystem;
    expect(await loadAfkMode("/tmp/ws", missing)).toBe(false);

    const falsy = {
      readFile: async () => JSON.stringify({ afk: "yes" }),
    } as unknown as FileSystem;
    expect(await loadAfkMode("/tmp/ws", falsy)).toBe(false);
  });
});

describe("loadPreventSleepEnabled", () => {
  it("defaults to true when config is missing", async () => {
    const missing = {
      readFile: async () => {
        throw new Error("ENOENT");
      },
    } as unknown as FileSystem;
    expect(await loadPreventSleepEnabled("/tmp/ws", missing)).toBe(true);
  });

  it("returns false only when preventSleep is explicitly false", async () => {
    const fs = {
      readFile: async () => JSON.stringify({ preventSleep: false }),
    } as unknown as FileSystem;
    expect(await loadPreventSleepEnabled("/tmp/ws", fs)).toBe(false);
  });

  it("returns true when preventSleep is true or omitted", async () => {
    const enabled = {
      readFile: async () => JSON.stringify({ preventSleep: true }),
    } as unknown as FileSystem;
    expect(await loadPreventSleepEnabled("/tmp/ws", enabled)).toBe(true);

    const omitted = {
      readFile: async () => JSON.stringify({ afk: true }),
    } as unknown as FileSystem;
    expect(await loadPreventSleepEnabled("/tmp/ws", omitted)).toBe(true);
  });
});

describe("buildCiDoctorCommitSubject", () => {
  it("uses fix(ci) prefix for pipeline kind", () => {
    expect(buildCiDoctorCommitSubject("pipeline", "tune eslint rule")).toBe(
      "fix(ci): tune eslint rule",
    );
  });

  it("uses fix(ci-sidecar) prefix for sidecar kind", () => {
    expect(
      buildCiDoctorCommitSubject("sidecar", "harden chunk-remote-env.sh"),
    ).toBe("fix(ci-sidecar): harden chunk-remote-env.sh");
  });

  it("falls back to default subjects when summary missing", () => {
    expect(buildCiDoctorCommitSubject("pipeline", null)).toBe(
      "fix(ci): address pipeline failure",
    );
    expect(buildCiDoctorCommitSubject("sidecar", null)).toBe(
      "fix(ci-sidecar): address Chunk sidecar validate failure",
    );
  });
});

describe("buildCiDoctorCommitBody", () => {
  it("merges agent description with pipeline footer and job names", () => {
    const body = buildCiDoctorCommitBody(
      "pipeline",
      "Root cause: missing file.\n- add LEGAL_DISCLAIMER.md",
      {
        gatePassed: true,
        failedJobNames: ["require-legal-disclaimer-md"],
      },
    );
    expect(body).toContain("Root cause: missing file.");
    expect(body).toContain("Review gate passed after this CircleCI pipeline");
    expect(body).toContain("require-legal-disclaimer-md");
  });

  it("uses sidecar footer without job names", () => {
    const body = buildCiDoctorCommitBody("sidecar", null, {
      gatePassed: false,
    });
    expect(body).toContain("Review gate did not pass");
    expect(body).toContain("Chunk sidecar");
  });
});

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

describe("buildIterationMetric", () => {
  it("splits tokens and copies failure context from injected CI", () => {
    const row = buildIterationMetric({
      iteration: 3,
      agentRole: "ci-doctor",
      ciStatusAtStart: "failed",
      ciQueriesMade: 1,
      taskWorkedOn: "[CI Doctor] Fix pipeline failure",
      ciFailureFixed: true,
      outcome: "ci-fix-attempted",
      costUsd: 0.12,
      durationMs: 4000,
      usage: {
        input_tokens: 8000,
        output_tokens: 200,
        cache_read_input_tokens: 100,
      },
      injectedCI: {
        status: { status: "failed", pipelineNumber: 99 },
        failureLogs: "x",
        logMode: "full",
        failureContextChars: 182340,
        pipelineUsage: {
          pipelineNumber: 99,
          jobCount: 2,
          totalDurationMs: 120_000,
          estimatedCredits: 15,
          creditsComplete: true,
          jobs: [],
        },
      },
      stepTimings: { doctorMs: 4000, prefetchMs: 800 },
    });
    expect(row.tokensIn).toBe(8000);
    expect(row.tokensOut).toBe(200);
    expect(row.tokensUsed).toBe(8200);
    expect(row.failureContextChars).toBe(182340);
    expect(row.logMode).toBe("full");
    expect(row.estimatedCredits).toBe(15);
    expect(row.agentRole).toBe("ci-doctor");
  });

  it("uses explicit logMode when injected CI omitted (epilogue mid-run)", () => {
    const row = buildIterationMetric({
      iteration: 2,
      agentRole: "ci-doctor",
      ciStatusAtStart: "unknown",
      ciQueriesMade: 0,
      taskWorkedOn: "[CI Doctor] Fix Chunk sidecar (validate --remote) failure",
      ciFailureFixed: true,
      outcome: "ci-fix-attempted",
      costUsd: 0.1,
      durationMs: 0,
      usage: { input_tokens: 10, output_tokens: 5 },
      logMode: "failure-report",
    });
    expect(row.logMode).toBe("failure-report");
  });
});

describe("shouldPollCIAfterIteration", () => {
  it("polls after push even when CI was not running at start", () => {
    expect(
      shouldPollCIAfterIteration({
        ciEnabled: true,
        pushedThisIteration: true,
        ciWasRunningAtStart: false,
      }),
    ).toBe(true);
  });

  it("polls when CI was running and no push", () => {
    expect(
      shouldPollCIAfterIteration({
        ciEnabled: true,
        pushedThisIteration: false,
        ciWasRunningAtStart: true,
      }),
    ).toBe(true);
  });

  it("skips when CI disabled", () => {
    expect(
      shouldPollCIAfterIteration({
        ciEnabled: false,
        pushedThisIteration: true,
        ciWasRunningAtStart: true,
      }),
    ).toBe(false);
  });
});

describe("applyInjectedCIToIterationMetric", () => {
  it("copies pipeline usage onto an existing iteration row", () => {
    const row = buildIterationMetric({
      iteration: 7,
      agentRole: "build",
      ciStatusAtStart: "not-checked",
      ciQueriesMade: 0,
      taskWorkedOn: "task",
      ciFailureFixed: false,
      outcome: "success-local",
      costUsd: 1,
      durationMs: 1000,
    });
    applyInjectedCIToIterationMetric(row, {
      status: { status: "success", pipelineNumber: 1371 },
      failureLogs: null,
      logMode: "failure-report",
      pipelineUsage: {
        pipelineNumber: 1371,
        jobCount: 6,
        totalDurationMs: 180_000,
        estimatedCredits: 22.5,
        creditsComplete: true,
        jobs: [],
      },
    });
    expect(row.pipelineNumber).toBe(1371);
    expect(row.pipelineDurationMs).toBe(180_000);
    expect(row.estimatedCredits).toBe(22.5);
    expect(row.logMode).toBe("failure-report");
  });
});

describe("maybeMarkFirstCIGreen", () => {
  it("records elapsed ms from startTime on first success", () => {
    const metrics: Metrics = {
      startTime: new Date(Date.now() - 90_000).toISOString(),
      endTime: null,
      iterations: [],
      summary: {
        totalIterations: 0,
        totalTokens: 0,
        totalTokensIn: 0,
        totalTokensOut: 0,
        diagnosisTokens: 0,
        codegenTokens: 0,
        totalCost: 0,
        ciQueriesTotal: 0,
        ciFailuresEncountered: 0,
        ciFailuresFixed: 0,
        tasksCompleted: 0,
        timeToFirstCIGreen: null,
        totalDurationMs: 0,
        pipelineRuns: 0,
        totalPipelineDurationMs: 0,
        totalEstimatedCredits: null,
        innerLoopMode: null,
        ciPushesTotal: 0,
        ciPushesGreen: 0,
        everyCommitGreenRate: null,
        firstPushGreen: null,
      },
    };
    maybeMarkFirstCIGreen(metrics, {
      status: { status: "success", pipelineNumber: 1 },
      failureLogs: null,
    });
    expect(metrics.summary.timeToFirstCIGreen).toBeGreaterThan(80_000);
    const first = metrics.summary.timeToFirstCIGreen;
    maybeMarkFirstCIGreen(metrics, {
      status: { status: "success", pipelineNumber: 2 },
      failureLogs: null,
    });
    expect(metrics.summary.timeToFirstCIGreen).toBe(first);
  });
});

describe("recordCIPushOutcome", () => {
  function emptyMetrics(): Metrics {
    return {
      startTime: new Date().toISOString(),
      endTime: null,
      iterations: [],
      summary: {
        totalIterations: 0,
        totalTokens: 0,
        totalTokensIn: 0,
        totalTokensOut: 0,
        diagnosisTokens: 0,
        codegenTokens: 0,
        totalCost: 0,
        ciQueriesTotal: 0,
        ciFailuresEncountered: 0,
        ciFailuresFixed: 0,
        tasksCompleted: 0,
        timeToFirstCIGreen: null,
        totalDurationMs: 0,
        pipelineRuns: 0,
        totalPipelineDurationMs: 0,
        totalEstimatedCredits: null,
        innerLoopMode: "sidecar-only",
        ciPushesTotal: 0,
        ciPushesGreen: 0,
        everyCommitGreenRate: null,
        firstPushGreen: null,
      },
    };
  }

  it("computes everyCommitGreenRate for per-task pushes", () => {
    const metrics = emptyMetrics();
    recordCIPushOutcome(
      metrics,
      { autoPush: true, pushOnLocalSuccess: true, pushMode: "per-task" },
      { status: { status: "success" }, failureLogs: null },
    );
    recordCIPushOutcome(
      metrics,
      { autoPush: true, pushOnLocalSuccess: true, pushMode: "per-task" },
      { status: { status: "failed" }, failureLogs: "x" },
    );
    updateMetricsSummary(
      metrics,
      {
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalCacheReadTokens: 0,
        totalCost: 0,
      },
      1,
      [],
    );
    expect(metrics.summary.ciPushesTotal).toBe(2);
    expect(metrics.summary.ciPushesGreen).toBe(1);
    expect(metrics.summary.everyCommitGreenRate).toBe(0.5);
  });

  it("records firstPushGreen on epilogue first push", () => {
    const metrics = emptyMetrics();
    recordCIPushOutcome(
      metrics,
      { autoPush: true, pushOnLocalSuccess: true, pushMode: "epilogue" },
      { status: { status: "failed" }, failureLogs: "x" },
      { isFirstEpiloguePush: true },
    );
    expect(metrics.summary.firstPushGreen).toBe(false);
  });
});

describe("updateMetricsSummary", () => {
  it("counts unique pipelines once for credits and duration", () => {
    const metrics: Metrics = {
      startTime: new Date().toISOString(),
      endTime: null,
      iterations: [
        buildIterationMetric({
          iteration: 1,
          agentRole: "ci-doctor",
          ciStatusAtStart: "failed",
          ciQueriesMade: 1,
          taskWorkedOn: "doctor",
          ciFailureFixed: true,
          outcome: "ci-fix-attempted",
          costUsd: 0.1,
          durationMs: 1000,
          usage: { input_tokens: 100, output_tokens: 10 },
          injectedCI: {
            status: { status: "failed", pipelineNumber: 7 },
            failureLogs: "x",
            pipelineUsage: {
              pipelineNumber: 7,
              jobCount: 1,
              totalDurationMs: 60_000,
              estimatedCredits: 10,
              creditsComplete: true,
              jobs: [],
            },
          },
        }),
        buildIterationMetric({
          iteration: 2,
          agentRole: "build",
          ciStatusAtStart: "failed",
          ciQueriesMade: 0,
          taskWorkedOn: "snake",
          ciFailureFixed: false,
          outcome: "success-local",
          costUsd: 0.2,
          durationMs: 2000,
          usage: { input_tokens: 50, output_tokens: 5 },
          injectedCI: {
            status: { status: "failed", pipelineNumber: 7 },
            failureLogs: "x",
            pipelineUsage: {
              pipelineNumber: 7,
              jobCount: 1,
              totalDurationMs: 60_000,
              estimatedCredits: 10,
              creditsComplete: true,
              jobs: [],
            },
          },
        }),
      ],
      summary: {
        totalIterations: 0,
        totalTokens: 0,
        totalTokensIn: 0,
        totalTokensOut: 0,
        diagnosisTokens: 0,
        codegenTokens: 0,
        totalCost: 0,
        ciQueriesTotal: 0,
        ciFailuresEncountered: 0,
        ciFailuresFixed: 0,
        tasksCompleted: 0,
        timeToFirstCIGreen: null,
        totalDurationMs: 0,
        pipelineRuns: 0,
        totalPipelineDurationMs: 0,
        totalEstimatedCredits: null,
        innerLoopMode: "sidecar-only",
        ciPushesTotal: 0,
        ciPushesGreen: 0,
        everyCommitGreenRate: null,
        firstPushGreen: null,
      },
    };
    updateMetricsSummary(
      metrics,
      {
        totalInputTokens: 150,
        totalOutputTokens: 15,
        totalCacheReadTokens: 0,
        totalCost: 0.3,
      },
      2,
      [],
    );
    expect(metrics.summary.pipelineRuns).toBe(1);
    expect(metrics.summary.totalPipelineDurationMs).toBe(60_000);
    expect(metrics.summary.totalEstimatedCredits).toBe(10);
    expect(metrics.summary.diagnosisTokens).toBe(110);
    expect(metrics.summary.codegenTokens).toBe(55);
    expect(metrics.summary.totalTokensIn).toBe(150);
  });
});

describe("resolveGitPushMode / shouldPushToRemote / describePushStrategy", () => {
  it("defaults to per-task when pushMode is omitted", () => {
    expect(resolveGitPushMode({})).toBe("per-task");
    expect(resolveGitPushMode({ pushMode: "per-task" })).toBe("per-task");
    expect(resolveGitPushMode({ pushMode: "epilogue" })).toBe("epilogue");
  });

  it("defers remote push in epilogue mode until unlocked", () => {
    const epilogue = { autoPush: true, pushMode: "epilogue" as const };
    expect(shouldPushToRemote(epilogue, false)).toBe(false);
    expect(shouldPushToRemote(epilogue, true)).toBe(true);
  });

  it("allows push in per-task mode regardless of unlock flag", () => {
    const perTask = { autoPush: true, pushMode: "per-task" as const };
    expect(shouldPushToRemote(perTask, false)).toBe(true);
    expect(shouldPushToRemote(perTask, true)).toBe(true);
  });

  it("respects autoPush: false", () => {
    expect(
      shouldPushToRemote({ autoPush: false, pushMode: "per-task" }, true),
    ).toBe(false);
    expect(
      shouldPushToRemote({ autoPush: false, pushMode: "epilogue" }, true),
    ).toBe(false);
  });

  it("describes epilogue vs smart push strategies", () => {
    expect(
      describePushStrategy({
        autoPush: true,
        pushOnLocalSuccess: true,
        pushMode: "epilogue",
      }),
    ).toContain("epilogue");
    expect(
      describePushStrategy({
        autoPush: true,
        pushOnLocalSuccess: true,
        pushMode: "per-task",
      }),
    ).toContain("smart");
  });
});

describe("loadGitConfig pushMode", () => {
  function mockFs(ralphciJson: string): FileSystem {
    return {
      readFile: async () => ralphciJson,
      writeFile: async () => {},
      exists: async () => true,
      mkdir: async () => {},
    };
  }

  it("loads pushMode: epilogue from git section", async () => {
    const cfg = await loadGitConfig(
      "/tmp/ws",
      mockFs(
        JSON.stringify({
          git: {
            autoPush: true,
            pushOnLocalSuccess: true,
            pushMode: "epilogue",
          },
        }),
      ),
    );
    expect(cfg.pushMode).toBe("epilogue");
    expect(cfg.autoPush).toBe(true);
  });

  it("defaults pushMode to per-task when omitted", async () => {
    const cfg = await loadGitConfig(
      "/tmp/ws",
      mockFs(JSON.stringify({ git: { autoPush: true } })),
    );
    expect(cfg.pushMode).toBe("per-task");
  });

  it("ignores unknown pushMode values", async () => {
    const cfg = await loadGitConfig(
      "/tmp/ws",
      mockFs(JSON.stringify({ git: { pushMode: "whenever" } })),
    );
    expect(cfg.pushMode).toBe("per-task");
  });
});
