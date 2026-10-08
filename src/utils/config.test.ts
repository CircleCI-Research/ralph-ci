import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  loadConfig,
  resolveCIDoctorConfig,
  resolvePreflightSurveyConfig,
  resolveReviewGateConfig,
} from "./config.js";
import { CommandError } from "./errors.js";
import { readFile } from "fs/promises";

// Mock fs/promises
vi.mock("fs/promises", () => ({
  readFile: vi.fn(),
}));

describe("loadConfig", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  it("should return default config when ralphci.json doesn't exist", async () => {
    const error: any = new Error("File not found");
    error.code = "ENOENT";
    vi.mocked(readFile).mockRejectedValue(error);

    const result = await loadConfig("/test/dir");

    expect(result).toEqual({
      config: {
        runner: "claude",
        taskSelection: "first-incomplete",
      },
      source: "default",
    });
    expect(console.log).toHaveBeenCalledWith(
      "No ralphci.json found, using default config (runner: claude)",
    );
  });

  it("should load valid config with claude runner", async () => {
    const configContent = JSON.stringify({
      runner: "claude",
    });
    vi.mocked(readFile).mockResolvedValue(configContent);

    const result = await loadConfig("/test/dir");

    expect(result).toEqual({
      config: {
        runner: "claude",
        model: undefined,
        taskSelection: "first-incomplete",
      },
      source: "working-directory",
      path: "/test/dir/ralphci.json",
    });
    expect(vi.mocked(readFile)).toHaveBeenCalledWith(
      "/test/dir/ralphci.json",
      "utf-8",
    );
    expect(console.log).toHaveBeenCalledWith(
      "Using config from /test/dir/ralphci.json",
    );
  });

  it("should load valid config with cursor runner and model", async () => {
    const configContent = JSON.stringify({
      runner: "cursor",
      model: "composer-1",
    });
    vi.mocked(readFile).mockResolvedValue(configContent);

    const result = await loadConfig("/test/dir");

    expect(result).toEqual({
      config: {
        runner: "cursor",
        model: "composer-1",
        taskSelection: "first-incomplete",
      },
      source: "working-directory",
      path: "/test/dir/ralphci.json",
    });
  });

  it("should use default runner if not specified", async () => {
    const configContent = JSON.stringify({
      model: "composer-1",
    });
    vi.mocked(readFile).mockResolvedValue(configContent);

    const result = await loadConfig("/test/dir");

    expect(result).toEqual({
      config: {
        runner: "claude",
        model: "composer-1",
        taskSelection: "first-incomplete",
      },
      source: "working-directory",
      path: "/test/dir/ralphci.json",
    });
  });

  it("should throw CommandError for invalid runner value", async () => {
    const configContent = JSON.stringify({
      runner: "invalid",
    });
    vi.mocked(readFile).mockResolvedValue(configContent);

    await expect(loadConfig("/test/dir")).rejects.toThrow(CommandError);
    await expect(loadConfig("/test/dir")).rejects.toThrow(
      'Invalid ralphci.json: runner must be "claude" or "cursor", got "invalid"',
    );
  });

  it("should throw CommandError for non-object config", async () => {
    const configContent = JSON.stringify("not an object");
    vi.mocked(readFile).mockResolvedValue(configContent);

    await expect(loadConfig("/test/dir")).rejects.toThrow(CommandError);
    await expect(loadConfig("/test/dir")).rejects.toThrow(
      "Invalid ralphci.json: config must be an object",
    );
  });

  it("should throw CommandError for invalid model type", async () => {
    const configContent = JSON.stringify({
      runner: "cursor",
      model: 123,
    });
    vi.mocked(readFile).mockResolvedValue(configContent);

    await expect(loadConfig("/test/dir")).rejects.toThrow(CommandError);
    await expect(loadConfig("/test/dir")).rejects.toThrow(
      "Invalid ralphci.json: model must be a string",
    );
  });

  it("should throw CommandError for invalid JSON", async () => {
    vi.mocked(readFile).mockResolvedValue("{ invalid json }");

    await expect(loadConfig("/test/dir")).rejects.toThrow(CommandError);
    await expect(loadConfig("/test/dir")).rejects.toThrow(
      /Invalid ralphci.json:/,
    );
  });

  it("should handle empty config object with defaults", async () => {
    const configContent = JSON.stringify({});
    vi.mocked(readFile).mockResolvedValue(configContent);

    const result = await loadConfig("/test/dir");

    expect(result).toEqual({
      config: {
        runner: "claude",
        model: undefined,
        taskSelection: "first-incomplete",
      },
      source: "working-directory",
      path: "/test/dir/ralphci.json",
    });
  });

  it("should use working directory config when both working and root configs exist", async () => {
    const workingConfigContent = JSON.stringify({
      runner: "cursor",
      model: "composer-1",
    });
    const _rootConfigContent = JSON.stringify({
      runner: "claude",
    });

    vi.mocked(readFile).mockResolvedValue(workingConfigContent);

    const result = await loadConfig("/test/working", "/test/root");

    expect(result).toEqual({
      config: {
        runner: "cursor",
        model: "composer-1",
        taskSelection: "first-incomplete",
      },
      source: "working-directory",
      path: "/test/working/ralphci.json",
    });
    expect(vi.mocked(readFile)).toHaveBeenCalledWith(
      "/test/working/ralphci.json",
      "utf-8",
    );
    expect(vi.mocked(readFile)).toHaveBeenCalledTimes(1);
  });

  it("should use root directory config when working directory has no ralphci.json", async () => {
    const workingError: any = new Error("File not found");
    workingError.code = "ENOENT";

    const rootConfigContent = JSON.stringify({
      runner: "cursor",
      model: "composer-2",
    });

    vi.mocked(readFile)
      .mockRejectedValueOnce(workingError)
      .mockResolvedValueOnce(rootConfigContent);

    const result = await loadConfig("/test/working", "/test/root");

    expect(result).toEqual({
      config: {
        runner: "cursor",
        model: "composer-2",
        taskSelection: "first-incomplete",
      },
      source: "root-directory",
      path: "/test/root/ralphci.json",
    });
    expect(vi.mocked(readFile)).toHaveBeenCalledWith(
      "/test/working/ralphci.json",
      "utf-8",
    );
    expect(vi.mocked(readFile)).toHaveBeenCalledWith(
      "/test/root/ralphci.json",
      "utf-8",
    );
    expect(vi.mocked(readFile)).toHaveBeenCalledTimes(2);
    expect(console.log).toHaveBeenCalledWith(
      "Config not found in working directory, using root config from /test/root/ralphci.json",
    );
  });

  it("should return default config when neither directory has ralphci.json", async () => {
    const error: any = new Error("File not found");
    error.code = "ENOENT";

    vi.mocked(readFile).mockRejectedValue(error);

    const result = await loadConfig("/test/working", "/test/root");

    expect(result).toEqual({
      config: {
        runner: "claude",
        taskSelection: "first-incomplete",
      },
      source: "default",
    });
    expect(vi.mocked(readFile)).toHaveBeenCalledWith(
      "/test/working/ralphci.json",
      "utf-8",
    );
    expect(vi.mocked(readFile)).toHaveBeenCalledWith(
      "/test/root/ralphci.json",
      "utf-8",
    );
    expect(vi.mocked(readFile)).toHaveBeenCalledTimes(2);
    expect(console.log).toHaveBeenCalledWith(
      "No ralphci.json found, using default config (runner: claude)",
    );
  });

  it("should throw CommandError for invalid taskSelection value", async () => {
    const configContent = JSON.stringify({
      runner: "claude",
      taskSelection: "invalid",
    });
    vi.mocked(readFile).mockResolvedValue(configContent);

    await expect(loadConfig("/test/dir")).rejects.toThrow(CommandError);
    await expect(loadConfig("/test/dir")).rejects.toThrow(
      'Invalid ralphci.json: taskSelection must be "first-incomplete" or "smart", got "invalid"',
    );
  });

  it("should load valid config with smart task selection", async () => {
    const configContent = JSON.stringify({
      runner: "claude",
      taskSelection: "smart",
    });
    vi.mocked(readFile).mockResolvedValue(configContent);

    const result = await loadConfig("/test/dir");

    expect(result).toEqual({
      config: {
        runner: "claude",
        model: undefined,
        taskSelection: "smart",
      },
      source: "working-directory",
      path: "/test/dir/ralphci.json",
    });
  });
});

