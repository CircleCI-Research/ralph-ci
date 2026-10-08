/**
 * CI Query Cache — avoids redundant CircleCI API calls.
 *
 * Tracks when the last push happened and caches the last CI status.
 * If no push occurred since the last query, returns the cached status
 * instead of hitting the API again.
 */

import { InjectedCIStatus } from "../commands/run-ci.js";

export class CIQueryCache {
  private lastPushTimestamp: number = 0;
  private lastQueryTimestamp: number = 0;
  private cachedStatus: InjectedCIStatus | null = null;
  private queryCount: number = 0;
  private cacheHitCount: number = 0;
  private fixedPipelineNumbers: Set<number> = new Set();
  /** CI Doctor invocations per {@link computeCIFailureFingerprint} (cleared on push). */
  private doctorInvocationsByFingerprint: Map<string, number> = new Map();

  /**
   * Record that a push just happened. This invalidates the cache.
   */
  recordPush(): void {
    this.lastPushTimestamp = Date.now();
    this.doctorInvocationsByFingerprint.clear();
  }

  /**
   * Check if a CI query is needed (i.e., a push happened since last query,
   * or we have no cached data, or the cached status was "running").
   */
  needsQuery(): boolean {
    // No cached data — must query
    if (!this.cachedStatus) return true;

    // A push happened since our last query — must query
    if (this.lastPushTimestamp > this.lastQueryTimestamp) return true;

    // Cached status is "running" — should re-check
    if (this.cachedStatus.status.status === "running") return true;

    // Cached status is "unknown" — should re-check
    if (this.cachedStatus.status.status === "unknown") return true;

    // Cache is valid
    return false;
  }

  /**
   * Store a fresh CI status result from the API.
   */
  cacheResult(result: InjectedCIStatus): void {
    this.cachedStatus = result;
    this.lastQueryTimestamp = Date.now();
    this.queryCount++;
  }

  /**
   * Get the cached status (null if cache is empty).
   */
  getCached(): InjectedCIStatus | null {
    if (this.cachedStatus && !this.needsQuery()) {
      this.cacheHitCount++;
      return this.cachedStatus;
    }
    return null;
  }

  /**
   * Record that CI Doctor addressed a specific pipeline failure.
   * Prevents re-triggering CI Doctor for the same failure while
   * the fix pipeline is still running.
   */
  recordCIFix(pipelineNumber: number): void {
    this.fixedPipelineNumbers.add(pipelineNumber);
  }

  /**
   * Check if a pipeline failure was already addressed by CI Doctor.
   */
  isAlreadyFixed(pipelineNumber?: number): boolean {
    if (pipelineNumber === undefined) return false;
    return this.fixedPipelineNumbers.has(pipelineNumber);
  }

  /**
   * Force-invalidate the cache (e.g., when we know state changed).
   */
  invalidate(): void {
    this.cachedStatus = null;
    this.doctorInvocationsByFingerprint.clear();
  }

  /**
   * How many times CI Doctor has completed a run for this failure fingerprint
   * in the current session (since last {@link recordPush}).
   */
  getDoctorInvocationsForFingerprint(fingerprint: string): number {
    return this.doctorInvocationsByFingerprint.get(fingerprint) ?? 0;
  }

  /**
   * True when CI Doctor should not run again for this fingerprint until after a push.
   */
  shouldSkipDoctorForFingerprint(
    fingerprint: string,
    maxInvocations: number,
  ): boolean {
    return (
      this.getDoctorInvocationsForFingerprint(fingerprint) >= maxInvocations
    );
  }

  /** Call once after each successful CI Doctor invocation for this fingerprint. */
  recordDoctorInvocationForFingerprint(fingerprint: string): void {
    const n = this.doctorInvocationsByFingerprint.get(fingerprint) ?? 0;
    this.doctorInvocationsByFingerprint.set(fingerprint, n + 1);
  }

  /**
   * Get cache statistics for metrics.
   */
  getStats(): { queries: number; cacheHits: number } {
    return {
      queries: this.queryCount,
      cacheHits: this.cacheHitCount,
    };
  }
}
