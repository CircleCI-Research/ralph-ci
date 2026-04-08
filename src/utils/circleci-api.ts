/**
 * CircleCI API client for fetching pipeline status and failure logs.
 * Used by the CLI to inject CI status into the agent's context.
 */

// Node.js 18+ has native fetch
declare const fetch: typeof globalThis.fetch;

export interface CIStatus {
  status: "success" | "failed" | "running" | "not_run" | "unknown";
  /** The branch that was queried. Always set so consumers can verify scope. */
  branch?: string;
  pipelineNumber?: number;
  workflowId?: string;
  workflowName?: string;
  failedJobs?: Array<{
    name: string;
    jobNumber: number;
  }>;
  message?: string;
}

export interface CIFailureLogs {
  jobName: string;
  jobNumber: number;
  logs: string;
}

interface PipelineResponse {
  items: Array<{
    id: string;
    number: number;
    state: string;
    created_at: string;
  }>;
}

interface WorkflowResponse {
  items: Array<{
    id: string;
    name: string;
    status: string;
  }>;
}

interface JobResponse {
  items: Array<{
    id: string;
    name: string;
    job_number: number;
    status: string;
  }>;
}

// JobStepResponse removed - using v1.1 API response format directly

/**
 * Parse git remote URL to extract project slug.
 * Handles both HTTPS and SSH formats.
 */
export function parseProjectSlug(gitRemoteURL: string): string | null {
  // Handle SSH format: git@github.com:org/repo.git
  const sshMatch = gitRemoteURL.match(
    /git@github\.com:([^/]+)\/([^.]+)(?:\.git)?$/,
  );
  if (sshMatch) {
    return `gh/${sshMatch[1]}/${sshMatch[2]}`;
  }

  // Handle HTTPS format: https://github.com/org/repo.git
  const httpsMatch = gitRemoteURL.match(
    /https:\/\/github\.com\/([^/]+)\/([^./]+)(?:\.git)?$/,
  );
  if (httpsMatch) {
    return `gh/${httpsMatch[1]}/${httpsMatch[2]}`;
  }

  return null;
}

/**
 * Check the workflow status of a single pipeline.
 * Extracted so we can reuse it for both the latest and previous pipeline.
 */
async function checkPipelineWorkflows(
  pipelineId: string,
  pipelineNumber: number,
  token: string,
): Promise<CIStatus> {
  const workflowsUrl = `https://circleci.com/api/v2/pipeline/${pipelineId}/workflow`;
  const workflowsRes = await fetch(workflowsUrl, {
    headers: {
      "Circle-Token": token,
      "Content-Type": "application/json",
    },
  });

  if (!workflowsRes.ok) {
    return {
      status: "unknown",
      pipelineNumber,
      message: `Failed to fetch workflows: ${workflowsRes.status}`,
    };
  }

  const workflows = (await workflowsRes.json()) as WorkflowResponse;

  if (!workflows.items || workflows.items.length === 0) {
    return {
      status: "unknown",
      pipelineNumber,
      message: "No workflows found for pipeline",
    };
  }

  // Check workflow statuses
  const failedWorkflows = workflows.items.filter((w) => w.status === "failed");
  const runningWorkflows = workflows.items.filter(
    (w) => w.status === "running",
  );
  const successWorkflows = workflows.items.filter(
    (w) => w.status === "success",
  );

  if (failedWorkflows.length > 0) {
    // Get failed jobs from the first failed workflow
    const failedWorkflow = failedWorkflows[0];
    const jobsUrl = `https://circleci.com/api/v2/workflow/${failedWorkflow.id}/job`;
    const jobsRes = await fetch(jobsUrl, {
      headers: {
        "Circle-Token": token,
        "Content-Type": "application/json",
      },
    });

    let failedJobs: Array<{ name: string; jobNumber: number }> = [];

    if (jobsRes.ok) {
      const jobs = (await jobsRes.json()) as JobResponse;
      failedJobs = jobs.items
        .filter((j) => j.status === "failed")
        .map((j) => ({ name: j.name, jobNumber: j.job_number }));
    }

    return {
      status: "failed",
      pipelineNumber,
      workflowId: failedWorkflow.id,
      workflowName: failedWorkflow.name,
      failedJobs,
      message: `Workflow "${failedWorkflow.name}" failed`,
    };
  }

  if (runningWorkflows.length > 0) {
    return {
      status: "running",
      pipelineNumber,
      workflowId: runningWorkflows[0].id,
      workflowName: runningWorkflows[0].name,
      message: `Workflow "${runningWorkflows[0].name}" is running`,
    };
  }

  if (successWorkflows.length > 0) {
    return {
      status: "success",
      pipelineNumber,
      workflowId: successWorkflows[0].id,
      workflowName: successWorkflows[0].name,
      message: "All workflows passed",
    };
  }

  return {
    status: "unknown",
    pipelineNumber,
    message: "Unexpected workflow state",
  };
}

