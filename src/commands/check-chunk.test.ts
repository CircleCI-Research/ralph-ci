import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { execFileSync } from "child_process";
import { checkChunk } from "./check-chunk.js";

vi.mock("child_process", async (importOriginal) => {
  const mod = await importOriginal<typeof import("child_process")>();
  return {
    ...mod,
    execFileSync: vi.fn(),
  };
});

describe("checkChunk", () => {
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    exitSpy = vi.spyOn(process, "exit").mockImplementation((code?: number) => {
      throw Object.assign(new Error(`EXIT_${code ?? 0}`), { code });
    });
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("exits 1 when chunk --version fails", () => {
    vi.mocked(execFileSync).mockImplementation(() => {
      throw new Error("ENOENT");
    });

    expect(() =>
      checkChunk({ workingDirectory: "/tmp/ralph-chunk-test" }),
    ).toThrow("EXIT_1");
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("exits 1 when chunk auth status fails", () => {
    vi.mocked(execFileSync).mockImplementation(
      (_file: string, args: readonly string[]) => {
        if (args[0] === "--version") {
          return "chunk v0.0.1-test\n";
        }
        if (args[0] === "auth") {
          const err = new Error("auth failed") as Error & {
            stderr?: string;
            stdout?: string;
          };
          err.stderr = "not logged in";
          throw err;
        }
        return "";
      },
    );

    expect(() =>
      checkChunk({ workingDirectory: "/tmp/ralph-chunk-test" }),
    ).toThrow("EXIT_1");
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("completes without exit when cli, auth, list, and sidecar succeed", () => {
    vi.mocked(execFileSync).mockImplementation(
      (_file: string, args: readonly string[]) => {
        if (args[0] === "--version") return "chunk v0.0.1-test\n";
        if (args[0] === "auth") return "circleci\n";
        if (args[0] === "validate") return "tests\n";
        if (args[0] === "sidecar") return "active-sidecar-1\n";
        return "";
      },
    );

    expect(() =>
      checkChunk({ workingDirectory: "/tmp/ralph-chunk-test" }),
    ).not.toThrow();
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it("does not exit when validate --list fails (warning only)", () => {
    vi.mocked(execFileSync).mockImplementation(
      (_file: string, args: readonly string[]) => {
        if (args[0] === "--version") return "chunk v0.0.1-test\n";
        if (args[0] === "auth") return "ok\n";
        if (args[0] === "validate") {
          throw new Error("no config");
        }
        if (args[0] === "sidecar") return "sc-1\n";
        return "";
      },
    );

    expect(() =>
      checkChunk({ workingDirectory: "/tmp/ralph-chunk-test" }),
    ).not.toThrow();
    expect(exitSpy).not.toHaveBeenCalled();
  });
});
