import { describe, it, expect } from "vitest";
import { buildReviewGateFeedback } from "./review-gate.js";

describe("buildReviewGateFeedback", () => {
  it("includes Chunk sync failure section", () => {
    const feedback = buildReviewGateFeedback({
      passed: false,
      formatFixApplied: false,
      formatError: null,
      lintFixApplied: false,
      lintError: null,
      testsPass: true,
      testError: null,
      testTimedOut: false,
      chunkRemotePass: false,
      chunkSidecarSkipped: false,
      chunkSidecarSkipReason: null,
      chunkSyncError: "sync failed: no network",
      chunkRemoteError: null,
      chunkRemoteTimedOut: false,
      durationMs: 100,
    });
    expect(feedback).toContain("### Chunk sidecar sync failed");
    expect(feedback).toContain("sync failed: no network");
  });

  it("includes Chunk remote validate failure section", () => {
    const feedback = buildReviewGateFeedback({
      passed: false,
      formatFixApplied: false,
      formatError: null,
      lintFixApplied: false,
      lintError: null,
      testsPass: true,
      testError: null,
      testTimedOut: false,
      chunkRemotePass: false,
      chunkSidecarSkipped: false,
      chunkSidecarSkipReason: null,
      chunkSyncError: null,
      chunkRemoteError: "tests failed in sidecar",
      chunkRemoteTimedOut: false,
      durationMs: 100,
    });
    expect(feedback).toContain("### Chunk validate --remote failed");
    expect(feedback).toContain("tests failed in sidecar");
  });

  it("includes Chunk remote timeout section", () => {
    const feedback = buildReviewGateFeedback({
      passed: false,
      formatFixApplied: false,
      formatError: null,
      lintFixApplied: false,
      lintError: null,
      testsPass: true,
      testError: null,
      testTimedOut: false,
      chunkRemotePass: false,
      chunkSidecarSkipped: false,
      chunkSidecarSkipReason: null,
      chunkSyncError: null,
      chunkRemoteError: "timed out tail",
      chunkRemoteTimedOut: true,
      durationMs: 100,
    });
    expect(feedback).toContain("### Chunk validate --remote timed out");
    expect(feedback).toContain("timed out tail");
  });
});
