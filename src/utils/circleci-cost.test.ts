import { describe, it, expect } from "vitest";
import {
  estimateCredits,
  jobDurationMs,
  normalizeResourceClass,
  sumPipelineUsage,
} from "./circleci-cost.js";

describe("normalizeResourceClass", () => {
  it("strips executor prefixes", () => {
    expect(normalizeResourceClass("arm.medium")).toBe("medium");
    expect(normalizeResourceClass("docker.large")).toBe("large");
    expect(normalizeResourceClass("circleci/medium+")).toBe("medium+");
    expect(normalizeResourceClass("small")).toBe("small");
  });
});

describe("jobDurationMs", () => {
  it("prefers ISO timestamps", () => {
    expect(
      jobDurationMs({
        duration: 1,
        started_at: "2026-08-26T20:00:00.000Z",
        stopped_at: "2026-08-26T20:00:45.000Z",
      }),
    ).toBe(45_000);
  });

  it("treats small duration values as seconds", () => {
    expect(jobDurationMs({ duration: 45 })).toBe(45_000);
  });

  it("treats large duration values as milliseconds", () => {
    expect(jobDurationMs({ duration: 45_000 })).toBe(45_000);
  });
});

describe("estimateCredits", () => {
  it("uses Docker Linux per-minute rates", () => {
    expect(estimateCredits("medium", 60_000)).toBe(10);
    expect(estimateCredits("small", 30_000)).toBe(2.5);
  });

  it("returns null when the class is unknown", () => {
    expect(estimateCredits("macos.m1.medium.gen1", 60_000)).toBeNull();
    expect(estimateCredits(undefined, 60_000)).toBeNull();
  });
});

describe("sumPipelineUsage", () => {
  it("marks credits incomplete when a job has no rate", () => {
    const sum = sumPipelineUsage([
      {
        name: "lint",
        jobNumber: 1,
        status: "success",
        resourceClass: "medium",
        durationMs: 60_000,
        estimatedCredits: 10,
      },
      {
        name: "mystery",
        jobNumber: 2,
        status: "success",
        durationMs: 10_000,
        estimatedCredits: null,
      },
    ]);
    expect(sum.totalDurationMs).toBe(70_000);
    expect(sum.estimatedCredits).toBe(10);
    expect(sum.creditsComplete).toBe(false);
  });
});