/**
 * Fetch the latest CI pipeline status for the current branch.
 * Only checks the most recent pipeline — no lookback to previous pipelines.
 */
export async function fetchCIStatus(
  projectSlug: string,
  branch: string,
  apiToken?: string,
): Promise<CIStatus> {
  const token = apiToken || process.env.CIRCLE_TOKEN;

  if (!token) {
    return {
      status: "unknown",
      branch: branch || undefined,
      message: "CIRCLE_TOKEN not set - cannot fetch CI status",
    };
  }

  if (!projectSlug) {
    return {
      status: "unknown",
      branch: branch || undefined,
      message: "Could not determine project slug from git remote",
    };
  }

  if (!branch) {
    return {
      status: "unknown",
      message:
        "No branch specified - cannot query CI (detached HEAD or empty branch name)",
    };
  }

  try {
    // Fetch latest pipelines ONLY for this specific branch
    const pipelinesUrl = `https://circleci.com/api/v2/project/${projectSlug}/pipeline?branch=${encodeURIComponent(branch)}`;
    const pipelinesRes = await fetch(pipelinesUrl, {
      headers: {
        "Circle-Token": token,
        "Content-Type": "application/json",
      },
    });

    if (!pipelinesRes.ok) {
      return {
        status: "unknown",
        branch,
        message: `Failed to fetch pipelines: ${pipelinesRes.status} ${pipelinesRes.statusText}`,
      };
    }

    const pipelines = (await pipelinesRes.json()) as PipelineResponse;

    if (!pipelines.items || pipelines.items.length === 0) {
      return {
        status: "not_run",
        branch,
        message: `No pipelines found for branch "${branch}"`,
      };
    }

    const latestPipeline = pipelines.items[0];

    // Check the latest pipeline's workflow status
    const latestStatus = await checkPipelineWorkflows(
      latestPipeline.id,
      latestPipeline.number,
      token,
    );

    latestStatus.branch = branch;

    return latestStatus;
  } catch (error) {
    return {
      status: "unknown",
      branch,
      message: `Error fetching CI status: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Fetch failure logs for a specific job.
 */
export async function fetchJobFailureLogs(
  projectSlug: string,
  jobNumber: number,
  apiToken?: string,
): Promise<string | null> {
  const token = apiToken || process.env.CIRCLE_TOKEN;

  if (!token || !projectSlug) {
    return null;
  }

  try {
    // Fetch job details to get step output URLs
    const jobUrl = `https://circleci.com/api/v2/project/${projectSlug}/job/${jobNumber}`;
    const jobRes = await fetch(jobUrl, {
      headers: {
        "Circle-Token": token,
        "Content-Type": "application/json",
      },
    });

    if (!jobRes.ok) {
      return null;
    }

    // Use v1.1 API to get step outputs (v2 doesn't have this)
    const stepsUrl = `https://circleci.com/api/v1.1/project/${projectSlug}/${jobNumber}`;
    const stepsRes = await fetch(stepsUrl, {
      headers: {
        "Circle-Token": token,
        "Content-Type": "application/json",
      },
    });

    if (!stepsRes.ok) {
      return null;
    }

    interface JobDetailsStep {
      actions?: Array<{
        name: string;
        status: string;
        output_url?: string;
      }>;
    }
    interface JobDetailsResponse {
      steps?: JobDetailsStep[];
    }

    const jobDetails = (await stepsRes.json()) as JobDetailsResponse;

    // Extract failed step outputs
    const failedSteps: string[] = [];

    if (jobDetails.steps) {
      for (const step of jobDetails.steps) {
        if (step.actions) {
          for (const action of step.actions) {
            if (action.status === "failed" && action.output_url) {
              try {
                const outputRes = await fetch(action.output_url, {
                  headers: {
                    "Circle-Token": token,
                  },
                });

                if (outputRes.ok) {
                  const outputData = await outputRes.json();
                  // Output is an array of {type, message} objects
                  if (Array.isArray(outputData)) {
                    const messages = outputData
                      .filter((o: { message?: string }) => o.message)
                      .map((o: { message: string }) => o.message)
                      .join("\n");
                    if (messages) {
                      failedSteps.push(`--- ${action.name} ---\n${messages}`);
                    }
                  }
                }
              } catch {
                // Skip if we can't fetch output
              }
            }
          }
        }
      }
    }

    if (failedSteps.length > 0) {
      return failedSteps.join("\n\n");
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Fetch all failure logs for failed jobs in a CI status.
 * Returns a formatted string with all failure information.
 *
 * @param maxLogLength - Maximum character length of combined logs.
 *   Default 0 = unlimited (CI Doctor mode). Pass a positive value
 *   to cap the output for contexts where token budget is tight
 *   (e.g., the Build Agent prompt).
 */
export async function fetchAllFailureLogs(
  projectSlug: string,
  ciStatus: CIStatus,
  apiToken?: string,
  maxLogLength: number = 0,
): Promise<string | null> {
  if (
    ciStatus.status !== "failed" ||
    !ciStatus.failedJobs ||
    ciStatus.failedJobs.length === 0
  ) {
    return null;
  }

  const logs: string[] = [];

  for (const job of ciStatus.failedJobs) {
    const jobLogs = await fetchJobFailureLogs(
      projectSlug,
      job.jobNumber,
      apiToken,
    );
    if (jobLogs) {
      logs.push(`## Failed Job: ${job.name} (#${job.jobNumber})\n\n${jobLogs}`);
    }
  }

  if (logs.length === 0) {
    return null;
  }

  let combined = logs.join("\n\n---\n\n");

  // Only truncate if a positive maxLogLength is specified
  if (maxLogLength > 0 && combined.length > maxLogLength) {
    combined =
      combined.substring(0, maxLogLength) + "\n\n[... logs truncated ...]";
  }

  return combined;
}

/**
 * Poll `fetchCIStatus` until the pipeline is no longer "running",
 * using exponential backoff (2s -> 4s -> 8s -> ... capped at 30s).
 *
 * Returns the settled status, or the last "running" status if
 * `maxWaitMs` is exceeded.
 *
 * @param onPoll - Optional callback invoked each poll with elapsed ms,
 *   so the caller can log progress.
 */
export async function pollUntilSettled(
  projectSlug: string,
  branch: string,
  maxWaitMs: number,
  apiToken?: string,
  onPoll?: (elapsedMs: number) => void,
): Promise<CIStatus> {
  const startTime = Date.now();
  let delay = 2000;
  const maxDelay = 30_000;

  let lastStatus = await fetchCIStatus(projectSlug, branch, apiToken);
  if (lastStatus.status !== "running") return lastStatus;

  while (Date.now() - startTime < maxWaitMs) {
    await new Promise((resolve) => globalThis.setTimeout(resolve, delay));

    const elapsed = Date.now() - startTime;
    if (onPoll) onPoll(elapsed);

    lastStatus = await fetchCIStatus(projectSlug, branch, apiToken);
    if (lastStatus.status !== "running") return lastStatus;

    delay = Math.min(delay * 2, maxDelay);
  }

  return lastStatus;
}