describe("resolveReviewGateConfig", () => {
  it("merges chunkSidecar defaults when omitted", () => {
    const r = resolveReviewGateConfig({ enabled: true });
    expect(r.chunkSidecar.enabled).toBe(false);
    expect(r.chunkSidecar.syncTimeoutSeconds).toBe(180);
    expect(r.chunkSidecar.remoteValidateTimeoutSeconds).toBe(300);
    expect(r.chunkSidecar.strictCli).toBe(false);
    expect(r.chunkSidecar.skipSync).toBe(false);
    expect(r.chunkSidecar.remoteWorkdir).toBeUndefined();
    expect(r.chunkSidecar.syncMode).toBe("chunk-cli");
  });

  it("merges partial chunkSidecar from input", () => {
    const r = resolveReviewGateConfig({
      chunkSidecar: {
        enabled: true,
        strictCli: true,
        syncTimeoutSeconds: 300,
        remoteWorkdir: "./workspace/foo",
      },
    });
    expect(r.chunkSidecar.enabled).toBe(true);
    expect(r.chunkSidecar.strictCli).toBe(true);
    expect(r.chunkSidecar.syncTimeoutSeconds).toBe(300);
    expect(r.chunkSidecar.remoteValidateTimeoutSeconds).toBe(300);
    expect(r.chunkSidecar.remoteWorkdir).toBe("./workspace/foo");
    expect(r.chunkSidecar.syncMode).toBe("chunk-cli");
  });

  it("allows tar-ssh syncMode", () => {
    const r = resolveReviewGateConfig({
      chunkSidecar: { enabled: true, syncMode: "tar-ssh" },
    });
    expect(r.chunkSidecar.syncMode).toBe("tar-ssh");
  });

  it("rejects invalid chunkSidecar.syncMode", () => {
    expect(() =>
      resolveReviewGateConfig({
        chunkSidecar: { syncMode: "rsync" as "tar-ssh" },
      }),
    ).toThrow(CommandError);
  });

  it("sidecar-only disables local lint and tests", () => {
    const r = resolveReviewGateConfig({ innerLoop: "sidecar-only" });
    expect(r.innerLoop).toBe("sidecar-only");
    expect(r.lintFixEnabled).toBe(false);
    expect(r.testsEnabled).toBe(false);
    expect(r.formatFixEnabled).toBe(true);
  });

  it("local+sidecar keeps default lint and tests", () => {
    const r = resolveReviewGateConfig({ innerLoop: "local+sidecar" });
    expect(r.lintFixEnabled).toBe(true);
    expect(r.testsEnabled).toBe(true);
  });

  it("rejects invalid innerLoop", () => {
    expect(() =>
      resolveReviewGateConfig({ innerLoop: "sidecar" as "sidecar-only" }),
    ).toThrow(CommandError);
  });
});

