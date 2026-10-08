/**
 * CircleCI compute-credit estimates from job duration + resource class.
 * These are duration-proportional estimates for experiment ledgers, not invoices.
 *
 * Rates: CircleCI Docker Linux credits per minute
 * https://circleci.com/docs/credits/
 */
export const DOCKER_CREDITS_PER_MINUTE: Record<string, number> = {
  small: 5,
  medium: 10,
  "medium+": 15,
  large: 20,
  xlarge: 40,
  "2xlarge": 80,
  "2xlarge+": 100,
};

export function normalizeResourceClass(
  resourceClass: string | undefined,
): string | undefined {
  if (!resourceClass) return undefined;
  const last = resourceClass.split("/").pop() ?? resourceClass;
  return last.replace(/^docker\./, "").replace(/^arm\./, "");
}

/**
 * Wall-clock for a job. Prefer ISO timestamps (authoritative) over `duration`,
 * whose unit has varied across CircleCI API versions.
 */
export function jobDurationMs(job: {
  duration?: number;
  started_at?: string | null;
  stopped_at?: string | null;
}): number {
  if (job.started_at && job.stopped_at) {
    const ms =
      new Date(job.stopped_at).getTime() - new Date(job.started_at).getTime();
    if (Number.isFinite(ms) && ms > 0) return ms;
  }
  if (typeof job.duration === "number" && job.duration > 0) {
    // Treat values larger than 3 hours-in-seconds as already milliseconds.
    return job.duration > 10_800 ? job.duration : job.duration * 1000;
  }
  return 0;
}

export function estimateCredits(
  resourceClass: string | undefined,
  durationMs: number,
): number | null {
  if (durationMs <= 0) return null;
  const key = normalizeResourceClass(resourceClass);
  if (!key) return null;
  const rate = DOCKER_CREDITS_PER_MINUTE[key];
  if (rate === undefined) return null;
  return (durationMs / 60_000) * rate;
}

export interface PipelineJobUsage {
  name: string;
  jobNumber: number;
  status: string;
  resourceClass?: string;
  durationMs: number;
  estimatedCredits: number | null;
}

export interface PipelineUsage {
  pipelineNumber?: number;
  workflowId?: string;
  jobCount: number;
  totalDurationMs: number;
  estimatedCredits: number | null;
  creditsComplete: boolean;
  jobs: PipelineJobUsage[];
}

export function sumPipelineUsage(jobs: PipelineJobUsage[]): {
  totalDurationMs: number;
  estimatedCredits: number | null;
  creditsComplete: boolean;
} {
  let totalDurationMs = 0;
  let creditSum = 0;
  let creditsComplete = jobs.length > 0;
  for (const job of jobs) {
    totalDurationMs += job.durationMs;
    if (job.estimatedCredits === null) {
      creditsComplete = false;
    } else {
      creditSum += job.estimatedCredits;
    }
  }
  return {
    totalDurationMs,
    estimatedCredits: jobs.length === 0 ? null : creditSum,
    creditsComplete,
  };
}
