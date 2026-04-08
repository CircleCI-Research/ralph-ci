import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  fetchCIStatus,
  parseProjectSlug,
  pollUntilSettled,
} from "./circleci-api.js";

// Store the original fetch so we can restore it
const originalFetch = globalThis.fetch;

describe("parseProjectSlug", () => {
  it("parses SSH git remote URL", () => {
    expect(parseProjectSlug("git@github.com:myorg/myrepo.git")).toBe(
      "gh/myorg/myrepo",
    );
  });

  it("parses HTTPS git remote URL", () => {
    expect(parseProjectSlug("https://github.com/myorg/myrepo.git")).toBe(
      "gh/myorg/myrepo",
    );
  });

  it("parses HTTPS git remote URL without .git suffix", () => {
    expect(parseProjectSlug("https://github.com/myorg/myrepo")).toBe(
      "gh/myorg/myrepo",
    );
  });

  it("returns null for unrecognized URLs", () => {
    expect(parseProjectSlug("https://gitlab.com/myorg/myrepo")).toBeNull();
  });
});

describe("fetchCIStatus", () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    globalThis.fetch = mockFetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns unknown when no token is set", async () => {
    delete process.env.CIRCLE_TOKEN;
    const result = await fetchCIStatus("gh/org/repo", "main");
    expect(result.status).toBe("unknown");
    expect(result.message).toContain("CIRCLE_TOKEN");
  });

  it("returns unknown when branch is empty", async () => {
    const result = await fetchCIStatus("gh/org/repo", "", "fake-token");
    expect(result.status).toBe("unknown");
    expect(result.message).toContain("No branch specified");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("queries the API with the correct branch filter", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: [] }),
    });

    await fetchCIStatus("gh/org/repo", "feature/my-branch", "fake-token");
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain(
      "?branch=" + encodeURIComponent("feature/my-branch"),
    );
  });

  it("returns not_run when no pipelines exist", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: [] }),
    });

    const result = await fetchCIStatus("gh/org/repo", "main", "fake-token");
    expect(result.status).toBe("not_run");
    expect(result.branch).toBe("main");
  });

  it("returns failed status for a failed pipeline", async () => {
    // Pipelines response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        items: [
          {
            id: "pipe-1",
            number: 10,
            state: "created",
            created_at: "2026-01-01",
          },
        ],
      }),
    });
    // Workflows response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        items: [{ id: "wf-1", name: "build", status: "failed" }],
      }),
    });
    // Jobs response for failed workflow
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        items: [
          { id: "job-1", name: "test", job_number: 42, status: "failed" },
          { id: "job-2", name: "lint", job_number: 43, status: "success" },
        ],
      }),
    });

    const result = await fetchCIStatus("gh/org/repo", "main", "fake-token");
    expect(result.status).toBe("failed");
    expect(result.branch).toBe("main");
    expect(result.pipelineNumber).toBe(10);
    expect(result.workflowName).toBe("build");
    expect(result.failedJobs).toEqual([{ name: "test", jobNumber: 42 }]);
  });

  it("returns success status for a passing pipeline", async () => {
    // Pipelines response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        items: [
          {
            id: "pipe-1",
            number: 10,
            state: "created",
            created_at: "2026-01-01",
          },
        ],
      }),
    });
    // Workflows response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        items: [{ id: "wf-1", name: "build", status: "success" }],
      }),
    });

    const result = await fetchCIStatus("gh/org/repo", "main", "fake-token");
    expect(result.status).toBe("success");
    expect(result.branch).toBe("main");
    expect(result.message).toBe("All workflows passed");
  });

  it("returns running status for a running pipeline", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        items: [
          {
            id: "pipe-1",
            number: 10,
            state: "created",
            created_at: "2026-01-01",
          },
        ],
      }),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        items: [{ id: "wf-1", name: "build", status: "running" }],
      }),
    });

    const result = await fetchCIStatus("gh/org/repo", "main", "fake-token");
    expect(result.status).toBe("running");
    expect(result.branch).toBe("main");
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("only checks the latest pipeline, not previous ones", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        items: [
          {
            id: "pipe-2",
            number: 11,
            state: "created",
            created_at: "2026-01-02",
          },
          {
            id: "pipe-1",
            number: 10,
            state: "created",
            created_at: "2026-01-01",
          },
        ],
      }),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        items: [{ id: "wf-2", name: "build", status: "running" }],
      }),
    });

    const result = await fetchCIStatus("gh/org/repo", "main", "fake-token");
    expect(result.status).toBe("running");
    expect(result.pipelineNumber).toBe(11);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});

describe("pollUntilSettled", () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    globalThis.fetch = mockFetch;
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.useRealTimers();
  });

  function mockPipelineResponse(workflowStatus: string) {
    // Pipelines response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        items: [
          {
            id: "pipe-1",
            number: 10,
            state: "created",
            created_at: "2026-01-01",
          },
        ],
      }),
    });
    // Workflows response
    if (workflowStatus === "failed") {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [{ id: "wf-1", name: "build", status: "failed" }],
        }),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [
            { id: "job-1", name: "test", job_number: 42, status: "failed" },
          ],
        }),
      });
    } else {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [{ id: "wf-1", name: "build", status: workflowStatus }],
        }),
      });
    }
  }

  it("returns immediately if status is not running", async () => {
    mockPipelineResponse("success");

    const result = await pollUntilSettled(
      "gh/org/repo",
      "main",
      30_000,
      "fake-token",
    );
    expect(result.status).toBe("success");
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("polls and returns when pipeline settles to failed", async () => {
    mockPipelineResponse("running");
    mockPipelineResponse("failed");

    const result = await pollUntilSettled(
      "gh/org/repo",
      "main",
      30_000,
      "fake-token",
    );
    expect(result.status).toBe("failed");
  });

  it("returns running status when max wait is exceeded", async () => {
    mockPipelineResponse("running");
    // Keep returning running for any subsequent polls
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          {
            id: "pipe-1",
            number: 10,
            state: "created",
            created_at: "2026-01-01",
          },
        ],
      }),
    });
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [{ id: "wf-1", name: "build", status: "running" }],
      }),
    });

    // Very short timeout so we don't actually wait
    const result = await pollUntilSettled(
      "gh/org/repo",
      "main",
      100,
      "fake-token",
    );
    expect(result.status).toBe("running");
  });

  it("invokes onPoll callback during polling", async () => {
    mockPipelineResponse("running");
    mockPipelineResponse("success");

    const onPoll = vi.fn();
    await pollUntilSettled("gh/org/repo", "main", 30_000, "fake-token", onPoll);
    expect(onPoll).toHaveBeenCalled();
  });
});
