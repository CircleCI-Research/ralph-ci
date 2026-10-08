import { describe, it, expect } from "vitest";
import { isSidecarOutOfDateMessage } from "./chunk-sidecar-health.js";

describe("isSidecarOutOfDateMessage", () => {
  it("detects Chunk's canonical stale-sidecar error", () => {
    expect(
      isSidecarOutOfDateMessage("✗ Error: This sidecar is out of date."),
    ).toBe(true);
    expect(isSidecarOutOfDateMessage("sidecar is out of date")).toBe(true);
  });

  it("ignores unrelated failures", () => {
    expect(isSidecarOutOfDateMessage("ssh: handshake failed")).toBe(false);
    expect(isSidecarOutOfDateMessage("command not found")).toBe(false);
    expect(isSidecarOutOfDateMessage("")).toBe(false);
  });
});