describe("resolvePreflightSurveyConfig", () => {
  it("defaults to disabled", () => {
    expect(resolvePreflightSurveyConfig({}).enabled).toBe(false);
  });

  it("merges enabled flag", () => {
    expect(resolvePreflightSurveyConfig({ enabled: true }).enabled).toBe(true);
  });
});

describe("resolveCIDoctorConfig", () => {
  it("defaults logMode to full (baseline unshaped logs)", () => {
    const r = resolveCIDoctorConfig({});
    expect(r.logMode).toBe("full");
    expect(r.maxLogLength).toBe(0);
  });

  it("accepts failure-report logMode", () => {
    const r = resolveCIDoctorConfig({ logMode: "failure-report" });
    expect(r.logMode).toBe("failure-report");
  });

  it("rejects invalid logMode", () => {
    expect(() => resolveCIDoctorConfig({ logMode: "mcp" as "full" })).toThrow(
      CommandError,
    );
  });

  it("defaults maxInvocationsPerFailureFingerprint to 1", () => {
    const r = resolveCIDoctorConfig({});
    expect(r.maxInvocationsPerFailureFingerprint).toBe(1);
  });

  it("accepts a higher maxInvocationsPerFailureFingerprint", () => {
    const r = resolveCIDoctorConfig({ maxInvocationsPerFailureFingerprint: 3 });
    expect(r.maxInvocationsPerFailureFingerprint).toBe(3);
  });

  it("rejects maxInvocationsPerFailureFingerprint < 1", () => {
    expect(() =>
      resolveCIDoctorConfig({ maxInvocationsPerFailureFingerprint: 0 }),
    ).toThrow(CommandError);
  });
});
