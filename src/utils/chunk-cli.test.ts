import { describe, it, expect, vi, beforeEach } from "vitest";
import { execFileSync } from "child_process";
import { getChunkVersion, isChunkCliAvailable } from "./chunk-cli.js";

vi.mock("child_process", async (importOriginal) => {
  const mod = await importOriginal<typeof import("child_process")>();
  return {
    ...mod,
    execFileSync: vi.fn(),
  };
});

describe("chunk-cli", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getChunkVersion returns trimmed output on success", () => {
    vi.mocked(execFileSync).mockReturnValue("chunk version 1.2.3\n");
    expect(getChunkVersion("/tmp")).toBe("chunk version 1.2.3");
  });

  it("getChunkVersion returns null when exec fails", () => {
    vi.mocked(execFileSync).mockImplementation(() => {
      throw new Error("ENOENT");
    });
    expect(getChunkVersion()).toBeNull();
  });

  it("isChunkCliAvailable mirrors getChunkVersion", () => {
    vi.mocked(execFileSync).mockReturnValue("ok\n");
    expect(isChunkCliAvailable()).toBe(true);
    vi.mocked(execFileSync).mockImplementation(() => {
      throw new Error("nope");
    });
    expect(isChunkCliAvailable()).toBe(false);
  });
});
