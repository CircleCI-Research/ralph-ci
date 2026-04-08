import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CIQueryCache } from "./ci-cache.js";
import { InjectedCIStatus } from "../commands/run-ci.js";

function makeStatus(
  status: "success" | "failed" | "running",
  pipelineNumber?: number,
): InjectedCIStatus {
  return {
    status: {
      status,
      pipelineNumber,
    },
    failureLogs: null,
  };
}

describe("CIQueryCache", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("recordCIFix / isAlreadyFixed", () => {
    it("should return false for unknown pipeline numbers", () => {
      const cache = new CIQueryCache();
      expect(cache.isAlreadyFixed(42)).toBe(false);
    });

    it("should return false for undefined pipeline number", () => {
      const cache = new CIQueryCache();
      expect(cache.isAlreadyFixed(undefined)).toBe(false);
    });

    it("should return true after recording a fix for a pipeline", () => {
      const cache = new CIQueryCache();
      cache.recordCIFix(10);
      expect(cache.isAlreadyFixed(10)).toBe(true);
    });

    it("should track multiple fixed pipelines independently", () => {
      const cache = new CIQueryCache();
      cache.recordCIFix(10);
      cache.recordCIFix(15);
      expect(cache.isAlreadyFixed(10)).toBe(true);
      expect(cache.isAlreadyFixed(15)).toBe(true);
      expect(cache.isAlreadyFixed(12)).toBe(false);
    });

    it("should handle recording the same pipeline number twice", () => {
      const cache = new CIQueryCache();
      cache.recordCIFix(10);
      cache.recordCIFix(10);
      expect(cache.isAlreadyFixed(10)).toBe(true);
    });
  });

  describe("basic caching", () => {
    it("should return null when cache is empty", () => {
      const cache = new CIQueryCache();
      expect(cache.getCached()).toBeNull();
    });

    it("should cache and return a result when no push happened", () => {
      const cache = new CIQueryCache();
      const status = makeStatus("success", 10);
      cache.cacheResult(status);
      expect(cache.getCached()).toBe(status);
    });

    it("should invalidate cache after a push", () => {
      const cache = new CIQueryCache();
      const status = makeStatus("success", 10);
      cache.cacheResult(status);
      vi.advanceTimersByTime(1); // ensure push timestamp > query timestamp
      cache.recordPush();
      expect(cache.getCached()).toBeNull();
    });

    it("should always re-query when status is running", () => {
      const cache = new CIQueryCache();
      const status = makeStatus("running", 11);
      cache.cacheResult(status);
      expect(cache.getCached()).toBeNull();
    });

    it("should track query and cache hit stats", () => {
      const cache = new CIQueryCache();
      const status = makeStatus("success", 10);
      cache.cacheResult(status);
      cache.getCached(); // cache hit
      cache.getCached(); // cache hit
      const stats = cache.getStats();
      expect(stats.queries).toBe(1);
      expect(stats.cacheHits).toBe(2);
    });

    it("should force re-query after invalidate()", () => {
      const cache = new CIQueryCache();
      const status = makeStatus("failed", 10);
      cache.cacheResult(status);
      expect(cache.getCached()).toBe(status);
      cache.invalidate();
      expect(cache.getCached()).toBeNull();
      expect(cache.needsQuery()).toBe(true);
    });
  });

  describe("CI Doctor no-changes loop prevention", () => {
    it("recordCIFix without push should prevent CI Doctor re-invocation", () => {
      const cache = new CIQueryCache();
      const failedStatus = makeStatus("failed", 1015);

      cache.cacheResult(failedStatus);
      expect(cache.isAlreadyFixed(1015)).toBe(false);

      cache.recordCIFix(1015);
      expect(cache.isAlreadyFixed(1015)).toBe(true);
    });

    it("invalidate after no-push fix should force fresh CI query", () => {
      const cache = new CIQueryCache();
      const failedStatus = makeStatus("failed", 1015);

      cache.cacheResult(failedStatus);
      expect(cache.getCached()).toBe(failedStatus);

      cache.recordCIFix(1015);
      cache.invalidate();

      expect(cache.getCached()).toBeNull();
      expect(cache.needsQuery()).toBe(true);
      expect(cache.isAlreadyFixed(1015)).toBe(true);
    });
  });
});
