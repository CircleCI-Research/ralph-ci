import { describe, it, expect } from "vitest";
import {
  buildCIDoctorFingerprintSkipNotice,
  computeCIFailureFingerprint,
} from "./ci-failure-fingerprint.js";

describe("computeCIFailureFingerprint", () => {
  it("is stable for the same logs and jobs", () => {
    const jobs = [{ name: "build", jobNumber: 42 }];
    const logs = "error TS1005";
    expect(computeCIFailureFingerprint(logs, jobs)).toBe(
      computeCIFailureFingerprint(logs, jobs),
    );
  });

  it("ignores CRLF vs LF when normalizing", () => {
    const jobs = [{ name: "lint", jobNumber: 1 }];
    expect(computeCIFailureFingerprint("a\r\nb", jobs)).toBe(
      computeCIFailureFingerprint("a\nb", jobs),
    );
  });

  it("changes when failed job set changes", () => {
    const logs = "same";
    const a = computeCIFailureFingerprint(logs, [
      { name: "lint", jobNumber: 1 },
    ]);
    const b = computeCIFailureFingerprint(logs, [
      { name: "build", jobNumber: 1 },
    ]);
    expect(a).not.toBe(b);
  });
});

describe("buildCIDoctorFingerprintSkipNotice", () => {
  it("includes the short digest prefix", () => {
    const s = buildCIDoctorFingerprintSkipNotice("abc123deadbeef");
    expect(s).toContain("abc123deadbeef");
    expect(s).toContain("CI Doctor skipped");
  });
});
