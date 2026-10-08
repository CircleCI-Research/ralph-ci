import path from "path";
import { fileURLToPath } from "url";
import { describe, it, expect } from "vitest";
import {
  buildChunkSidecarDoctorLogs,
  buildReviewGateFeedback,
  chunkSidecarProducedDoctorLogs,
  resolveChunkRemoteWorkdir,
  resolveReviewGateTestFilter,
} from "./review-gate.js";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);

describe("resolveChunkRemoteWorkdir", () => {
  it("uses override when set", () => {
    expect(resolveChunkRemoteWorkdir("/any/path", "./workspace/custom")).toBe(
      "./workspace/custom",
    );
  });

  it("defaults to ./workspace/<basename> of nearest package root", () => {
    const experiment = path.join(
      repoRoot,
      "experiments",
      "w_chunk-sidecars",
      "iteration-1",
    );
    const expected = `./workspace/${path.basename(repoRoot)}`;
    expect(resolveChunkRemoteWorkdir(experiment)).toBe(expected);
  });
});

describe("resolveReviewGateTestFilter", () => {
  it("returns null for repo root (full suite)", () => {
    expect(resolveReviewGateTestFilter(repoRoot)).toBeNull();
  });

  it("scopes experiment run folders", () => {
    const runDir = path.join(
      repoRoot,
      "experiments",
      "cost-of-a-green-pr",
      "runs",
      "control",
      "calibration",
    );
    expect(resolveReviewGateTestFilter(runDir)).toBe(
      "experiments/cost-of-a-green-pr/runs/control/calibration",
    );
  });

  it("scopes feature iteration folders", () => {
    const runDir = path.join(
      repoRoot,
      "experiments",
      "w_chunk-sidecars",
      "iteration-1",
    );
    expect(resolveReviewGateTestFilter(runDir)).toBe(
      "experiments/w_chunk-sidecars/iteration-1",
    );
  });

  it("returns null for unrelated subfolders", () => {
    expect(resolveReviewGateTestFilter(path.join(repoRoot, "src"))).toBeNull();
  });
});

const baseChunkGate = {
  passed: false as const,
  formatFixApplied: false,
  formatError: null as string | null,
  lintFixApplied: false,
  lintError: null as string | null,
  testsPass: true,
  testError: null as string | null,
  testTimedOut: false,
  chunkRemotePass: false,
  chunkSidecarSkipped: false,
  chunkSidecarSkipReason: null as string | null,
  chunkSyncError: null as string | null,
  chunkRemoteError: null as string | null,
  chunkRemoteTimedOut: false,
  durationMs: 1,
};

describe("chunkSidecarProducedDoctorLogs / buildChunkSidecarDoctorLogs", () => {
  it("returns false / null when sidecar was skipped", () => {
    const r = {
      ...baseChunkGate,
      chunkSidecarSkipped: true,
      chunkSidecarSkipReason: "no chunk",
      chunkSyncError: "would be ignored",
    };
    expect(chunkSidecarProducedDoctorLogs(r)).toBe(false);
    expect(buildChunkSidecarDoctorLogs(r)).toBeNull();
  });

  it("bundles sync error for CI Doctor", () => {
    const r = { ...baseChunkGate, chunkSyncError: "rsync: connection refused" };
    expect(chunkSidecarProducedDoctorLogs(r)).toBe(true);
    const logs = buildChunkSidecarDoctorLogs(r);
    expect(logs).toContain("Workspace sync");
    expect(logs).toContain("rsync: connection refused");
  });
});

describe("buildReviewGateFeedback", () => {
  it("includes Chunk workspace upload failure section", () => {
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
    expect(feedback).toContain("### Chunk sidecar workspace upload failed");
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
