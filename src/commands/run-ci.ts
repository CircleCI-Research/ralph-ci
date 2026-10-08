import path from "path";
import fs from "fs";
import { randomBytes } from "crypto";
import { tmpdir } from "os";
import {
  execSync,
  execFileSync,
  spawnSync,
  spawn,
  ChildProcess,
} from "child_process";
import { FileSystem, DefaultFileSystem } from "../utils/file-helpers.js";
import {
  PROMPT_CI_TEMPLATE,
  PROMPT_NO_CI_TEMPLATE,
  PROMPT_CI_DOCTOR_TEMPLATE,
  PROMPT_CI_DOCTOR_FAILURE_REPORT_NOTE,
  PROMPT_CI_DOCTOR_SIDECAR_ONLY_NOTE,
  METRICS_TEMPLATE,
} from "../templates/index.js";
import {
  c,
  printIterationSeparator,
  printFullPrompt,
  withSpinner,
} from "../utils/terminal.js";
import {
  parseProjectSlug,
  fetchCIStatus,
  fetchFailureContext,
  fetchPipelineUsage,
  pollUntilSettled,
  type CIStatus,
  type CIDoctorLogMode,
  type FailureContextSource,
  type PipelineUsage,
} from "../utils/circleci-api.js";
import {
  resolveReviewGateConfig,
  resolveCIDoctorConfig,
  resolveBuildAgentConfig,
  resolvePreflightSurveyConfig,
  type CIDoctorConfig,
  type ReviewGateInnerLoop,
} from "../utils/config.js";
import {
  generateValidationManifest,
  injectValidationManifestIntoPrompt,
  resolvePackageRoot,
  VALIDATION_MANIFEST_REMINDER,
  type ValidationManifest,
} from "../utils/validation-manifest.js";
import {
  buildPreflightSurveyPrompt,
  isPreflightCompleteSignal,
} from "../utils/preflight-survey.js";
import {
  runReviewGate,
  buildReviewGateFeedback,
  buildChunkSidecarDoctorLogs,
  resolveChunkRemoteWorkdir,
  type ReviewGateResult,
} from "../utils/review-gate.js";
import { CIQueryCache } from "../utils/ci-cache.js";
import { probeActiveSidecarHealth } from "../utils/chunk-sidecar-health.js";
import {
  buildCIDoctorFingerprintSkipNotice,
  computeCIFailureFingerprint,
} from "../utils/ci-failure-fingerprint.js";
import {
  startPreventSleep,
  type PreventSleepHandle,
} from "../utils/prevent-sleep.js";

export interface RunCIOptions {
  workingDirectory: string;
  maxIterations: number;
  ciWaitSeconds?: number;
  autoPush?: boolean;
  pushOnLocalSuccess?: boolean; // Only push when local tests pass (default: true)
  requireGreenBeforeComplete?: boolean;
  approvalGateEnabled?: boolean;
  branchStrategy?: "feature-branch" | "direct-to-main";
  unlimitedIterations?: boolean;
  ciEnabled?: boolean; // Enable/disable CI integration (default: true)
  verbose?: boolean; // Enable verbose output for debugging
  serveEnabled?: boolean; // Enable/disable local dev server (default: auto-detect)
  servePort?: number; // Port for local dev server (default: 3000)
  serveDirectory?: string; // Directory to serve (default: src)
  draftPR?: boolean; // Start PR as draft (default: true)
  /** Prevent macOS sleep for the duration of the run (default: true) */
  preventSleep?: boolean;
}

interface AttemptStats {
  attempt: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cost: number;
  durationMs: number;
}

export interface CumulativeStats {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheReadTokens: number;
  totalCost: number;
}

export interface Task {
  category: string;
  description: string;
  steps: string[];
  passes: boolean;
  ciVerified?: boolean;
  [key: string]: unknown;
}

export interface CIConfig {
  enabled: boolean;
  provider: string;
  waitForCI: boolean;
  maxCIWaitSeconds: number;
  requireGreenBeforeComplete: boolean;
  approvalGateEnabled: boolean;
  branchStrategy: "feature-branch" | "direct-to-main";
}

/** When to push to origin during a run. Default: per-task (after each Review Gate green). */
export type GitPushMode = "per-task" | "epilogue";

export interface GitConfig {
  autoPush: boolean;
  pushOnLocalSuccess: boolean;
  /**
   * `per-task` — push after each Review Gate–green task (default).
   * `epilogue` — local commits only until all tasks pass Review Gate, then one push
   * (further pushes allowed only for post-epilogue CI Doctor / fix loops).
   */
  pushMode?: GitPushMode;
  /** Base branch for feature branch creation. "current" = branch at run start. Default: auto-detect main/master. */
  baseBranch?: string;
}

export function resolveGitPushMode(gitConfig: {
  pushMode?: GitPushMode;
}): GitPushMode {
  return gitConfig.pushMode === "epilogue" ? "epilogue" : "per-task";
}

/**
 * Whether a remote `git push` is allowed right now.
 * In epilogue mode, pushes are deferred until `epilogueUnlocked` (all tasks locally green).
 */
export function shouldPushToRemote(
  gitConfig: Pick<GitConfig, "autoPush" | "pushMode">,
  epilogueUnlocked: boolean,
): boolean {
  if (!gitConfig.autoPush) return false;
  if (resolveGitPushMode(gitConfig) === "epilogue" && !epilogueUnlocked) {
    return false;
  }
  return true;
}

export function describePushStrategy(gitConfig: GitConfig): string {
  if (resolveGitPushMode(gitConfig) === "epilogue") {
    return "epilogue (one push after all tasks pass Review Gate)";
  }
  return gitConfig.pushOnLocalSuccess
    ? "on local success only (smart)"
    : "every commit (chatty)";
}

export interface ServeConfig {
  enabled: boolean;
  port: number;
  directory: string; // Relative to workingDirectory
}

export type AgentRole = "build" | "ci-doctor" | "smart-select";

export interface IterationStepTimings {
  prefetchMs?: number;
  ciPollMs?: number;
  doctorMs?: number;
  buildAgentMs?: number;
  reviewGateMs?: number;
}

export interface IterationMetric {
  iteration: number;
  timestamp: string;
  agentRole: AgentRole;
  ciStatusAtStart: string;
  ciQueriesMade: number;
  taskWorkedOn: string | null;
  ciFailureFixed: boolean;
  outcome: string;
  tokensUsed: number;
  tokensIn: number;
  tokensOut: number;
  cacheReadTokens: number;
  costUsd: number;
  durationMs: number;
  wallClockMs?: number;
  failureContextChars?: number;
  logMode?: CIDoctorLogMode;
  pipelineNumber?: number;
  pipelineDurationMs?: number;
  estimatedCredits?: number | null;
  creditsComplete?: boolean;
  stepTimings?: IterationStepTimings;
}

export interface Metrics {
  startTime: string | null;
  endTime: string | null;
  iterations: IterationMetric[];
  summary: {
    totalIterations: number;
    totalTokens: number;
    totalTokensIn: number;
    totalTokensOut: number;
    diagnosisTokens: number;
    codegenTokens: number;
    totalCost: number;
    ciQueriesTotal: number;
    ciFailuresEncountered: number;
    ciFailuresFixed: number;
    tasksCompleted: number;
    timeToFirstCIGreen: number | null;
    totalDurationMs: number;
    pipelineRuns: number;
    totalPipelineDurationMs: number;
    totalEstimatedCredits: number | null;
    innerLoopMode: ReviewGateInnerLoop | null;
    ciPushesTotal: number;
    ciPushesGreen: number;
    everyCommitGreenRate: number | null;
    firstPushGreen: boolean | null;
  };
}

/**
 * Kill orphaned vitest worker processes left behind by agent-spawned test runs.
 * Between iterations no vitest should be running, so anything still alive is an orphan.
 * Safe to call at any time — silently succeeds when there are no orphans.
 */
export function killOrphanedTestProcesses(): void {
  try {
    // Kill vitest fork workers (the CPU-pegging orphans)
    execSync('pkill -9 -f "vitest/dist/workers/forks.js"', {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    console.log(c.dim("  🧹 Cleaned up orphaned vitest worker processes"));
  } catch {
    // No matching processes — this is the happy path
  }
}

/**
 * Load and validate tasks.json from the working directory.
 */
export async function loadTasks(
  workingDirectory: string,
  fs: FileSystem = new DefaultFileSystem(),
): Promise<Task[]> {
  const tasksPath = path.join(workingDirectory, "tasks.json");
  const content = await fs.readFile(tasksPath);

  let tasks: unknown;
  try {
    tasks = JSON.parse(content);
  } catch (error) {
    throw new Error(
      `tasks.json is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  if (!Array.isArray(tasks)) {
    throw new Error("tasks.json must be a JSON array");
  }

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    if (typeof task !== "object" || task === null) {
      throw new Error(`Task at index ${i} must be an object`);
    }

    if (typeof task.category !== "string") {
      throw new Error(
        `Task at index ${i} missing required field: category (string)`,
      );
    }

    if (typeof task.description !== "string") {
      throw new Error(
        `Task at index ${i} missing required field: description (string)`,
      );
    }

    if (!Array.isArray(task.steps)) {
      throw new Error(
        `Task at index ${i} missing required field: steps (array)`,
      );
    }

    if (typeof task.passes !== "boolean") {
      throw new Error(
        `Task at index ${i} missing required field: passes (boolean)`,
      );
    }
  }

  return tasks as Task[];
}

/**
 * Select the next incomplete task (first task where passes !== true).
 */
export function selectNextTask(
  tasks: Task[],
): { task: Task; index: number } | null {
  for (let i = 0; i < tasks.length; i++) {
    if (tasks[i].passes !== true) {
      return { task: tasks[i], index: i };
    }
  }
  return null;
}

/**
 * Build a compact prompt for smart task selection.
 * Lists all incomplete tasks with their original indices.
 */
export function buildSmartSelectionPrompt(tasks: Task[]): string {
  const incompleteTasks: Array<{ index: number; task: Task }> = [];

  for (let i = 0; i < tasks.length; i++) {
    if (tasks[i].passes !== true) {
      incompleteTasks.push({ index: i, task: tasks[i] });
    }
  }

  const taskList = incompleteTasks
    .map(({ index, task }) => {
      return `Index ${index}: [${task.category}] ${task.description}`;
    })
    .join("\n");

  return `You are a task selection assistant. Choose the best next task to work on from the following incomplete tasks:

${taskList}

Consider:
- Task dependencies (some tasks may need to be done before others)
- Logical ordering (configuration before implementation, implementation before testing, testing before documentation)
- Current project state and what makes the most sense to tackle next

Respond with ONLY valid JSON in this exact format:
{"index": N}

Where N is the index number of the task you select. No explanation, no additional text, just the JSON object.`;
}

/**
 * Validate a smart selection response.
 * @returns The validated index, or null if invalid
 */
export function validateSmartSelection(
  responseText: string,
  tasks: Task[],
): number | null {
  const tryParse = (text: string): unknown => JSON.parse(text);
  const candidates: string[] = [];

  const trimmed = responseText.trim();
  if (trimmed.length > 0) {
    candidates.push(trimmed);
  }

  // Handle common "```json ... ```" / "``` ... ```" wrappers.
  const fenceMatch = trimmed.match(/^```(?:json)?\s*\n([\s\S]*?)\n```$/i);
  if (fenceMatch?.[1]) {
    const fenced = fenceMatch[1].trim();
    if (fenced.length > 0) {
      candidates.push(fenced);
    }
  }

  // As a last resort, try extracting the first {...} block.
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    const braceSlice = trimmed.slice(firstBrace, lastBrace + 1).trim();
    if (braceSlice.length > 0) {
      candidates.push(braceSlice);
    }
  }

  let parsed: unknown = null;
  for (const candidate of candidates) {
    try {
      parsed = tryParse(candidate);
      break;
    } catch {
      // keep trying candidates
    }
  }

  try {
    if (parsed === null) {
      return null;
    }

    // Check if it has an index field
    if (typeof parsed !== "object" || parsed === null) {
      return null;
    }

    if (
      !("index" in parsed) ||
      typeof (parsed as { index?: unknown }).index !== "number"
    ) {
      return null;
    }

    const index = (parsed as { index: number }).index;

    // Check if index is an integer
    if (!Number.isInteger(index)) {
      return null;
    }

    // Check if index is in valid range
    if (index < 0 || index >= tasks.length) {
      return null;
    }

    // Check if task at index is incomplete
    if (tasks[index].passes === true) {
      return null;
    }

    return index;
  } catch {
    // JSON parse error or any other error
    return null;
  }
}

/**
 * Result of smart task selection, including selection and usage data.
 */
export interface SmartSelectionResult {
  selection: { task: Task; index: number } | null;
  usage: import("../utils/claude-runner.js").AgentUsage | null;
  totalCostUsd: number;
  durationMs?: number;
}

/**
 * Attempt smart task selection using the runner.
 * @returns Selection result (task + index or null), plus usage/cost data from the runner
 */
export async function selectTaskSmart(
  tasks: Task[],
  workingDirectory: string,
  runner: import("../utils/claude-runner.js").AgentRunner,
  verbose: boolean = false,
  model?: string,
): Promise<SmartSelectionResult> {
  try {
    const promptContent = buildSmartSelectionPrompt(tasks);

    const response = await runner.runClaude({
      promptContent,
      workingDirectory,
      model,
    });

    const validatedIndex = validateSmartSelection(response.result, tasks);

    if (validatedIndex === null) {
      if (verbose) {
        console.warn(
          "\n--- Smart task selection debug (validation failed) ---",
        );
        console.warn("Prompt sent to runner:");
        console.warn(promptContent);
        console.warn("\nRunner response:");
        const trimmedResponse = response.result.trim();
        const previewLength = 500;
        if (trimmedResponse.length > previewLength) {
          console.warn(
            `${trimmedResponse.substring(0, previewLength)}...\n[truncated, full length: ${trimmedResponse.length} chars]`,
          );
        } else {
          console.warn(trimmedResponse);
        }
        console.warn("--- End debug ---\n");
      }
      // Selection failed validation, but return usage/cost data
      return {
        selection: null,
        usage: response.usage,
        totalCostUsd: response.total_cost_usd,
        durationMs: response.duration_ms,
      };
    }

    return {
      selection: {
        task: tasks[validatedIndex],
        index: validatedIndex,
      },
      usage: response.usage,
      totalCostUsd: response.total_cost_usd,
      durationMs: response.duration_ms,
    };
  } catch (error) {
    if (verbose) {
      console.warn("\n--- Smart task selection debug (runner error) ---");
      const promptContent = buildSmartSelectionPrompt(tasks);
      console.warn("Prompt sent to runner:");
      console.warn(promptContent);
      console.warn("\nRunner error:");
      if (error instanceof Error) {
        console.warn(`Message: ${error.message}`);
        if (error.stack) {
          console.warn(`Stack: ${error.stack}`);
        }
      } else {
        console.warn(String(error));
      }
      console.warn("--- End debug ---\n");
    }
    // Any error during smart selection returns null (no usage/cost available)
    return {
      selection: null,
      usage: null,
      totalCostUsd: 0,
    };
  }
}

/**
 * Mark a task as complete.
 */
export function markTaskComplete(
  tasks: Task[],
  index: number,
  ciVerified: boolean = false,
): Task[] {
  if (index < 0 || index >= tasks.length) {
    throw new Error(`Invalid task index: ${index}`);
  }

  const updatedTasks = tasks.map((task, i) => {
    if (i === index) {
      return { ...task, passes: true, ciVerified };
    }
    return { ...task };
  });

  return updatedTasks;
}

/**
 * Pre-fetched CI status to inject into prompt.
 */
export interface InjectedCIStatus {
  status: CIStatus;
  failureLogs: string | null;
  /**
   * Chunk `validate --remote` / sync failure output from the Review Gate (sidecar microbuild).
   * Merged into CI Doctor prompts like CircleCI job logs.
   */
  chunkSidecarFailureLogs?: string | null;
  logMode?: CIDoctorLogMode;
  failureContextChars?: number;
  failureContextSource?: FailureContextSource;
  pipelineUsage?: PipelineUsage | null;
}

export interface AgentUsageLike {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number;
}

export function buildIterationMetric(args: {
  iteration: number;
  agentRole: AgentRole;
  ciStatusAtStart: string;
  ciQueriesMade: number;
  taskWorkedOn: string | null;
  ciFailureFixed: boolean;
  outcome: string;
  costUsd: number;
  durationMs: number;
  usage?: AgentUsageLike;
  injectedCI?: InjectedCIStatus | null;
  wallClockMs?: number;
  stepTimings?: IterationStepTimings;
  logMode?: CIDoctorLogMode;
  failureContextChars?: number;
}): IterationMetric {
  const tokensIn = args.usage?.input_tokens ?? 0;
  const tokensOut = args.usage?.output_tokens ?? 0;
  const cacheReadTokens = args.usage?.cache_read_input_tokens ?? 0;
  const usage = args.injectedCI?.pipelineUsage;
  return {
    iteration: args.iteration,
    timestamp: new Date().toISOString(),
    agentRole: args.agentRole,
    ciStatusAtStart: args.ciStatusAtStart,
    ciQueriesMade: args.ciQueriesMade,
    taskWorkedOn: args.taskWorkedOn,
    ciFailureFixed: args.ciFailureFixed,
    outcome: args.outcome,
    tokensUsed: tokensIn + tokensOut,
    tokensIn,
    tokensOut,
    cacheReadTokens,
    costUsd: args.costUsd,
    durationMs: args.durationMs,
    wallClockMs: args.wallClockMs,
    failureContextChars:
      args.injectedCI?.failureContextChars ?? args.failureContextChars,
    logMode: args.injectedCI?.logMode ?? args.logMode,
    pipelineNumber: args.injectedCI?.status.pipelineNumber,
    pipelineDurationMs: usage?.totalDurationMs,
    estimatedCredits: usage?.estimatedCredits,
    creditsComplete: usage?.creditsComplete,
    stepTimings: args.stepTimings,
  };
}

/** Whether to poll CircleCI at end of iteration (after push or running pipeline). */
export function shouldPollCIAfterIteration(args: {
  ciEnabled: boolean;
  pushedThisIteration: boolean;
  ciWasRunningAtStart: boolean;
}): boolean {
  if (!args.ciEnabled) return false;
  if (args.pushedThisIteration) return true;
  return args.ciWasRunningAtStart;
}

/** Copy pipeline usage / failure context from a CI prefetch onto an iteration row. */
export function applyInjectedCIToIterationMetric(
  metric: IterationMetric,
  injected: InjectedCIStatus,
): void {
  if (typeof injected.failureContextChars === "number") {
    metric.failureContextChars = injected.failureContextChars;
  }
  if (injected.logMode) {
    metric.logMode = injected.logMode;
  }
  if (typeof injected.status.pipelineNumber === "number") {
    metric.pipelineNumber = injected.status.pipelineNumber;
  }
  const usage = injected.pipelineUsage;
  if (usage) {
    metric.pipelineDurationMs = usage.totalDurationMs;
    metric.estimatedCredits = usage.estimatedCredits;
    metric.creditsComplete = usage.creditsComplete;
  }
}

export function maybeMarkFirstCIGreen(
  metrics: Metrics,
  injectedCI: InjectedCIStatus | null,
): void {
  if (
    injectedCI?.status.status === "success" &&
    metrics.summary.timeToFirstCIGreen === null &&
    metrics.startTime
  ) {
    metrics.summary.timeToFirstCIGreen =
      Date.now() - new Date(metrics.startTime).getTime();
  }
}

/** Track push-level CI green rate for per-task vs single-push arms. */
export function recordCIPushOutcome(
  metrics: Metrics,
  gitConfig: GitConfig,
  injectedCI: InjectedCIStatus | null,
  options?: { isFirstEpiloguePush?: boolean },
): void {
  if (!injectedCI) return;
  const status = injectedCI.status.status;
  if (status !== "success" && status !== "failed") return;

  metrics.summary.ciPushesTotal += 1;
  if (status === "success") {
    metrics.summary.ciPushesGreen += 1;
  }

  if (
    resolveGitPushMode(gitConfig) === "epilogue" &&
    options?.isFirstEpiloguePush &&
    metrics.summary.firstPushGreen === null
  ) {
    metrics.summary.firstPushGreen = status === "success";
  }
}

/**
 * Build the prompt content for CI-aware or local-only workflow.
 */
export interface BuildPromptContentOptions {
  /** Inject full manifest on first task; later iterations get a one-line reminder. Default true. */
  includeValidationManifest?: boolean;
  /** Inline only the last N lines of activity.md instead of @-loading the full file. Default 150. */
  activityRecentLineLimit?: number;
}

const DEFAULT_ACTIVITY_RECENT_LINE_LIMIT = 150;

const COMMIT_DESCRIPTION_FOOTER = `

## Commit Description

When you complete a task, include a detailed commit description summarizing
your changes. The orchestrator uses this as the git commit body. Use imperative
mood and bullet points:

\`\`\`
<commit-description>
Implement snake movement with keyboard controls and game loop:
- Add moveSnake() with direction-based coordinate updates
- Implement keyboard event listeners for arrow keys
- Create 150ms game loop using setInterval
- Add boundary collision detection
- Write unit tests for all movement functions
</commit-description>
\`\`\`
`;

async function inlineRecentActivityInPrompt(
  promptTemplate: string,
  workingDirectory: string,
  fs: FileSystem,
  lineLimit: number,
): Promise<string> {
  if (!promptTemplate.includes("@activity.md")) {
    return promptTemplate;
  }
  try {
    const activity = await fs.readFile(
      path.join(workingDirectory, "activity.md"),
    );
    const lines = activity.split("\n");
    if (lines.length <= lineLimit) {
      return promptTemplate;
    }
    const recent = lines.slice(-lineLimit).join("\n");
    return promptTemplate.replace(
      "@activity.md",
      `## Recent activity (last ${lineLimit} of ${lines.length} lines; full log in activity.md)\n\n${recent}`,
    );
  } catch {
    return promptTemplate;
  }
}

export async function buildPromptContent(
  workingDirectory: string,
  task: Task,
  index: number,
  ciConfig: CIConfig,
  fs: FileSystem = new DefaultFileSystem(),
  injectedCI?: InjectedCIStatus,
  gitConfig: GitConfig = {
    autoPush: true,
    pushOnLocalSuccess: true,
    pushMode: "per-task",
  },
  validationManifest?: ValidationManifest,
  options: BuildPromptContentOptions = {},
): Promise<string> {
  const includeValidationManifest = options.includeValidationManifest ?? true;
  const activityRecentLineLimit =
    options.activityRecentLineLimit ?? DEFAULT_ACTIVITY_RECENT_LINE_LIMIT;

  const promptPath = path.join(workingDirectory, "prompt.md");
  let promptTemplate: string;

  try {
    promptTemplate = await fs.readFile(promptPath);
  } catch {
    // Use CI template if CI is enabled, otherwise use no-CI template
    promptTemplate = ciConfig.enabled
      ? PROMPT_CI_TEMPLATE
      : PROMPT_NO_CI_TEMPLATE;
  }

  promptTemplate = await inlineRecentActivityInPrompt(
    promptTemplate,
    workingDirectory,
    fs,
    activityRecentLineLimit,
  );

  // Build the task section
  const taskSection = `
## Current Task Details

\`\`\`json
${JSON.stringify(task, null, 2)}
\`\`\`

**Task Index:** ${index}
**Category:** ${task.category}
**Description:** ${task.description}

**Steps:**
${task.steps.map((step, i) => `${i + 1}. ${step}`).join("\n")}
`;

  // Replace placeholders
  let promptWithTask = promptTemplate.replace(
    "The CLI will insert the current task details here when invoking the agent.",
    taskSection,
  );

  if (validationManifest) {
    const manifestMarkdown = includeValidationManifest
      ? validationManifest.markdown
      : VALIDATION_MANIFEST_REMINDER;
    promptWithTask = injectValidationManifestIntoPrompt(
      promptWithTask,
      manifestMarkdown,
    );
  }

  try {
    const preflightNotes = await fs.readFile(
      path.join(workingDirectory, "preflight.md"),
    );
    if (preflightNotes.trim().length > 0) {
      promptWithTask = `@preflight.md\n\n${promptWithTask}`;
    }
  } catch {
    // preflight.md optional until Preflight Survey runs
  }

  // Only add CI context if CI is enabled
  if (ciConfig.enabled) {
    // Get git info for CI context
    let gitRemoteURL = "";
    let branch = "";
    try {
      gitRemoteURL = execSync("git remote get-url origin", {
        cwd: workingDirectory,
        encoding: "utf-8",
      }).trim();
      branch = execSync("git branch --show-current", {
        cwd: workingDirectory,
        encoding: "utf-8",
      }).trim();
    } catch {
      // Git info not available
    }

    // Build CI context section
    let ciContextSection = `
## CI Configuration

- **Provider:** ${ciConfig.provider}
- **Auto Push:** ${gitConfig.autoPush ? "enabled" : "disabled"}
- **Push Mode:** ${describePushStrategy(gitConfig)}
- **Require CI Green:** ${ciConfig.requireGreenBeforeComplete ? "yes" : "no"}
- **Approval Gate:** ${ciConfig.approvalGateEnabled ? "enabled" : "disabled"}
- **Branch Strategy:** ${ciConfig.branchStrategy}

## Git Context

- **Remote URL:** ${gitRemoteURL || "not configured"}
- **Current Branch:** ${branch || "unknown"}
- **Workspace Root:** ${workingDirectory}
`;
    if (resolveGitPushMode(gitConfig) === "epilogue") {
      ciContextSection += `
## Epilogue push mode

The orchestrator commits locally after each Review Gate–green task and **does not push** until **all** tasks have passed Review Gate. Do **not** expect mid-run CI status. Outer CircleCI runs only after that single epilogue push (and any later fix pushes).
`;
    }

    // Add pre-fetched CI status if available
    if (injectedCI) {
      const { status: ciStatus, failureLogs } = injectedCI;

      let statusEmoji = "❓";
      let statusText: string = ciStatus.status;
      if (ciStatus.status === "success") {
        statusEmoji = "✅";
        statusText = "PASSING";
      } else if (ciStatus.status === "failed") {
        statusEmoji = "❌";
        statusText = "FAILED";
      } else if (ciStatus.status === "running") {
        statusEmoji = "🔄";
        statusText = "RUNNING";
      } else if (ciStatus.status === "not_run") {
        statusEmoji = "⏸️";
        statusText = "NOT RUN";
      }

      ciContextSection += `
## CI Status (Pre-fetched by CLI — branch: ${ciStatus.branch || branch || "unknown"})

${statusEmoji} **Status:** ${statusText}
- **Branch:** ${ciStatus.branch || branch || "unknown"}
${ciStatus.pipelineNumber ? `- **Pipeline:** #${ciStatus.pipelineNumber}` : ""}
${ciStatus.workflowName ? `- **Workflow:** ${ciStatus.workflowName}` : ""}
${ciStatus.message ? `- **Details:** ${ciStatus.message}` : ""}
`;

      // Add failed jobs info
      if (ciStatus.failedJobs && ciStatus.failedJobs.length > 0) {
        ciContextSection += `
### Failed Jobs
${ciStatus.failedJobs.map((j) => `- ${j.name} (#${j.jobNumber})`).join("\n")}
`;
      }

      if (failureLogs) {
        ciContextSection += `
### CI Failure Logs

CI Doctor handles failures when enabled. If you see logs here, fix them before the planned task.

\`\`\`
${failureLogs}
\`\`\`
`;
      }

      if (ciStatus.status === "failed") {
        ciContextSection += `
### CI failing

Fix the CI failure before the planned task, then signal \`<promise>ci-fix-attempted</promise>\` with \`<commit-summary>\` and \`<commit-description>\`.
`;
      }
    }

    // Add CI context after the main instructions
    if (promptWithTask.includes("## Current Task")) {
      promptWithTask = promptWithTask.replace(
        "## Current Task",
        ciContextSection + "\n## Current Task",
      );
    } else {
      promptWithTask = promptWithTask + ciContextSection;
    }
  }

  // Inject commit-description instruction only when the template lacks it
  if (
    !promptWithTask.includes("<commit-description>") &&
    !promptWithTask.includes("## Commit Description")
  ) {
    promptWithTask += COMMIT_DESCRIPTION_FOOTER;
  }

  return promptWithTask;
}

function isChunkSidecarOnlyDoctorContext(ci: InjectedCIStatus): boolean {
  return (
    !!ci.chunkSidecarFailureLogs &&
    !ci.failureLogs &&
    ci.status.status !== "failed"
  );
}

/** CI Doctor prompt payload when only Chunk sidecar logs exist (or CI was not queried). */
function buildChunkSidecarDoctorInjection(
  injectedCI: InjectedCIStatus | null,
  workingDirectory: string,
  chunkLogs: string,
): InjectedCIStatus {
  if (injectedCI) {
    return {
      ...injectedCI,
      chunkSidecarFailureLogs: chunkLogs,
    };
  }
  let branch: string | undefined;
  try {
    branch = execSync("git branch --show-current", {
      cwd: workingDirectory,
      encoding: "utf-8",
    }).trim();
  } catch {
    branch = undefined;
  }
  return {
    status: {
      status: "not_run",
      branch,
      message:
        "No CircleCI pipeline context in this run (CI disabled or status unavailable). Fix the Chunk sidecar failure below.",
    },
    failureLogs: null,
    chunkSidecarFailureLogs: chunkLogs,
  };
}

/**
 * Build a focused prompt for the CI Doctor agent.
 * Minimal noise, maximum CI failure context.
 */
export function buildCIDoctorPrompt(
  injectedCI: InjectedCIStatus,
  workingDirectory: string,
  options?: { innerLoop?: ReviewGateInnerLoop },
): string {
  let prompt = PROMPT_CI_DOCTOR_TEMPLATE;

  if (injectedCI.logMode === "failure-report") {
    prompt += PROMPT_CI_DOCTOR_FAILURE_REPORT_NOTE;
  }
  if (options?.innerLoop === "sidecar-only") {
    prompt += PROMPT_CI_DOCTOR_SIDECAR_ONLY_NOTE;
  }

  if (isChunkSidecarOnlyDoctorContext(injectedCI)) {
    prompt += `

---

### Context: Chunk sidecar (not a CircleCI job failure)

Pipeline status below may be **green** or **not_run**. The actionable logs are from **Chunk \`validate --remote\`** (sidecar microbuild) during the Review Gate — treat them like CI job output (lint, test, install, config).

When you signal \`<promise>ci-fix-attempted</promise>\`, the orchestrator records commits with subject prefix **\`fix(ci-sidecar):\`** (not \`fix(ci):\`).
`;
  }

  // Add git context
  let gitRemoteURL = "";
  let branch = "";
  try {
    gitRemoteURL = execSync("git remote get-url origin", {
      cwd: workingDirectory,
      encoding: "utf-8",
    }).trim();
    branch = execSync("git branch --show-current", {
      cwd: workingDirectory,
      encoding: "utf-8",
    }).trim();
  } catch {
    // Git info not available
  }

  prompt += `
### Pipeline Information

- **Status:** ${injectedCI.status.status.toUpperCase()}
${injectedCI.status.pipelineNumber ? `- **Pipeline:** #${injectedCI.status.pipelineNumber}` : ""}
${injectedCI.status.workflowName ? `- **Workflow:** ${injectedCI.status.workflowName}` : ""}
${injectedCI.status.message ? `- **Message:** ${injectedCI.status.message}` : ""}
- **Branch:** ${branch || "unknown"}
- **Remote:** ${gitRemoteURL || "unknown"}
- **Workspace:** ${workingDirectory}
`;

  // Add failed jobs
  if (injectedCI.status.failedJobs && injectedCI.status.failedJobs.length > 0) {
    prompt += `
### Failed Jobs

${injectedCI.status.failedJobs.map((j) => `- **${j.name}** (job #${j.jobNumber})`).join("\n")}
`;
  }

  const circle = injectedCI.failureLogs;
  const chunk = injectedCI.chunkSidecarFailureLogs;

  if (circle && chunk) {
    prompt += `
### Full failure logs (CircleCI)

\`\`\`
${circle}
\`\`\`

### Chunk sidecar (\`validate --remote\` — mini-CI)

\`\`\`
${chunk}
\`\`\`
`;
  } else if (circle) {
    prompt += `
### Full Failure Logs

\`\`\`
${circle}
\`\`\`
`;
  } else if (chunk) {
    prompt += `
### Chunk sidecar (\`validate --remote\` — mini-CI)

\`\`\`
${chunk}
\`\`\`
`;
  } else {
    prompt += `
### Failure Logs

No detailed failure logs were retrieved from the API.
${
  options?.innerLoop === "sidecar-only"
    ? "Fix from sidecar output above if present; Review Gate re-validates."
    : "Try running the failing commands locally to reproduce (e.g. `pnpm lint`, `pnpm test:run`, `pnpm build`)."
}
`;
  }

  return prompt;
}

/**
 * Run the CI Doctor agent to diagnose and fix a CI failure.
 * Returns the agent response.
 */
export async function runCIDoctor(
  workingDirectory: string,
  injectedCI: InjectedCIStatus,
  runner: import("../utils/claude-runner.js").AgentRunner,
  model?: string,
  options?: { banner?: string; innerLoop?: ReviewGateInnerLoop },
): Promise<import("../utils/claude-runner.js").AgentResponse> {
  console.log(c.magenta(options?.banner ?? "\n  ─── CI Doctor ───"));
  console.log(
    c.magenta(
      isChunkSidecarOnlyDoctorContext(injectedCI)
        ? "  🏥 Diagnosing Chunk sidecar (validate --remote) failure..."
        : "  🏥 Diagnosing CI failure...",
    ),
  );

  const prompt = buildCIDoctorPrompt(injectedCI, workingDirectory, {
    innerLoop: options?.innerLoop,
  });

  printFullPrompt(prompt);

  const response = await withSpinner(
    "CI Doctor analyzing failure…",
    () =>
      runner.runClaude({
        promptContent: prompt,
        workingDirectory,
        model,
      }),
    "CI Doctor finished",
  );

  return response;
}

/**
 * Save tasks to tasks.json.
 */
export async function saveTasks(
  workingDirectory: string,
  tasks: Task[],
  fs: FileSystem = new DefaultFileSystem(),
): Promise<void> {
  const tasksPath = path.join(workingDirectory, "tasks.json");
  const content = JSON.stringify(tasks, null, 2) + "\n";
  await fs.writeFile(tasksPath, content);
}

/**
 * Update summary stats from iterations and cumulative data.
 * Call this before saving metrics to ensure summary is always accurate.
 */
export function updateMetricsSummary(
  metrics: Metrics,
  cumulative: CumulativeStats,
  currentIteration: number,
  tasks: Task[],
): void {
  metrics.summary.totalIterations = currentIteration;
  metrics.summary.totalTokens =
    cumulative.totalInputTokens + cumulative.totalOutputTokens;
  metrics.summary.totalTokensIn = cumulative.totalInputTokens;
  metrics.summary.totalTokensOut = cumulative.totalOutputTokens;
  metrics.summary.totalCost = cumulative.totalCost;
  metrics.summary.tasksCompleted = tasks.filter((t) => t.passes).length;
  metrics.summary.diagnosisTokens = metrics.iterations
    .filter((iter) => iter.agentRole === "ci-doctor")
    .reduce((sum, iter) => sum + (iter.tokensUsed || 0), 0);
  metrics.summary.codegenTokens = metrics.iterations
    .filter((iter) => iter.agentRole === "build")
    .reduce((sum, iter) => sum + (iter.tokensUsed || 0), 0);

  if (metrics.startTime) {
    metrics.summary.totalDurationMs =
      Date.now() - new Date(metrics.startTime).getTime();
  }

  // Calculate ciQueriesTotal from iterations
  metrics.summary.ciQueriesTotal = metrics.iterations.reduce(
    (total, iter) => total + (iter.ciQueriesMade || 0),
    0,
  );

  // Calculate ciFailuresEncountered and ciFailuresFixed from iterations
  metrics.summary.ciFailuresEncountered = metrics.iterations.filter(
    (iter) => iter.outcome === "ci-fix-attempted" || iter.ciFailureFixed,
  ).length;
  metrics.summary.ciFailuresFixed = metrics.iterations.filter(
    (iter) => iter.ciFailureFixed,
  ).length;

  const latestUsageByPipeline = new Map<
    number,
    { durationMs: number; credits: number | null }
  >();
  for (const iter of metrics.iterations) {
    if (typeof iter.pipelineNumber !== "number") continue;
    if (typeof iter.pipelineDurationMs !== "number") continue;
    latestUsageByPipeline.set(iter.pipelineNumber, {
      durationMs: iter.pipelineDurationMs,
      credits: iter.estimatedCredits ?? null,
    });
  }
  metrics.summary.pipelineRuns = latestUsageByPipeline.size;
  metrics.summary.totalPipelineDurationMs = [
    ...latestUsageByPipeline.values(),
  ].reduce((sum, row) => sum + row.durationMs, 0);
  const creditValues = [...latestUsageByPipeline.values()]
    .map((row) => row.credits)
    .filter((n): n is number => typeof n === "number");
  metrics.summary.totalEstimatedCredits =
    creditValues.length === 0
      ? null
      : creditValues.reduce((sum, n) => sum + n, 0);

  if (metrics.summary.ciPushesTotal > 0) {
    metrics.summary.everyCommitGreenRate =
      metrics.summary.ciPushesGreen / metrics.summary.ciPushesTotal;
  } else {
    metrics.summary.everyCommitGreenRate = null;
  }
}

/**
 * Save metrics to metrics.json.
 */
export async function saveMetrics(
  workingDirectory: string,
  metrics: Metrics,
  fs: FileSystem = new DefaultFileSystem(),
): Promise<void> {
  const metricsPath = path.join(workingDirectory, "metrics.json");
  const content = JSON.stringify(metrics, null, 2) + "\n";
  await fs.writeFile(metricsPath, content);
}

/**
 * Check if there are uncommitted changes.
 */
export function hasUncommittedChanges(workingDirectory: string): boolean {
  try {
    const status = execSync("git status --porcelain", {
      cwd: workingDirectory,
      encoding: "utf-8",
    });
    return status.trim().length > 0;
  } catch {
    return false;
  }
}

/**
 * Commit staged+unstaged changes (git add -A) with optional body and Co-authored-by.
 * Uses `git commit -F` so multiline bodies are safe. Does not push.
 *
 * @returns true if a new commit was created, false on failure or nothing to commit.
 */
export function gitCommit(
  workingDirectory: string,
  message: string,
  coAuthor?: string,
  body?: string,
): boolean {
  const parts = [message];
  if (body) parts.push(body);
  if (coAuthor) parts.push(`Co-authored-by: ${coAuthor}`);
  const fullMessage = parts.join("\n\n");

  const msgPath = path.join(
    tmpdir(),
    `ralphci-commit-${process.pid}-${Date.now()}.txt`,
  );
  try {
    fs.writeFileSync(msgPath, fullMessage, "utf8");
    execSync("git add -A", { cwd: workingDirectory, encoding: "utf-8" });
    execFileSync("git", ["commit", "-F", msgPath], {
      cwd: workingDirectory,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return true;
  } catch (error) {
    console.log(
      c.red(
        `Git commit failed: ${error instanceof Error ? error.message : String(error)}`,
      ),
    );
    return false;
  } finally {
    try {
      fs.unlinkSync(msgPath);
    } catch {
      // ignore missing temp file
    }
  }
}

/** Push current branch to its upstream (typically `origin`). */
export function gitPush(workingDirectory: string): void {
  try {
    execSync("git push", { cwd: workingDirectory, encoding: "utf-8" });
  } catch (error) {
    console.log(
      c.red(
        `Git push failed: ${error instanceof Error ? error.message : String(error)}`,
      ),
    );
  }
}

/**
 * Git commit and push changes.
 * Builds a conventional commit message: subject line, optional body,
 * and optional Co-authored-by trailer.
 */
export function gitCommitAndPush(
  workingDirectory: string,
  message: string,
  coAuthor?: string,
  body?: string,
): void {
  if (gitCommit(workingDirectory, message, coAuthor, body)) {
    gitPush(workingDirectory);
  }
}

/** Which CI Doctor path produced the fix (drives conventional commit prefix). */
export type CiDoctorCommitKind = "pipeline" | "sidecar";

/**
 * One-line subject for CI Doctor commits (`fix(ci):` vs `fix(ci-sidecar):`).
 */
export function buildCiDoctorCommitSubject(
  kind: CiDoctorCommitKind,
  summary: string | null,
): string {
  const prefix = kind === "pipeline" ? "fix(ci)" : "fix(ci-sidecar)";
  const trimmed = summary?.trim();
  if (trimmed) {
    return `${prefix}: ${trimmed}`;
  }
  return kind === "pipeline"
    ? "fix(ci): address pipeline failure"
    : "fix(ci-sidecar): address Chunk sidecar validate failure";
}

/**
 * Commit body for CI Doctor: optional agent `<commit-description>` plus a short
 * orchestrator footer (Review Gate outcome, failing job names when pipeline).
 */
export function buildCiDoctorCommitBody(
  kind: CiDoctorCommitKind,
  agentDescription: string | null,
  context: { gatePassed: boolean; failedJobNames?: string[] },
): string {
  const parts: string[] = [];
  const desc = agentDescription?.trim();
  if (desc) {
    parts.push(desc);
  }
  const gatePhrase = context.gatePassed ? "passed" : "did not pass";
  const tail =
    kind === "pipeline"
      ? `Review gate ${gatePhrase} after this CircleCI pipeline CI Doctor attempt.${
          context.failedJobNames && context.failedJobNames.length > 0
            ? ` Failing jobs: ${context.failedJobNames.join(", ")}.`
            : ""
        }`
      : `Review gate ${gatePhrase} after this Chunk sidecar (\`validate --remote\`) CI Doctor attempt.`;
  if (parts.length > 0) {
    parts.push("");
  }
  parts.push(tail);
  return parts.join("\n");
}

/**
 * Convert an API model ID (e.g. "claude-sonnet-4-20250514") to a friendly
 * display name (e.g. "Claude Sonnet 4"). Returns the input unchanged if
 * it doesn't match the expected pattern.
 */
export function prettifyModelId(modelId: string): string {
  // Already a friendly name (starts with uppercase, no date suffix)
  if (/^[A-Z]/.test(modelId) && !/-\d{8}$/.test(modelId)) return modelId;

  const m = modelId.match(/^claude-([a-z]+)-(\d+(?:-\d{1,2})?)(?:-\d{8})?$/);
  if (!m) return modelId;

  const family = m[1].charAt(0).toUpperCase() + m[1].slice(1);
  const version = m[2].replace(/-/g, ".");
  return `Claude ${family} ${version}`;
}

/**
 * Derive co-author string from runner/model config and optional runtime model.
 * Prefers runtimeModel (the actual model ID returned by the API) over the
 * static config value, prettifying API model IDs into friendly names.
 */
export function getCoAuthor(
  config: { runner: string; model?: string },
  runtimeModel?: string,
): string {
  const raw = runtimeModel || config.model || "Claude";
  return `${prettifyModelId(raw)} <noreply@anthropic.com>`;
}

/** Build Agent outputs the CLI routes on one of these exact substrings. */
export const ORCHESTRATOR_BUILD_AGENT_PROMISE_TAGS = [
  "<promise>COMPLETE</promise>",
  "<promise>success</promise>",
  "<promise>ci-pending</promise>",
  "<promise>ci-fix-attempted</promise>",
  "<promise>needs-human</promise>",
] as const;

export function hasOrchestratorCompletionTag(agentOutput: string): boolean {
  return ORCHESTRATOR_BUILD_AGENT_PROMISE_TAGS.some((tag) =>
    agentOutput.includes(tag),
  );
}

/** Stop the loop after this many consecutive no-tag replies on the same task. */
export const MISSING_PROMISE_TAG_STREAK_EXIT = 12;

export function buildMissingPromiseTagReminder(
  taskIndexOneBased: number,
  streakCount: number,
  options?: { afk?: boolean },
): string {
  const humanLine =
    options?.afk === true
      ? "- `<promise>needs-human</promise>` — **disabled** (AFK / unattended). Do not use; keep working and use success / ci-fix-attempted / COMPLETE."
      : "- `<promise>needs-human</promise>` — blocked; needs a person";
  return `## Orchestrator: missing \`<promise>\` completion tag

This is attempt **${streakCount}** on **task ${taskIndexOneBased}** with no recognized completion tag in your last message. The CLI cannot advance tasks or run the Review Gate until you end your reply with **exactly one** of these (verbatim):

- \`<promise>success</promise>\` — task done and \`pnpm test:run\` passes locally
- \`<promise>ci-fix-attempted</promise>\` — CI fix applied, ready for verification
- \`<promise>ci-pending</promise>\` — waiting on CI results
${humanLine}
- \`<promise>COMPLETE</promise>\` — only when **all** tasks are finished **and** CI is green

If you are still coding, continue working and end with the tag that matches your state (usually \`<promise>success</promise>\` once tests pass).`;
}

/**
 * Extract a commit summary from agent output via <commit-summary> tag.
 * Returns null if the tag is not present.
 */
export function extractCommitSummary(agentOutput: string): string | null {
  const match = agentOutput.match(
    /<commit-summary>([\s\S]*?)<\/commit-summary>/,
  );
  if (!match) return null;
  const summary = match[1].trim();
  return summary.length > 0 ? summary : null;
}

/**
 * Extract a commit description (body) from agent output via <commit-description> tag.
 * Returns null if the tag is not present.
 */
export function extractCommitDescription(agentOutput: string): string | null {
  const match = agentOutput.match(
    /<commit-description>([\s\S]*?)<\/commit-description>/,
  );
  if (!match) return null;
  const desc = match[1].trim();
  return desc.length > 0 ? desc : null;
}

/**
 * Record current HEAD SHA (for absorbing rogue agent commits later).
 */
export function getHeadSha(workingDirectory: string): string {
  return execSync("git rev-parse HEAD", {
    cwd: workingDirectory,
    encoding: "utf-8",
  }).trim();
}

/**
 * If the agent created commits despite being told not to, soft-reset them
 * back into staged changes so the CLI can create one clean commit.
 */
export function absorbAgentCommits(
  workingDirectory: string,
  startSha: string,
): boolean {
  try {
    const currentHead = getHeadSha(workingDirectory);
    if (currentHead !== startSha) {
      execSync(`git reset --soft ${startSha}`, {
        cwd: workingDirectory,
        encoding: "utf-8",
      });
      console.log(
        c.dim(
          "  Absorbed agent commit(s) — orchestrator will create a clean commit",
        ),
      );
      return true;
    }
  } catch {
    // If git operations fail (e.g. no commits yet), silently continue
  }
  return false;
}

/**
 * Load uniqueId from ralphci.json.
 * Returns undefined if not present.
 */
export async function loadUniqueId(
  workingDirectory: string,
  fs: FileSystem = new DefaultFileSystem(),
): Promise<string | undefined> {
  try {
    const configPath = path.join(workingDirectory, "ralphci.json");
    const content = await fs.readFile(configPath);
    const config = JSON.parse(content);
    return typeof config.uniqueId === "string" ? config.uniqueId : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Load AFK mode from ralphci.json (`"afk": true`).
 * When enabled, `<promise>needs-human</promise>` does not pause/exit the loop.
 */
export async function loadAfkMode(
  workingDirectory: string,
  fs: FileSystem = new DefaultFileSystem(),
): Promise<boolean> {
  try {
    const configPath = path.join(workingDirectory, "ralphci.json");
    const content = await fs.readFile(configPath);
    const config = JSON.parse(content);
    return config.afk === true;
  } catch {
    return false;
  }
}

/**
 * Load sleep prevention from ralphci.json (`"preventSleep": false` to disable).
 * Defaults to true — long agent runs should not lose wall-clock time to idle sleep.
 */
export async function loadPreventSleepEnabled(
  workingDirectory: string,
  fs: FileSystem = new DefaultFileSystem(),
): Promise<boolean> {
  try {
    const configPath = path.join(workingDirectory, "ralphci.json");
    const content = await fs.readFile(configPath);
    const config = JSON.parse(content);
    return config.preventSleep !== false;
  } catch {
    return true;
  }
}

/**
 * Get the default branch name (main or master).
 */
function getDefaultBranch(workingDirectory: string): string {
  try {
    const ref = execSync("git symbolic-ref refs/remotes/origin/HEAD", {
      cwd: workingDirectory,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
    return ref.replace("refs/remotes/origin/", "");
  } catch {
    // Fallback: try main, then master
    try {
      execSync("git rev-parse --verify main", {
        cwd: workingDirectory,
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      });
      return "main";
    } catch {
      try {
        execSync("git rev-parse --verify master", {
          cwd: workingDirectory,
          encoding: "utf-8",
          stdio: ["pipe", "pipe", "pipe"],
        });
        return "master";
      } catch {
        return "main";
      }
    }
  }
}

/**
 * Short per-invocation id so re-runs never reuse a failed attempt's branch.
 * 4 bytes → 8 hex chars (collision-resistant enough for lab runs).
 */
export function generateRunAttemptSuffix(byteLength = 4): string {
  return randomBytes(byteLength).toString("hex");
}

/**
 * Flatten path separators (`/` → `__`) for callers that still need a flat
 * relative-path segment. Prefer {@link computeBranchName} for run branches.
 */
export function flattenPathForGitBranch(relativePath: string): string {
  return relativePath
    .replace(/\\/g, "/")
    .replace(/^\/+|\/+$/g, "")
    .replace(/\//g, "__");
}

/**
 * Branch name for a RalphCI run: `experiment__{uniqueId}__{attempt}`.
 *
 * Uses a singular `experiment` prefix (not the working-dir path) so refs stay
 * short and never nest under `git.baseBranch`. `uniqueId` already encodes
 * study/arm/replicate; the attempt hash keeps re-runs unique.
 */
export function computeBranchName(
  _workingDirectory: string,
  uniqueId: string,
  runAttemptSuffix: string = generateRunAttemptSuffix(),
): string {
  const id = uniqueId
    .trim()
    .replace(/^\/+|\/+$/g, "")
    .replace(/\//g, "__");
  return `experiment__${id}__${runAttemptSuffix}`;
}

/**
 * Extract a short project title from plan.md for the PR title.
 * Falls back to the directory basename.
 */
export async function extractPlanTitle(
  workingDirectory: string,
  fileSystem: FileSystem = new DefaultFileSystem(),
): Promise<string> {
  try {
    const planPath = path.join(workingDirectory, "plan.md");
    const content = await fileSystem.readFile(planPath);
    const lines = content.split("\n");

    for (const line of lines) {
      const match = line.match(/^#\s+(.+)/);
      if (match) {
        let title = match[1].trim();
        title = title.replace(/^Project Plan:\s*/i, "");
        title = title.replace(/^Plan:\s*/i, "");
        if (title.length > 80) {
          title = title.substring(0, 77) + "...";
        }
        return title;
      }
    }

    return path.basename(workingDirectory);
  } catch {
    return path.basename(workingDirectory);
  }
}

/**
 * Check if the GitHub CLI (gh) is available.
 */
function isGHAvailable(): boolean {
  try {
    execSync("which gh", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Ensure a GitHub PR exists for the given branch. Creates one if missing.
 * Returns true if a new PR was created.
 */
async function ensurePRExists(
  workingDirectory: string,
  branchName: string,
  uniqueId: string,
  draftPR: boolean,
  fileSystem: FileSystem,
): Promise<boolean> {
  if (!isGHAvailable()) {
    console.log(
      c.yellow("  ⚠️  GitHub CLI (gh) not found — skipping PR creation"),
    );
    return false;
  }

  // Check if a PR already exists for this branch
  const viewResult = spawnSync(
    "gh",
    ["pr", "view", branchName, "--json", "url"],
    {
      cwd: workingDirectory,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    },
  );

  if (viewResult.status === 0) {
    console.log(c.dim(`  PR already exists for branch: ${branchName}`));
    return false;
  }

  // Build title from plan.md
  const planTitle = await extractPlanTitle(workingDirectory, fileSystem);
  const prTitle = `${planTitle} [#${uniqueId}]`;

  // Build body
  let planSummary = "";
  try {
    const planPath = path.join(workingDirectory, "plan.md");
    const content = await fileSystem.readFile(planPath);
    planSummary = content.split("\n").slice(0, 25).join("\n");
  } catch {
    planSummary = "(No plan.md found)";
  }

  const prBody = [
    "## Auto-generated by RalphCI",
    "",
    `**Branch:** \`${branchName}\``,
    `**Working Directory:** \`${path.basename(workingDirectory)}\``,
    `**Unique ID:** ${uniqueId}`,
    "",
    "### Plan Summary",
    "",
    planSummary,
    "",
    "---",
    "*This PR was automatically created by `ralphci run`.*",
  ].join("\n");

  // Create PR using spawnSync to avoid shell-escaping issues
  const args = ["pr", "create", "--title", prTitle, "--body", prBody];
  if (draftPR) args.push("--draft");

  const createResult = spawnSync("gh", args, {
    cwd: workingDirectory,
    encoding: "utf-8",
    stdio: ["pipe", "pipe", "pipe"],
  });

  if (createResult.status === 0) {
    const prUrl = (createResult.stdout || "").trim();
    if (draftPR) {
      console.log(c.green(`  ✓ Draft PR created: ${prTitle}`));
    } else {
      console.log(c.green(`  ✓ PR created: ${prTitle}`));
    }
    if (prUrl) {
      console.log(c.dim(`    ${prUrl}`));
    }
    return true;
  } else {
    const errMsg = (createResult.stderr || "").trim();
    console.log(c.yellow(`  ⚠️  Failed to create PR: ${errMsg}`));
    return false;
  }
}

/**
 * Set up a feature branch and create a GitHub PR.
 * Returns the branch name, or null if setup was skipped or failed.
 */
export async function setupBranchAndPR(
  workingDirectory: string,
  uniqueId: string,
  _draftPR: boolean = true,
  _fileSystem: FileSystem = new DefaultFileSystem(),
  baseBranchOverride?: string,
): Promise<{ branchName: string; prCreated: boolean } | null> {
  // Determine current branch
  let currentBranch = "";
  try {
    currentBranch = execSync("git branch --show-current", {
      cwd: workingDirectory,
      encoding: "utf-8",
    }).trim();
  } catch {
    console.log(c.yellow("  ⚠️  Could not determine current git branch"));
    return null;
  }

  const branchExistsLocal = (name: string): boolean => {
    try {
      execSync(`git rev-parse --verify "${name}"`, {
        cwd: workingDirectory,
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      });
      return true;
    } catch {
      return false;
    }
  };

  const branchExistsRemote = (name: string): boolean => {
    try {
      const lsOutput = execSync(`git ls-remote --heads origin "${name}"`, {
        cwd: workingDirectory,
        encoding: "utf-8",
      }).trim();
      return lsOutput.length > 0;
    } catch {
      return false;
    }
  };

  // Fresh attempt id every setup — never resume a prior failed run's branch.
  let runAttemptSuffix = "";
  let branchName = "";
  for (let attempt = 0; attempt < 8; attempt++) {
    runAttemptSuffix = generateRunAttemptSuffix();
    branchName = computeBranchName(
      workingDirectory,
      uniqueId,
      runAttemptSuffix,
    );
    if (currentBranch === branchName) {
      console.log(c.dim(`  Already on branch: ${branchName}`));
      return { branchName, prCreated: false };
    }
    if (!branchExistsLocal(branchName) && !branchExistsRemote(branchName)) {
      break;
    }
    branchName = "";
  }
  if (!branchName || !runAttemptSuffix) {
    console.log(
      c.red(
        "  ✗ Could not allocate a unique run-attempt branch name after several tries.",
      ),
    );
    return null;
  }
  console.log(c.dim(`  Run attempt: ${runAttemptSuffix}`));

  // Auto-stash dirty working tree
  let stashed = false;
  try {
    const status = execSync("git status --porcelain", {
      cwd: workingDirectory,
      encoding: "utf-8",
    }).trim();
    if (status.length > 0) {
      console.log(c.dim("  Stashing uncommitted changes..."));
      execSync("git stash --include-untracked", {
        cwd: workingDirectory,
        encoding: "utf-8",
      });
      stashed = true;
    }
  } catch {
    // Ignore stash errors
  }

  try {
    const baseBranch = baseBranchOverride || getDefaultBranch(workingDirectory);
    console.log(c.dim(`  Creating branch: ${branchName} (from ${baseBranch})`));
    execSync(`git checkout -b "${branchName}" "${baseBranch}"`, {
      cwd: workingDirectory,
      encoding: "utf-8",
    });
    console.log(c.dim("  Pushing branch to remote..."));
    execSync(`git push -u origin "${branchName}"`, {
      cwd: workingDirectory,
      encoding: "utf-8",
    });
  } catch (error) {
    console.log(
      c.red(
        `  Branch setup failed: ${error instanceof Error ? error.message : String(error)}`,
      ),
    );
    // Try to get back to the original branch
    try {
      execSync(`git checkout "${currentBranch}"`, {
        cwd: workingDirectory,
        encoding: "utf-8",
      });
    } catch {
      /* best-effort */
    }
    return null;
  } finally {
    if (stashed) {
      try {
        console.log(c.dim("  Restoring stashed changes..."));
        execSync("git stash pop", { cwd: workingDirectory, encoding: "utf-8" });
      } catch {
        console.log(
          c.yellow(
            "  ⚠️  Could not restore stash. Run 'git stash pop' manually.",
          ),
        );
      }
    }
  }

  // NOTE: PR creation is deferred until after the first push (GitHub rejects
  // PRs with zero commits ahead of base). The runCI loop calls tryCreatePR()
  // after each push and in exitSuccess().
  return { branchName, prCreated: false };
}

/**
 * Mark a draft PR as ready for review on the current branch.
 */
export function markPRReady(workingDirectory: string): void {
  if (!isGHAvailable()) return;

  try {
    const branch = execSync("git branch --show-current", {
      cwd: workingDirectory,
      encoding: "utf-8",
    }).trim();

    const viewResult = spawnSync(
      "gh",
      ["pr", "view", branch, "--json", "isDraft", "--jq", ".isDraft"],
      {
        cwd: workingDirectory,
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      },
    );

    if (viewResult.status === 0 && viewResult.stdout.trim() === "true") {
      const readyResult = spawnSync("gh", ["pr", "ready", branch], {
        cwd: workingDirectory,
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      });
      if (readyResult.status === 0) {
        console.log(c.green("  ✓ PR marked as ready for review"));
      }
    }
  } catch {
    // Silently skip — PR readiness is best-effort
  }
}

/**
 * Commit and push metrics.json (and any other uncommitted changes).
 * Called at the very end of a successful run to ensure nothing is left behind.
 *
 * When a ReviewGateConfig is provided, runs lint:fix + tests before pushing
 * to ensure metrics.json (and any other final changes) don't break the build.
 */
export async function commitAndPushFinalMetrics(
  workingDirectory: string,
  reviewGateConfig?: import("../utils/config.js").ReviewGateConfig,
  coAuthor?: string,
): Promise<void> {
  try {
    // Check if there are uncommitted changes
    const status = execSync("git status --porcelain", {
      cwd: workingDirectory,
      encoding: "utf-8",
    }).trim();

    if (status.length === 0) {
      console.log(c.dim("  No uncommitted changes to push"));
      return;
    }

    // Run Review Gate on final changes (catches poorly formatted metrics.json, etc.)
    if (reviewGateConfig?.enabled) {
      console.log(
        c.dim("  Running Review Gate on final changes before push..."),
      );
      const gateResult = await runReviewGate(
        workingDirectory,
        reviewGateConfig,
      );
      if (!gateResult.passed) {
        console.log(
          c.yellow(
            "  ⚠️  Review Gate failed on final metrics push — pushing anyway (metrics are best-effort)",
          ),
        );
        // Still push — metrics are informational and shouldn't block completion.
        // But lint:fix may have auto-corrected issues, so we benefit either way.
      } else {
        console.log(c.green("  ✓ Review Gate passed on final changes"));
      }
    }

    console.log(c.dim("  Committing final metrics and remaining changes..."));
    const parts = ["chore(metrics): save run metrics"];
    if (coAuthor) parts.push(`Co-authored-by: ${coAuthor}`);
    const metricsMsg = parts.join("\n\n");
    execSync("git add -A", { cwd: workingDirectory, encoding: "utf-8" });
    execSync(`git commit -m "${metricsMsg.replace(/"/g, '\\"')}"`, {
      cwd: workingDirectory,
      encoding: "utf-8",
    });
    execSync("git push", { cwd: workingDirectory, encoding: "utf-8" });
    console.log(c.green("  ✓ Final metrics committed and pushed"));
  } catch (error) {
    console.log(
      c.yellow(
        `  ⚠️  Could not commit/push final metrics: ${error instanceof Error ? error.message : String(error)}`,
      ),
    );
  }
}

/**
 * Format a Metrics summary as a clean markdown section.
 */
export function formatMetricsMarkdown(metrics: Metrics): string {
  const s = metrics.summary;
  const durationMin = s.totalDurationMs
    ? (s.totalDurationMs / 60_000).toFixed(1)
    : "N/A";
  const costStr = s.totalCost ? `$${s.totalCost.toFixed(4)}` : "$0.00";

  const lines = [
    "## Metrics Summary",
    "",
    "| Metric | Value |",
    "|--------|-------|",
    `| Iterations | ${s.totalIterations} |`,
    `| Tasks Completed | ${s.tasksCompleted} |`,
    `| Tokens In | ${(s.totalTokensIn ?? 0).toLocaleString()} |`,
    `| Tokens Out | ${(s.totalTokensOut ?? 0).toLocaleString()} |`,
    `| Diagnosis Tokens | ${(s.diagnosisTokens ?? 0).toLocaleString()} |`,
    `| Codegen Tokens | ${(s.codegenTokens ?? 0).toLocaleString()} |`,
    `| Total Tokens | ${s.totalTokens.toLocaleString()} |`,
    `| Total Cost | ${costStr} |`,
    `| Duration | ${durationMin} min |`,
  ];

  if (s.ciQueriesTotal > 0) {
    lines.push(`| CI Queries | ${s.ciQueriesTotal} |`);
  }
  if (s.pipelineRuns > 0) {
    lines.push(`| Pipeline Runs | ${s.pipelineRuns} |`);
  }
  if (s.totalPipelineDurationMs > 0) {
    lines.push(
      `| Pipeline Minutes | ${(s.totalPipelineDurationMs / 60_000).toFixed(2)} |`,
    );
  }
  if (s.totalEstimatedCredits !== null && s.totalEstimatedCredits > 0) {
    lines.push(
      `| Estimated CI Credits | ${s.totalEstimatedCredits.toFixed(1)} |`,
    );
  }
  if (s.ciFailuresEncountered > 0) {
    lines.push(`| CI Failures Encountered | ${s.ciFailuresEncountered} |`);
    lines.push(`| CI Failures Fixed | ${s.ciFailuresFixed} |`);
  }
  if (s.timeToFirstCIGreen !== null) {
    const ciGreenMin = (s.timeToFirstCIGreen / 60_000).toFixed(1);
    lines.push(`| Time to First CI Green | ${ciGreenMin} min |`);
  }
  if (s.innerLoopMode) {
    lines.push(`| Inner Loop Mode | ${s.innerLoopMode} |`);
  }
  if (s.ciPushesTotal > 0) {
    lines.push(
      `| CI Pushes (green/total) | ${s.ciPushesGreen}/${s.ciPushesTotal} |`,
    );
  }
  if (s.everyCommitGreenRate !== null) {
    lines.push(
      `| Every-Commit Green Rate | ${(s.everyCommitGreenRate * 100).toFixed(1)}% |`,
    );
  }
  if (s.firstPushGreen !== null) {
    lines.push(
      `| First Push Green (single-push) | ${s.firstPushGreen ? "yes" : "no"} |`,
    );
  }

  lines.push("");
  lines.push(
    `*Run completed at ${metrics.endTime ?? new Date().toISOString()}*`,
  );

  return lines.join("\n");
}

/**
 * Append the metrics summary to the current branch's PR description.
 */
export function appendMetricsToPR(
  workingDirectory: string,
  metrics: Metrics,
): void {
  if (!isGHAvailable()) return;

  try {
    const branch = execSync("git branch --show-current", {
      cwd: workingDirectory,
      encoding: "utf-8",
    }).trim();

    // Fetch current PR body
    const viewResult = spawnSync(
      "gh",
      ["pr", "view", branch, "--json", "body", "--jq", ".body"],
      {
        cwd: workingDirectory,
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      },
    );

    if (viewResult.status !== 0) {
      // No PR found — skip silently
      return;
    }

    let currentBody = (viewResult.stdout || "").trim();

    // Strip any previous metrics section to avoid duplication on re-runs
    const metricsHeading = "## Metrics Summary";
    const metricsIdx = currentBody.indexOf(metricsHeading);
    if (metricsIdx !== -1) {
      currentBody = currentBody.substring(0, metricsIdx).trimEnd();
    }

    const metricsSection = formatMetricsMarkdown(metrics);
    const newBody = currentBody + "\n\n" + metricsSection;

    // Update PR body
    const editResult = spawnSync(
      "gh",
      ["pr", "edit", branch, "--body", newBody],
      {
        cwd: workingDirectory,
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      },
    );

    if (editResult.status === 0) {
      console.log(c.green("  ✓ Metrics summary appended to PR description"));
    } else {
      const errMsg = (editResult.stderr || "").trim();
      console.log(c.yellow(`  ⚠️  Could not update PR description: ${errMsg}`));
    }
  } catch {
    // Best-effort — skip silently
  }
}

/**
 * Load CI config from ralphci.json.
 */
export async function loadCIConfig(
  workingDirectory: string,
  fs: FileSystem = new DefaultFileSystem(),
): Promise<CIConfig> {
  const defaultConfig: CIConfig = {
    enabled: true,
    provider: "circleci",
    waitForCI: true,
    maxCIWaitSeconds: 300,
    requireGreenBeforeComplete: true,
    approvalGateEnabled: true,
    branchStrategy: "feature-branch",
  };

  try {
    const configPath = path.join(workingDirectory, "ralphci.json");
    const content = await fs.readFile(configPath);
    const config = JSON.parse(content);

    if (config.ci && typeof config.ci === "object") {
      return {
        enabled: config.ci.enabled ?? defaultConfig.enabled,
        provider: config.ci.provider ?? defaultConfig.provider,
        waitForCI: config.ci.waitForCI ?? defaultConfig.waitForCI,
        maxCIWaitSeconds:
          config.ci.maxCIWaitSeconds ?? defaultConfig.maxCIWaitSeconds,
        requireGreenBeforeComplete:
          config.ci.requireGreenBeforeComplete ??
          defaultConfig.requireGreenBeforeComplete,
        approvalGateEnabled:
          config.ci.approvalGateEnabled ?? defaultConfig.approvalGateEnabled,
        branchStrategy:
          config.ci.branchStrategy ?? defaultConfig.branchStrategy,
      };
    }

    return defaultConfig;
  } catch {
    return defaultConfig;
  }
}

/**
 * Load git config from ralphci.json.
 * Reads from "git" section; falls back to "ci" section for backward compatibility.
 */
export async function loadGitConfig(
  workingDirectory: string,
  fs: FileSystem = new DefaultFileSystem(),
): Promise<GitConfig> {
  const defaultConfig: GitConfig = {
    autoPush: true,
    pushOnLocalSuccess: true,
    pushMode: "per-task",
  };

  const normalizePushMode = (raw: unknown): GitPushMode =>
    raw === "epilogue" ? "epilogue" : "per-task";

  try {
    const configPath = path.join(workingDirectory, "ralphci.json");
    const content = await fs.readFile(configPath);
    const config = JSON.parse(content);

    // Prefer "git" section
    if (config.git && typeof config.git === "object") {
      return {
        autoPush: config.git.autoPush ?? defaultConfig.autoPush,
        pushOnLocalSuccess:
          config.git.pushOnLocalSuccess ?? defaultConfig.pushOnLocalSuccess,
        pushMode: normalizePushMode(
          config.git.pushMode ?? defaultConfig.pushMode,
        ),
        baseBranch: config.git.baseBranch,
      };
    }

    // Backward compat: fall back to "ci" section
    if (config.ci && typeof config.ci === "object") {
      return {
        autoPush: config.ci.autoPush ?? defaultConfig.autoPush,
        pushOnLocalSuccess:
          config.ci.pushOnLocalSuccess ?? defaultConfig.pushOnLocalSuccess,
        pushMode: normalizePushMode(
          config.ci.pushMode ?? defaultConfig.pushMode,
        ),
      };
    }

    return defaultConfig;
  } catch {
    return defaultConfig;
  }
}

/**
 * Load serve config from ralphci.json.
 * Returns config with enabled=true if src/ directory exists by default.
 */
export async function loadServeConfig(
  workingDirectory: string,
  fs: FileSystem = new DefaultFileSystem(),
): Promise<ServeConfig> {
  const defaultConfig: ServeConfig = {
    enabled: true, // Will be overridden based on src/ existence
    port: 3000,
    directory: "src",
  };

  // Check if src/ directory exists
  const srcPath = path.join(workingDirectory, "src");
  let srcExists = false;
  try {
    srcExists = await fs.exists(srcPath);
  } catch {
    srcExists = false;
  }

  // Default to enabled only if src/ exists
  defaultConfig.enabled = srcExists;

  try {
    const configPath = path.join(workingDirectory, "ralphci.json");
    const content = await fs.readFile(configPath);
    const config = JSON.parse(content);

    if (config.serve && typeof config.serve === "object") {
      return {
        enabled: config.serve.enabled ?? defaultConfig.enabled,
        port: config.serve.port ?? defaultConfig.port,
        directory: config.serve.directory ?? defaultConfig.directory,
      };
    }

    return defaultConfig;
  } catch {
    return defaultConfig;
  }
}

/**
 * Kill any process currently listening on the specified port.
 */
export function killProcessOnPort(port: number): void {
  try {
    // Use lsof to find the PID of the process listening on the port
    const result = execSync(`lsof -ti :${port}`, { encoding: "utf-8" }).trim();
    if (result) {
      const pids = result.split("\n").filter(Boolean);
      for (const pid of pids) {
        try {
          execSync(`kill -9 ${pid}`, { encoding: "utf-8" });
          console.log(
            c.dim(`  Killed existing process (PID ${pid}) on port ${port}`),
          );
        } catch {
          // Process may have already exited
        }
      }
      // Give the OS a moment to release the port
      execSync("sleep 0.5");
    }
  } catch {
    // No process found on port, which is fine
  }
}

/**
 * Start a local dev server serving the specified directory.
 * Returns the child process or null if failed to start.
 */
export function startLocalServer(
  workingDirectory: string,
  config: ServeConfig,
): ChildProcess | null {
  const serveDir = path.join(workingDirectory, config.directory);

  try {
    // Check if directory exists synchronously
    if (!fs.existsSync(serveDir)) {
      console.log(
        c.yellow(
          `  ⚠️  Cannot start server: ${config.directory}/ directory not found`,
        ),
      );
      return null;
    }

    // Kill any existing process on the port
    killProcessOnPort(config.port);

    // Start npx serve in the background
    const serverProcess = spawn(
      "npx",
      ["serve", "-l", String(config.port), "."],
      {
        cwd: serveDir,
        stdio: "ignore", // Don't capture output to avoid cluttering the terminal
        detached: false, // Keep attached so it dies with parent
      },
    );

    serverProcess.on("error", (err) => {
      console.log(c.yellow(`  ⚠️  Server error: ${err.message}`));
    });

    return serverProcess;
  } catch (error) {
    console.log(
      c.yellow(
        `  ⚠️  Failed to start server: ${error instanceof Error ? error.message : String(error)}`,
      ),
    );
    return null;
  }
}

/**
 * Stop the local dev server.
 */
export function stopLocalServer(serverProcess: ChildProcess | null): void {
  if (serverProcess && !serverProcess.killed) {
    try {
      serverProcess.kill("SIGTERM");
    } catch {
      // Process may already be dead
    }
  }
}

/**
 * Watch the working directory for the src/ directory to appear.
 * When detected, immediately starts the local dev server (zero delay).
 * Returns a cleanup function to stop watching, or null if src/ already exists.
 *
 * NOTE: This is a module-level function so `fs` refers to the native Node.js
 * fs module (inside runCI, `fs` is shadowed by the FileSystem parameter).
 */
function watchForSrcDir(
  workingDirectory: string,
  serveConfig: ServeConfig,
  onServerStarted: (proc: ChildProcess) => void,
): (() => void) | null {
  const srcPath = path.join(workingDirectory, serveConfig.directory);

  // If src/ already exists, no need to watch
  if (fs.existsSync(srcPath)) return null;

  let closed = false;
  const watcher = fs.watch(workingDirectory, (_eventType, filename) => {
    if (closed) return;
    if (filename === serveConfig.directory && fs.existsSync(srcPath)) {
      closed = true;
      watcher.close();
      serveConfig.enabled = true;
      console.log(
        c.cyan(
          `\n  🌐 ${serveConfig.directory}/ created — starting local server on http://localhost:${serveConfig.port}...`,
        ),
      );
      const proc = startLocalServer(workingDirectory, serveConfig);
      if (proc) {
        console.log(
          c.green(
            `  ✓ Server running: http://localhost:${serveConfig.port} → ${serveConfig.directory}/`,
          ),
        );
        onServerStarted(proc);
      }
    }
  });

  return () => {
    if (!closed) {
      closed = true;
      watcher.close();
    }
  };
}

/**
 * Fetch CI status and failure logs for the current branch.
 * Returns null if CI is disabled or fetching fails.
 */
export async function prefetchCIStatus(
  workingDirectory: string,
  verbose: boolean = false,
  doctorConfig?: Pick<CIDoctorConfig, "logMode" | "maxLogLength">,
): Promise<InjectedCIStatus | null> {
  try {
    // Get git info
    let gitRemoteURL = "";
    let branch = "";
    try {
      gitRemoteURL = execSync("git remote get-url origin", {
        cwd: workingDirectory,
        encoding: "utf-8",
      }).trim();
      branch = execSync("git branch --show-current", {
        cwd: workingDirectory,
        encoding: "utf-8",
      }).trim();
    } catch {
      if (verbose) {
        console.log(c.dim("  Could not get git info for CI status fetch"));
      }
      return null;
    }

    const projectSlug = parseProjectSlug(gitRemoteURL);
    if (!projectSlug) {
      if (verbose) {
        console.log(c.dim("  Could not parse project slug from git remote"));
      }
      return null;
    }

    if (!branch) {
      if (verbose) {
        console.log(
          c.dim(
            "  Cannot fetch CI status: no branch (detached HEAD or empty branch name)",
          ),
        );
      }
      return null;
    }

    if (verbose) {
      console.log(c.dim(`  Querying CI for branch: ${branch}`));
    }

    // Fetch CI status (scoped to this branch only)
    const status = await fetchCIStatus(projectSlug, branch);

    const logMode = doctorConfig?.logMode ?? "full";
    let failureLogs: string | null = null;
    let failureContextChars = 0;
    let failureContextSource: FailureContextSource = "none";
    if (status.status === "failed") {
      const ctx = await fetchFailureContext(projectSlug, status, {
        logMode,
        maxLogLength: doctorConfig?.maxLogLength,
      });
      failureLogs = ctx.logs;
      failureContextChars = ctx.failureContextChars;
      failureContextSource = ctx.source;
      if (verbose) {
        console.log(
          c.dim(
            `  Failure context: ${failureContextChars} chars (${ctx.source})`,
          ),
        );
      }
    }

    let pipelineUsage: PipelineUsage | null = null;
    if (status.status === "failed" || status.status === "success") {
      pipelineUsage = await fetchPipelineUsage(projectSlug, status);
    }

    return {
      status,
      failureLogs,
      logMode,
      failureContextChars,
      failureContextSource,
      pipelineUsage,
    };
  } catch (error) {
    if (verbose) {
      console.log(
        c.dim(
          `  Error prefetching CI status: ${error instanceof Error ? error.message : String(error)}`,
        ),
      );
    }
    return null;
  }
}

/**
 * Poll CI status until the pipeline settles (not "running").
 * Mirrors prefetchCIStatus but uses pollUntilSettled under the hood.
 * Returns null if git info is unavailable or polling fails.
 */
export async function pollPrefetchCIStatus(
  workingDirectory: string,
  maxWaitMs: number,
  verbose: boolean = false,
  doctorConfig?: Pick<CIDoctorConfig, "logMode" | "maxLogLength">,
): Promise<InjectedCIStatus | null> {
  try {
    let gitRemoteURL = "";
    let branch = "";
    try {
      gitRemoteURL = execSync("git remote get-url origin", {
        cwd: workingDirectory,
        encoding: "utf-8",
      }).trim();
      branch = execSync("git branch --show-current", {
        cwd: workingDirectory,
        encoding: "utf-8",
      }).trim();
    } catch {
      return null;
    }

    const projectSlug = parseProjectSlug(gitRemoteURL);
    if (!projectSlug || !branch) return null;

    const status = await pollUntilSettled(
      projectSlug,
      branch,
      maxWaitMs,
      undefined,
      (elapsedMs) => {
        if (verbose) {
          console.log(
            c.dim(
              `  ⏳ CI still running... (${Math.round(elapsedMs / 1000)}s elapsed)`,
            ),
          );
        }
      },
    );

    let failureLogs: string | null = null;
    let failureContextChars = 0;
    let failureContextSource: FailureContextSource = "none";
    const logMode = doctorConfig?.logMode ?? "full";
    if (status.status === "failed") {
      const ctx = await fetchFailureContext(projectSlug, status, {
        logMode,
        maxLogLength: doctorConfig?.maxLogLength,
      });
      failureLogs = ctx.logs;
      failureContextChars = ctx.failureContextChars;
      failureContextSource = ctx.source;
      if (verbose) {
        console.log(
          c.dim(
            `  Failure context: ${failureContextChars} chars (${ctx.source})`,
          ),
        );
      }
    }

    let pipelineUsage: PipelineUsage | null = null;
    if (status.status === "failed" || status.status === "success") {
      pipelineUsage = await fetchPipelineUsage(projectSlug, status);
    }

    return {
      status,
      failureLogs,
      logMode,
      failureContextChars,
      failureContextSource,
      pipelineUsage,
    };
  } catch {
    return null;
  }
}

/**
 * Main CI-aware run loop.
 */
export async function runCI(
  options: RunCIOptions,
  runner?: import("../utils/claude-runner.js").AgentRunner,
  fs: FileSystem = new DefaultFileSystem(),
): Promise<void> {
  const { workingDirectory, maxIterations, unlimitedIterations } = options;

  // Import validation utilities and config
  const { validateWorkingDirectory, validateRequiredFiles } =
    await import("../utils/validation.js");
  const { loadConfig } = await import("../utils/config.js");
  const { DefaultClaudeRunner } = await import("../utils/claude-runner.js");
  const { CursorRunner } = await import("../utils/cursor-runner.js");
  const { CommandError } = await import("../utils/errors.js");

  // Validate working directory exists
  await validateWorkingDirectory(workingDirectory, fs);

  // Load configs
  const ciConfig = await loadCIConfig(workingDirectory, fs);
  const gitConfig = await loadGitConfig(workingDirectory, fs);

  // Override gitConfig with CLI options
  if (options.autoPush !== undefined) gitConfig.autoPush = options.autoPush;
  if (options.pushOnLocalSuccess !== undefined)
    gitConfig.pushOnLocalSuccess = options.pushOnLocalSuccess;

  // Override ciConfig with CLI options
  if (options.requireGreenBeforeComplete !== undefined)
    ciConfig.requireGreenBeforeComplete = options.requireGreenBeforeComplete;
  if (options.approvalGateEnabled !== undefined)
    ciConfig.approvalGateEnabled = options.approvalGateEnabled;
  if (options.branchStrategy !== undefined)
    ciConfig.branchStrategy = options.branchStrategy;
  if (options.ciWaitSeconds !== undefined)
    ciConfig.maxCIWaitSeconds = options.ciWaitSeconds;

  // CI can be disabled via CLI (--no-ci), but config "enabled: false" always takes precedence
  // Config false → always false (can't be overridden by CLI)
  // Config true + --no-ci → false
  // Config true + no flag → true
  if (options.ciEnabled === false) {
    ciConfig.enabled = false;
  }
  // Note: we intentionally don't set ciConfig.enabled = true from CLI
  // so that config "enabled: false" is always respected

  // When CI is disabled, turn off only CI-dependent behavior (query/wait/approval).
  // autoPush and pushOnLocalSuccess are left from config so experiments can still push to GitHub.
  if (!ciConfig.enabled) {
    ciConfig.waitForCI = false;
    ciConfig.requireGreenBeforeComplete = false;
    ciConfig.approvalGateEnabled = false;
  }

  // Declare serverProcess and srcWatcher early so cleanup handlers can reference them
  let serverProcess: ChildProcess | null = null;
  let stopSrcWatcher: (() => void) | null = null;
  let preventSleepHandle: PreventSleepHandle | null = null;

  // Setup cleanup handler for server and watcher
  const cleanupServer = () => {
    if (stopSrcWatcher) {
      stopSrcWatcher();
      stopSrcWatcher = null;
    }
    if (serverProcess) {
      stopLocalServer(serverProcess);
      serverProcess = null;
    }
  };

  const cleanupPreventSleep = () => {
    if (preventSleepHandle) {
      preventSleepHandle.stop();
      preventSleepHandle = null;
    }
  };

  const preventSleepFromConfig = await loadPreventSleepEnabled(
    workingDirectory,
    fs,
  );
  const preventSleepEnabled =
    options.preventSleep !== undefined
      ? options.preventSleep
      : preventSleepFromConfig;

  if (preventSleepEnabled) {
    preventSleepHandle = startPreventSleep();
    if (preventSleepHandle) {
      console.log(
        c.dim(
          "  ☕ Preventing system sleep for this run (caffeinate -dims -w ralphci)",
        ),
      );
    }
  }

  // Register cleanup on process exit
  process.on("exit", () => {
    cleanupPreventSleep();
    cleanupServer();
    killOrphanedTestProcesses();
  });
  process.on("SIGINT", () => {
    cleanupPreventSleep();
    cleanupServer();
    killOrphanedTestProcesses();
    process.exit(130);
  });
  process.on("SIGTERM", () => {
    cleanupPreventSleep();
    cleanupServer();
    killOrphanedTestProcesses();
    process.exit(143);
  });

  // ─── Branch & PR Setup ───
  const uniqueId = await loadUniqueId(workingDirectory, fs);
  const afkMode = await loadAfkMode(workingDirectory, fs);
  const draftPR = options.draftPR !== false; // default true

  // Capture the branch we started on so we can return to it on exit
  let startingBranch = "";
  try {
    startingBranch = execSync("git branch --show-current", {
      cwd: workingDirectory,
      encoding: "utf-8",
    }).trim();
  } catch {
    // Not a fatal error — we'll skip branch restoration on exit
  }

  // Resolve baseBranch: "current" → startingBranch, explicit string → that value, undefined → auto-detect main/master
  let resolvedBaseBranch: string | undefined;
  if (gitConfig.baseBranch === "current") {
    resolvedBaseBranch = startingBranch || undefined; // fall back to auto-detect if we couldn't capture starting branch
  } else if (gitConfig.baseBranch) {
    resolvedBaseBranch = gitConfig.baseBranch;
  }

  let branchSetupResult: { branchName: string; prCreated: boolean } | null =
    null;
  if (uniqueId !== undefined) {
    console.log(c.cyan("\n  ─── Branch Setup ───"));
    branchSetupResult = await setupBranchAndPR(
      workingDirectory,
      uniqueId,
      draftPR,
      fs,
      resolvedBaseBranch,
    );
    if (!branchSetupResult) {
      console.log(
        c.red(
          "\n  ✗ Aborting: branch setup failed. Refusing to continue on the wrong branch (e.g. main).",
        ),
      );
      console.log(
        c.dim(
          "  Tip: branches are experiment__{uniqueId}__{attemptHash} so re-runs never collide or nest under git.baseBranch.",
        ),
      );
      process.exit(1);
      return;
    }
    console.log(c.dim(`  Branch: ${branchSetupResult.branchName}`));
  }

  if (afkMode) {
    console.log(
      c.dim(
        "  AFK mode: on — needs-human will not pause the loop (unattended experiment).",
      ),
    );
  }

  // Load serve config and apply CLI overrides
  // NOTE: This must happen AFTER branch setup, because src/ may only exist
  // on the feature branch (not on main where we start).
  const serveConfig = await loadServeConfig(workingDirectory, fs);
  if (options.serveEnabled !== undefined)
    serveConfig.enabled = options.serveEnabled;
  if (options.servePort !== undefined) serveConfig.port = options.servePort;
  if (options.serveDirectory !== undefined)
    serveConfig.directory = options.serveDirectory;

  // Start local dev server if enabled
  if (serveConfig.enabled) {
    console.log(
      c.cyan(
        `  🌐 Starting local server on http://localhost:${serveConfig.port}...`,
      ),
    );
    serverProcess = startLocalServer(workingDirectory, serveConfig);
    if (serverProcess) {
      console.log(
        c.green(
          `  ✓ Server running: http://localhost:${serveConfig.port} → ${serveConfig.directory}/`,
        ),
      );
    }
  }

  // Watch for src/ directory creation to start server with zero delay.
  // If the Build Agent creates src/ mid-iteration, the watcher fires instantly
  // via FSEvents — no waiting until the iteration finishes.
  if (!serverProcess) {
    stopSrcWatcher = watchForSrcDir(workingDirectory, serveConfig, (proc) => {
      serverProcess = proc;
    });
  }

  // Deferred PR creation — called after each push so there are commits to diff.
  // Idempotent: once a PR exists, subsequent calls are no-ops.
  let prCreated = false;
  const tryCreatePR = async () => {
    if (prCreated || !branchSetupResult || uniqueId === undefined) return;
    const created = await ensurePRExists(
      workingDirectory,
      branchSetupResult.branchName,
      uniqueId,
      draftPR,
      fs,
    );
    if (created) prCreated = true;
  };

  // Helper: commit final metrics, ensure PR exists, update PR, mark ready, and exit
  const exitSuccess = async () => {
    // 1. Commit and push any uncommitted changes (especially metrics.json)
    await commitAndPushFinalMetrics(
      workingDirectory,
      reviewGateConfig,
      getCoAuthor(config, lastKnownModel),
    );

    // 2. Ensure PR exists (safety net — may be first push)
    await tryCreatePR();

    // 3. Append metrics summary to the PR description
    appendMetricsToPR(workingDirectory, metrics);

    // 4. Mark draft PR as ready for review
    if (branchSetupResult && draftPR) {
      markPRReady(workingDirectory);
    }

    // 5. Switch back to the branch we started on before exiting
    if (startingBranch && branchSetupResult) {
      try {
        execSync(`git checkout "${startingBranch}"`, {
          cwd: workingDirectory,
          encoding: "utf-8",
          stdio: ["pipe", "pipe", "pipe"],
        });
        console.log(c.green(`\n  Switched back to ${startingBranch} branch.`));
      } catch {
        // Non-fatal: don't block exit if checkout fails
      }
    }

    process.exit(0);
  };

  // Load runner config (needed for both runner selection and task selection mode)
  const configResult = await loadConfig(workingDirectory, process.cwd());
  const config = configResult.config;
  const verbose = options.verbose ?? false;

  // Resolve specialized agent configs with backward-compatible defaults
  const buildAgentConfig = resolveBuildAgentConfig(config.buildAgent);
  const preflightSurveyConfig = resolvePreflightSurveyConfig(
    config.preflightSurvey,
  );
  const reviewGateConfig = resolveReviewGateConfig(config.reviewGate);
  const ciDoctorConfig = resolveCIDoctorConfig(config.ciDoctor);
  const packageRoot = resolvePackageRoot(workingDirectory);
  const validationManifest = generateValidationManifest(packageRoot);
  // CI Doctor is only active when CI is enabled
  if (!ciConfig.enabled) {
    ciDoctorConfig.enabled = false;
  }

  // Initialize CI query cache
  const ciCache = new CIQueryCache();

  // Epilogue mode: defer remote push until all tasks pass Review Gate locally.
  // Per-task mode starts unlocked so existing push-per-gate behavior is unchanged.
  let epilogueUnlocked = resolveGitPushMode(gitConfig) !== "epilogue";
  let epilogueRemotePushCount = 0;

  console.log(c.cyan("\n  ─── Validation Manifest ───"));
  console.log(
    c.dim(
      `  Inner: ${validationManifest.innerGates.join(", ")} · Outer: ${validationManifest.outerCiJobs.join(", ")}`,
    ),
  );
  console.log(
    c.dim(
      `  Gate pointers: ${validationManifest.gatePointers.length} (read scripts on demand — see prompt)`,
    ),
  );

  // Fail fast on a stale / dead Chunk sidecar before burning agent turns.
  if (reviewGateConfig.enabled && reviewGateConfig.chunkSidecar.enabled) {
    console.log(c.cyan("\n  ─── Chunk sidecar preflight ───"));
    const health = probeActiveSidecarHealth(workingDirectory);
    if (!health.ok) {
      if (health.stale) {
        console.log(
          c.red(
            "  ✗ Active Chunk sidecar is out of date (CLI newer than the VM agent).",
          ),
        );
        console.log(
          c.dim("  Recreate and select a fresh sidecar, then retry:"),
        );
        console.log(
          c.dim(
            "    chunk sidecar create --name <name> --org-id $CIRCLECI_ORG_ID",
          ),
        );
        console.log(c.dim("    chunk sidecar use <id>"));
        console.log(
          c.dim(
            "    chunk sidecar add-ssh-key --public-key-file ~/.ssh/chunk_ai.pub",
          ),
        );
        console.log(c.dim("    ralphci check-chunk"));
      } else {
        console.log(c.red("  ✗ Chunk sidecar health probe failed."));
      }
      console.log(c.dim(`  Detail: ${health.detail.slice(0, 500)}`));
      process.exit(1);
      return;
    }
    console.log(c.green("  ✓ Sidecar exec probe ok (not stale)"));
  }

  // Select runner if not provided
  if (!runner) {
    console.log(c.cyan("\n  ─── Configuration ───"));
    if (configResult.source === "default") {
      console.log(c.dim("  Using default config (no ralphci.json found)"));
    } else {
      console.log(c.dim(`  Config loaded from: ${configResult.path}`));
    }
    console.log(c.dim(`  Runner: ${config.runner}`));
    console.log(c.dim(`  Model: ${config.model || "(runner default)"}`));
    if (config.taskSelection === "smart") {
      console.log(
        c.dim("  Task Selection: smart (with fallback to first-incomplete)"),
      );
    }
    console.log("");

    if (ciConfig.enabled) {
      console.log(c.cyan("  ─── CI Configuration ───"));
      console.log(c.dim(`  Provider: ${ciConfig.provider}`));
      console.log(c.dim(`  Auto Push: ${gitConfig.autoPush}`));
      console.log(c.dim(`  Push Strategy: ${describePushStrategy(gitConfig)}`));
      console.log(
        c.dim(`  Require CI Green: ${ciConfig.requireGreenBeforeComplete}`),
      );
      console.log(c.dim(`  Approval Gate: ${ciConfig.approvalGateEnabled}`));
      console.log(c.dim(`  Branch Strategy: ${ciConfig.branchStrategy}`));
      console.log(c.dim(`  Max CI Wait: ${ciConfig.maxCIWaitSeconds}s`));
    } else {
      console.log(c.cyan("  ─── Local-Only Mode ───"));
      console.log(c.dim("  CI integration: disabled"));
      console.log(
        c.dim(`  Auto Push: ${gitConfig.autoPush ? "enabled" : "disabled"}`),
      );
      console.log(c.dim("  Approval Gate: disabled"));
    }

    // Build Agent config
    console.log(c.cyan("  ─── Build Agent ───"));
    console.log(c.dim(`  Timeout: ${buildAgentConfig.timeoutMinutes}m`));
    console.log(
      c.dim(
        `  Verbose Output: ${buildAgentConfig.verbose ? "enabled" : "disabled"}`,
      ),
    );
    console.log(
      c.dim(
        `  Preflight Survey: ${preflightSurveyConfig.enabled ? "enabled" : "disabled"}`,
      ),
    );

    // Review Gate config
    console.log(c.cyan("  ─── Review Gate ───"));
    console.log(c.dim(`  Enabled: ${reviewGateConfig.enabled}`));
    if (reviewGateConfig.enabled) {
      console.log(c.dim(`  Inner loop mode: ${reviewGateConfig.innerLoop}`));
      console.log(
        c.dim(
          `  Format Fix (Prettier): ${reviewGateConfig.formatFixEnabled ? "enabled" : "disabled"}`,
        ),
      );
      console.log(
        c.dim(
          `  Lint Fix (ESLint): ${reviewGateConfig.lintFixEnabled ? "enabled" : "disabled"}`,
        ),
      );
      console.log(
        c.dim(
          `  Tests: ${reviewGateConfig.testsEnabled ? "enabled" : "disabled"}`,
        ),
      );
      console.log(
        c.dim(`  Test Timeout: ${reviewGateConfig.testTimeoutSeconds}s`),
      );
      const ch = reviewGateConfig.chunkSidecar;
      console.log(
        c.dim(
          `  Chunk sidecar: ${
            ch.enabled
              ? `enabled (${ch.skipSync ? "validate --remote only" : `sync: ${ch.syncMode} + validate --remote`})`
              : "disabled"
          }`,
        ),
      );
      if (ch.enabled) {
        const chunkWd = resolveChunkRemoteWorkdir(
          workingDirectory,
          ch.remoteWorkdir,
        );
        console.log(c.dim(`    remote workdir: ${chunkWd}`));
        console.log(
          c.dim(
            `    strict CLI: ${ch.strictCli ? "yes" : "no"} · skip sync: ${ch.skipSync ? "yes" : "no"}`,
          ),
        );
      }
    }

    // CI Doctor config (nested under ci)
    if (ciConfig.enabled) {
      console.log(c.cyan("  ─── CI Doctor (ci.doctor) ───"));
      console.log(c.dim(`  Enabled: ${ciDoctorConfig.enabled}`));
      console.log(
        c.dim(
          `  Log Mode: ${
            ciDoctorConfig.logMode === "failure-report"
              ? "failure-report (circleci run get --failure-report)"
              : "full (unshaped job logs)"
          }`,
        ),
      );
      console.log(
        c.dim(
          `  Max Log Length: ${ciDoctorConfig.maxLogLength === 0 ? "unlimited" : ciDoctorConfig.maxLogLength}`,
        ),
      );
      console.log(
        c.dim(
          `  Max doctor runs / failure signature (until push): ${ciDoctorConfig.maxInvocationsPerFailureFingerprint}`,
        ),
      );
      if (ciDoctorConfig.model) {
        console.log(c.dim(`  Model Override: ${ciDoctorConfig.model}`));
      }
    }

    if (serveConfig.enabled) {
      console.log(c.cyan("  ─── Local Server ───"));
      console.log(c.dim(`  URL: http://localhost:${serveConfig.port}`));
      console.log(c.dim(`  Serving: ${serveConfig.directory}/`));
    }
    console.log("");

    if (config.runner === "cursor") {
      runner = new CursorRunner(config.model);
    } else {
      runner = new DefaultClaudeRunner();
    }
  }

  // Validate required files exist
  const requiredFiles = ["plan.md", "prompt.md", "activity.md", "tasks.json"];
  const validation = await validateRequiredFiles(
    workingDirectory,
    requiredFiles,
    fs,
  );

  if (!validation.valid) {
    throw new CommandError(
      `Missing required files: ${validation.missing.join(", ")}\n` +
        `Run 'ralphci scaffold-ci -w ${workingDirectory}' to create the necessary files.`,
    );
  }

  // Initialize metrics
  const metrics: Metrics = {
    ...METRICS_TEMPLATE,
    startTime: new Date().toISOString(),
    iterations: [],
    summary: {
      ...METRICS_TEMPLATE.summary,
      innerLoopMode: reviewGateConfig.innerLoop,
    },
  };

  // Initialize cumulative stats
  const cumulative: CumulativeStats = {
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCacheReadTokens: 0,
    totalCost: 0,
  };

  const effectiveMaxIterations = unlimitedIterations ? Infinity : maxIterations;
  const displayMax = unlimitedIterations ? "∞" : maxIterations;
  let actualModelReported = false;
  let lastKnownModel: string | undefined;
  let reviewGateFeedback: string | null = null;
  let pendingChunkSidecarDoctorLogs: string | null = null;
  let missingPromiseStreak: { index: number; count: number } | null = null;

  function absorbReviewGateOutcome(gate: ReviewGateResult): void {
    if (gate.passed) {
      pendingChunkSidecarDoctorLogs = null;
      return;
    }
    if (!reviewGateConfig.chunkSidecar.enabled) {
      return;
    }
    if (!ciDoctorConfig.enabled) {
      return;
    }
    const logs = buildChunkSidecarDoctorLogs(gate);
    if (logs) {
      pendingChunkSidecarDoctorLogs = logs;
    }
  }

  async function preflightSurveyExists(): Promise<boolean> {
    try {
      const content = await fs.readFile(
        path.join(workingDirectory, "preflight.md"),
      );
      return content.trim().length > 0;
    } catch {
      return false;
    }
  }

  if (preflightSurveyConfig.enabled && !(await preflightSurveyExists())) {
    if (!runner) {
      throw new CommandError(
        "Preflight Survey requires a runner but none was selected.",
      );
    }
    console.log(c.cyan("\n  ─── Preflight Survey (before task 1) ───"));
    const preflightPrompt = buildPreflightSurveyPrompt(
      workingDirectory,
      packageRoot,
      validationManifest,
      {
        pushMode: resolveGitPushMode(gitConfig),
        pushStrategyLabel: describePushStrategy(gitConfig),
      },
    );
    printFullPrompt(preflightPrompt);
    const preflightStarted = Date.now();
    let preflightResponse;
    try {
      preflightResponse = await withSpinner(
        "Running Preflight Survey…",
        () =>
          runner!.runClaude({
            promptContent: preflightPrompt,
            workingDirectory,
            model: config.model,
            timeoutMinutes: buildAgentConfig.timeoutMinutes,
            verbose: buildAgentConfig.verbose,
          }),
        "Preflight Survey finished",
      );
    } catch (error) {
      throw new CommandError(
        `Preflight Survey failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    cumulative.totalInputTokens += preflightResponse.usage.input_tokens;
    cumulative.totalOutputTokens += preflightResponse.usage.output_tokens;
    cumulative.totalCacheReadTokens +=
      preflightResponse.usage.cache_read_input_tokens;
    cumulative.totalCost += preflightResponse.total_cost_usd;
    if (preflightResponse.model) {
      lastKnownModel = preflightResponse.model;
    }
    if (isPreflightCompleteSignal(preflightResponse.result)) {
      console.log(c.green("  ✓ Preflight Survey signaled preflight-complete"));
    } else {
      console.log(
        c.yellow(
          "  ⚠️  Preflight Survey did not signal <promise>preflight-complete</promise>",
        ),
      );
    }
    if (await preflightSurveyExists()) {
      console.log(c.green("  ✓ preflight.md written"));
    } else {
      console.log(
        c.yellow(
          "  ⚠️  preflight.md missing or empty — task loop will continue without it",
        ),
      );
    }
    console.log(
      c.dim(
        `  Preflight duration: ${((Date.now() - preflightStarted) / 1000).toFixed(1)}s`,
      ),
    );
  } else if (preflightSurveyConfig.enabled) {
    console.log(
      c.dim("\n  Preflight Survey skipped (preflight.md already exists)"),
    );
  }

  // Run the loop
  for (let attempt = 1; attempt <= effectiveMaxIterations; attempt++) {
    // Clean up any orphaned vitest workers from the previous iteration.
    // Between iterations no test process should be running, so anything
    // still alive is a leaked fork worker eating CPU.
    killOrphanedTestProcesses();

    const iterationStart = Date.now();
    const stepTimings: IterationStepTimings = {};

    // Safety-net server start: retry if the server should be running but isn't
    // (e.g. process crashed, or src/ existed at startup but startLocalServer failed).
    // The primary detection is the filesystem watcher (instant, mid-iteration).
    if (!serverProcess && serveConfig.enabled) {
      serverProcess = startLocalServer(workingDirectory, serveConfig);
      if (serverProcess) {
        console.log(
          c.green(
            `  ✓ Server started: http://localhost:${serveConfig.port} → ${serveConfig.directory}/`,
          ),
        );
        if (stopSrcWatcher) {
          stopSrcWatcher();
          stopSrcWatcher = null;
        }
      }
    }

    // Load tasks and select next incomplete task
    let tasks: Task[];
    try {
      tasks = await loadTasks(workingDirectory, fs);
    } catch (error) {
      throw new CommandError(
        `Failed to load tasks.json: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    // Attempt smart selection if configured
    let selected: { task: Task; index: number } | null = null;

    if (config.taskSelection === "smart") {
      const smartResult = await selectTaskSmart(
        tasks,
        workingDirectory,
        runner!,
        verbose,
        config.model,
      );
      selected = smartResult.selection;

      // Log selection spend if non-zero
      if (smartResult.usage) {
        const hasSelectionSpend =
          smartResult.usage.input_tokens > 0 ||
          smartResult.usage.output_tokens > 0 ||
          smartResult.totalCostUsd > 0;

        if (hasSelectionSpend) {
          console.log(c.dim("\n  Task selection (smart)"));
          console.log(
            c.dim(
              `    Tokens In: ${smartResult.usage.input_tokens}  Out: ${smartResult.usage.output_tokens}  Cache: ${smartResult.usage.cache_read_input_tokens}`,
            ),
          );
          console.log(
            c.dim(`    Cost: $${smartResult.totalCostUsd.toFixed(4)}`),
          );
        }

        // Add selection spend to cumulative totals
        cumulative.totalInputTokens += smartResult.usage.input_tokens;
        cumulative.totalOutputTokens += smartResult.usage.output_tokens;
        cumulative.totalCacheReadTokens +=
          smartResult.usage.cache_read_input_tokens;
        cumulative.totalCost += smartResult.totalCostUsd;
      }

      if (selected === null) {
        console.log(
          c.yellow(
            "  ⚠ Smart task selection failed, falling back to first incomplete task",
          ),
        );
      }
    }

    // Fall back to first incomplete task if smart selection didn't work or isn't enabled
    if (selected === null) {
      selected = selectNextTask(tasks);
    }

    if (!selected) {
      // All tasks marked complete, but we need to verify everything is truly done

      // Epilogue: unlock + one push now that the full game is locally green.
      if (
        resolveGitPushMode(gitConfig) === "epilogue" &&
        !epilogueUnlocked &&
        gitConfig.autoPush
      ) {
        epilogueUnlocked = true;
        console.log(
          c.green(
            "\n  📤 Epilogue: all tasks complete locally — pushing once to trigger CI…",
          ),
        );
        try {
          gitPush(workingDirectory);
          ciCache.recordPush();
          console.log(c.green("  ✓ Epilogue push complete (CI will verify)"));
          await tryCreatePR();
        } catch (error) {
          console.log(
            c.yellow(
              `  ⚠️  Epilogue push failed: ${error instanceof Error ? error.message : String(error)}`,
            ),
          );
        }
      }

      const hasChanges = hasUncommittedChanges(workingDirectory);

      if (hasChanges) {
        // There are uncommitted changes - continue loop so agent can commit/push
        console.log(
          c.yellow(
            "\n  ⚠️  All tasks marked complete, but uncommitted changes detected.",
          ),
        );
        console.log(
          c.dim(
            "  Continuing loop so agent can commit and push remaining changes...",
          ),
        );
        printIterationSeparator(
          attempt,
          displayMax,
          lastKnownModel || config.model,
        );

        // Build a "finalization" prompt for the agent
        const finalizationTask: Task = {
          category: "finalization",
          description:
            "Commit and push any remaining changes, verify CI passes",
          steps: [
            "Check for any uncommitted changes",
            "Commit all changes with a clear message",
            "Push to trigger CI",
            "Verify CI pipeline passes",
            "Signal <promise>COMPLETE</promise> when CI is green",
          ],
          passes: false,
        };

        // Pre-fetch CI status for finalization
        let injectedCI: InjectedCIStatus | null = null;
        if (ciConfig.enabled) {
          console.log(c.dim("  🔍 Fetching CI status..."));
          injectedCI = await prefetchCIStatus(
            workingDirectory,
            verbose,
            ciDoctorConfig,
          );
          if (injectedCI) {
            const statusText =
              injectedCI.status.status === "success"
                ? "✅ PASSING"
                : injectedCI.status.status === "failed"
                  ? "❌ FAILED"
                  : injectedCI.status.status === "running"
                    ? "🔄 RUNNING"
                    : `❓ ${injectedCI.status.status}`;
            console.log(c.dim(`  CI: ${statusText}`));
          }
        }

        let promptContent: string;
        try {
          promptContent = await buildPromptContent(
            workingDirectory,
            finalizationTask,
            tasks.length,
            ciConfig,
            fs,
            injectedCI ?? undefined,
            gitConfig,
            validationManifest,
            { includeValidationManifest: false },
          );
        } catch (error) {
          throw new CommandError(
            `Failed to build prompt content: ${error instanceof Error ? error.message : String(error)}`,
          );
        }

        printFullPrompt(promptContent);

        // Continue with the iteration (don't exit)
        let response;
        try {
          response = await withSpinner(
            "Running agent…",
            () =>
              runner!.runClaude({
                promptContent,
                workingDirectory,
                model: config.model,
                timeoutMinutes: buildAgentConfig.timeoutMinutes,
                verbose: buildAgentConfig.verbose,
              }),
            "Agent finished",
          );
        } catch (error) {
          throw new CommandError(
            `Failed to run agent: ${error instanceof Error ? error.message : String(error)}`,
          );
        }

        // Check if agent signaled COMPLETE
        if (response.result.includes("<promise>COMPLETE</promise>")) {
          console.log(
            c.green("\n  ✓ Agent signals ALL tasks complete and CI green!"),
          );

          // Push any remaining changes before exiting
          if (
            shouldPushToRemote(gitConfig, epilogueUnlocked) &&
            hasUncommittedChanges(workingDirectory)
          ) {
            console.log(c.dim("  📤 Pushing final changes..."));
            gitCommitAndPush(
              workingDirectory,
              "chore: finalize all tasks — CI green",
              getCoAuthor(config, lastKnownModel),
            );
            ciCache.recordPush();
            console.log(c.green("  ✓ Final changes pushed"));
            await tryCreatePR();
          }

          if (ciConfig.approvalGateEnabled) {
            console.log(
              c.yellow(
                "\n  🚦 APPROVAL GATE: All tasks complete. Ready for human review before deploy.",
              ),
            );
            console.log(
              c.dim(
                "  Review the changes and approve the deployment when ready.",
              ),
            );
          }

          metrics.endTime = new Date().toISOString();
          updateMetricsSummary(metrics, cumulative, attempt, tasks);
          await saveMetrics(workingDirectory, metrics, fs);
          console.log(
            c.dim(
              `\n  Metrics saved to ${path.join(workingDirectory, "metrics.json")}`,
            ),
          );

          await exitSuccess();
          return;
        }

        // Agent didn't signal complete, continue to next iteration
        continue;
      }

      // No uncommitted changes - check if we need CI verification
      if (ciConfig.requireGreenBeforeComplete) {
        console.log(
          c.yellow(
            "\n  ⚠️  All tasks marked complete. Verifying CI is green...",
          ),
        );
        console.log(
          c.dim("  Continuing loop so agent can verify CI status..."),
        );
        printIterationSeparator(
          attempt,
          displayMax,
          lastKnownModel || config.model,
        );

        // Build a "CI verification" prompt for the agent
        const verificationTask: Task = {
          category: "verification",
          description: "Verify CI pipeline is green before completing",
          steps: [
            "Review pre-fetched CI status below",
            "If CI is red, fix the failures",
            "If CI is green, signal <promise>COMPLETE</promise>",
            "If CI is still running, wait and check again",
          ],
          passes: false,
        };

        // Pre-fetch CI status for verification
        let injectedCIVerify: InjectedCIStatus | null = null;
        if (ciConfig.enabled) {
          console.log(c.dim("  🔍 Fetching CI status..."));
          injectedCIVerify = await prefetchCIStatus(
            workingDirectory,
            verbose,
            ciDoctorConfig,
          );
          if (injectedCIVerify) {
            const statusText =
              injectedCIVerify.status.status === "success"
                ? "✅ PASSING"
                : injectedCIVerify.status.status === "failed"
                  ? "❌ FAILED"
                  : injectedCIVerify.status.status === "running"
                    ? "🔄 RUNNING"
                    : `❓ ${injectedCIVerify.status.status}`;
            console.log(c.dim(`  CI: ${statusText}`));
          }
        }

        let promptContent: string;
        try {
          promptContent = await buildPromptContent(
            workingDirectory,
            verificationTask,
            tasks.length,
            ciConfig,
            fs,
            injectedCIVerify ?? undefined,
            gitConfig,
            validationManifest,
            { includeValidationManifest: false },
          );
        } catch (error) {
          throw new CommandError(
            `Failed to build prompt content: ${error instanceof Error ? error.message : String(error)}`,
          );
        }

        printFullPrompt(promptContent);

        let response;
        try {
          response = await withSpinner(
            "Running agent…",
            () =>
              runner!.runClaude({
                promptContent,
                workingDirectory,
                model: config.model,
                timeoutMinutes: buildAgentConfig.timeoutMinutes,
                verbose: buildAgentConfig.verbose,
              }),
            "Agent finished",
          );
        } catch (error) {
          throw new CommandError(
            `Failed to run agent: ${error instanceof Error ? error.message : String(error)}`,
          );
        }

        // Check if agent signaled COMPLETE (CI verified green)
        // Only accept COMPLETE when our own re-fetch shows success — never trust agent when CI was RUNNING
        if (response.result.includes("<promise>COMPLETE</promise>")) {
          let actuallyGreen = false;
          let recheck: InjectedCIStatus | null = null;
          if (ciConfig.enabled) {
            console.log(
              c.dim(
                "  🔍 Re-fetching CI status before accepting completion...",
              ),
            );
            recheck = await prefetchCIStatus(
              workingDirectory,
              verbose,
              ciDoctorConfig,
            );
            if (recheck?.status.status === "success") {
              actuallyGreen = true;
            } else if (recheck?.status.status === "running") {
              console.log(
                c.yellow(
                  "  ⚠️  CI is still RUNNING. Not completing — will re-check next iteration.",
                ),
              );
            } else if (recheck?.status.status === "failed") {
              console.log(
                c.red(
                  "  ❌ CI has FAILED. Agent signaled complete but pipeline is red — continuing to verify.",
                ),
              );
            }
          } else {
            actuallyGreen = true; // no CI → accept agent's word
          }

          if (actuallyGreen) {
            console.log(c.green("\n  ✓ Agent confirms CI is green!"));

            metrics.iterations.push(
              buildIterationMetric({
                iteration: attempt,
                agentRole: "build",
                ciStatusAtStart: recheck?.status.status ?? "success",
                ciQueriesMade: 1,
                taskWorkedOn: "Verify CI pipeline is green before completing",
                ciFailureFixed: false,
                outcome: "ci-verified-green",
                costUsd: 0,
                durationMs: 0,
                injectedCI: recheck,
                wallClockMs: 0,
                logMode: ciDoctorConfig.logMode,
              }),
            );
            maybeMarkFirstCIGreen(metrics, recheck);

            if (ciConfig.approvalGateEnabled) {
              console.log(
                c.yellow(
                  "\n  🚦 APPROVAL GATE: All tasks complete. Ready for human review before deploy.",
                ),
              );
              console.log(
                c.dim(
                  "  Review the changes and approve the deployment when ready.",
                ),
              );
            }

            metrics.endTime = new Date().toISOString();
            updateMetricsSummary(metrics, cumulative, attempt, tasks);
            await saveMetrics(workingDirectory, metrics, fs);
            console.log(
              c.dim(
                `\n  Metrics saved to ${path.join(workingDirectory, "metrics.json")}`,
              ),
            );

            await exitSuccess();
            return;
          }
        }

        // Agent didn't signal complete, or we re-fetched and CI wasn't success — continue
        if (response.result.includes("<promise>ci-fix-attempted</promise>")) {
          console.log(
            c.yellow("  🔧 CI fix attempted, continuing to verify..."),
          );
          if (
            shouldPushToRemote(gitConfig, epilogueUnlocked) &&
            hasUncommittedChanges(workingDirectory)
          ) {
            console.log(c.dim("  📤 Pushing CI fix..."));
            const fixSummary = extractCommitSummary(response.result);
            const fixMsg = fixSummary
              ? `fix(ci): ${fixSummary}`
              : "fix(ci): address pipeline failure";
            const fixDesc = extractCommitDescription(response.result);
            gitCommitAndPush(
              workingDirectory,
              fixMsg,
              getCoAuthor(config, lastKnownModel),
              fixDesc ?? undefined,
            );
            ciCache.recordPush();
            const fixedPipeline = injectedCIVerify?.status.pipelineNumber;
            if (fixedPipeline) ciCache.recordCIFix(fixedPipeline);
            console.log(c.green("  ✓ CI fix pushed"));
            await tryCreatePR();
          }
        }

        continue;
      }

      // All tasks complete, no uncommitted changes, CI verification not required

      console.log(c.green("\n  ✓ All tasks completed!"));

      if (ciConfig.approvalGateEnabled) {
        console.log(
          c.yellow(
            "\n  🚦 APPROVAL GATE: All tasks complete. Ready for human review before deploy.",
          ),
        );
        console.log(
          c.dim("  Review the changes and approve the deployment when ready."),
        );
      }

      // Save final metrics
      metrics.endTime = new Date().toISOString();
      updateMetricsSummary(metrics, cumulative, attempt - 1, tasks);
      await saveMetrics(workingDirectory, metrics, fs);
      console.log(
        c.dim(
          `\n  Metrics saved to ${path.join(workingDirectory, "metrics.json")}`,
        ),
      );

      await exitSuccess();
      return;
    }

    printIterationSeparator(
      attempt,
      displayMax,
      lastKnownModel || config.model,
    );

    const { task, index } = selected;
    console.log(
      c.cyan(`  📋 Task ${index + 1}/${tasks.length}: `) +
        c.bold(task.description),
    );

    // ─── PHASE 1: CI Status (with caching) ───
    let injectedCI: InjectedCIStatus | null = null;
    let ciQueried = false;
    if (ciConfig.enabled) {
      if (resolveGitPushMode(gitConfig) === "epilogue" && !epilogueUnlocked) {
        console.log(
          c.dim(
            "  🔍 CI: skipped (epilogue mode — no remote push until all tasks pass Review Gate)",
          ),
        );
      } else {
        const cached = ciCache.getCached();
        if (cached) {
          injectedCI = cached;
          console.log(
            c.dim("  🔍 CI: Using cached status (no push since last check)"),
          );
        } else {
          console.log(c.dim("  🔍 Fetching CI status..."));
          const prefetchStarted = Date.now();
          injectedCI = await prefetchCIStatus(
            workingDirectory,
            verbose,
            ciDoctorConfig,
          );
          stepTimings.prefetchMs = Date.now() - prefetchStarted;
          if (injectedCI) {
            ciCache.cacheResult(injectedCI);
          }
          ciQueried = true;
        }

        maybeMarkFirstCIGreen(metrics, injectedCI);

        if (injectedCI) {
          const { status: ciStatus } = injectedCI;
          const branchLabel = ciStatus.branch
            ? c.dim(` [branch: ${ciStatus.branch}]`)
            : "";
          if (ciStatus.status === "success") {
            console.log(c.green("  ✅ CI: PASSING") + branchLabel);
          } else if (ciStatus.status === "failed") {
            console.log(
              c.red("  ❌ CI: FAILED") +
                branchLabel +
                c.dim(` - ${ciStatus.message || "See logs below"}`),
            );
          } else if (ciStatus.status === "running") {
            console.log(
              c.cyan("  🔄 CI: RUNNING") +
                branchLabel +
                c.dim(` - ${ciStatus.message || "Pipeline in progress"}`),
            );
          } else if (ciStatus.status === "not_run") {
            console.log(
              c.dim(
                `  ⏸️  CI: NOT RUN - No pipelines found for branch "${ciStatus.branch || "unknown"}"`,
              ),
            );
          } else {
            console.log(
              c.dim(`  ❓ CI: ${ciStatus.status}`) +
                branchLabel +
                (ciStatus.message ? c.dim(` - ${ciStatus.message}`) : ""),
            );
          }
        } else {
          console.log(
            c.dim("  ⚠️  Could not fetch CI status (check CIRCLE_TOKEN)"),
          );
        }
      } // end non-epilogue CI prefetch
    }

    const ciWasRunningAtStart = injectedCI?.status.status === "running";
    let pushedThisIteration = false;

    // ─── PHASE 2: CI Doctor (if CI is red) ───
    const failedPipelineNumber =
      injectedCI?.status.status === "failed"
        ? injectedCI.status.pipelineNumber
        : undefined;

    const ciHasFailure = injectedCI && injectedCI.status.status === "failed";

    const ciIsFailing =
      ciHasFailure && !ciCache.isAlreadyFixed(failedPipelineNumber);

    const runChunkSidecarCIDoctorIfNeeded = async (): Promise<
      "continue" | "noop"
    > => {
      if (
        !ciDoctorConfig.enabled ||
        !reviewGateConfig.chunkSidecar.enabled ||
        !pendingChunkSidecarDoctorLogs ||
        ciIsFailing
      ) {
        return "noop";
      }

      const chunkLogs = pendingChunkSidecarDoctorLogs;
      pendingChunkSidecarDoctorLogs = null;

      const chunkDoctorCI = buildChunkSidecarDoctorInjection(
        injectedCI,
        workingDirectory,
        chunkLogs,
      );

      const preDoctorSha = getHeadSha(workingDirectory);
      try {
        const doctorResponse = await runCIDoctor(
          workingDirectory,
          chunkDoctorCI,
          runner!,
          ciDoctorConfig.model || config.model,
          {
            banner: "\n  ─── CI Doctor (Chunk sidecar) ───",
            innerLoop: reviewGateConfig.innerLoop,
          },
        );

        absorbAgentCommits(workingDirectory, preDoctorSha);
        cumulative.totalInputTokens += doctorResponse.usage.input_tokens;
        cumulative.totalOutputTokens += doctorResponse.usage.output_tokens;
        cumulative.totalCacheReadTokens +=
          doctorResponse.usage.cache_read_input_tokens;
        cumulative.totalCost += doctorResponse.total_cost_usd;

        const doctorDuration = doctorResponse.duration_ms || 0;
        const hasTokens =
          doctorResponse.usage.input_tokens > 0 ||
          doctorResponse.usage.output_tokens > 0;
        if (hasTokens) {
          console.log(
            c.dim(
              `  CI Doctor (Chunk) — Tokens In: ${doctorResponse.usage.input_tokens}  Out: ${doctorResponse.usage.output_tokens}`,
            ),
          );
          console.log(
            c.dim(
              `  CI Doctor (Chunk) — Cost: $${doctorResponse.total_cost_usd.toFixed(4)}`,
            ),
          );
        }

        if (doctorResponse.model) {
          lastKnownModel = doctorResponse.model;
          if (!actualModelReported) {
            console.log(c.cyan(`\n  Model: ${doctorResponse.model}`));
            actualModelReported = true;
          }
        }

        if (
          doctorResponse.result.includes("<promise>ci-fix-attempted</promise>")
        ) {
          console.log(
            c.green(
              "  🏥 CI Doctor (Chunk) applied a fix — running Review Gate...",
            ),
          );

          const doctorSummary = extractCommitSummary(doctorResponse.result);
          const doctorSubject = buildCiDoctorCommitSubject(
            "sidecar",
            doctorSummary,
          );
          const doctorAgentDesc = extractCommitDescription(
            doctorResponse.result,
          );
          const coAuthor = getCoAuthor(config, lastKnownModel);

          if (reviewGateConfig.enabled) {
            const gateResult = await runReviewGate(
              workingDirectory,
              reviewGateConfig,
            );
            absorbReviewGateOutcome(gateResult);

            const commitBody = buildCiDoctorCommitBody(
              "sidecar",
              doctorAgentDesc,
              { gatePassed: gateResult.passed },
            );

            const hadWork = hasUncommittedChanges(workingDirectory);
            let commitOk = true;
            if (hadWork) {
              console.log(
                c.dim(
                  "  📝 Recording CI Doctor (Chunk) attempt as local commit...",
                ),
              );
              commitOk = gitCommit(
                workingDirectory,
                doctorSubject,
                coAuthor,
                commitBody,
              );
              if (!commitOk) {
                console.log(
                  c.yellow(
                    "  ⚠️  Could not create git commit for CI Doctor (Chunk) attempt",
                  ),
                );
              }
            }

            if (gateResult.passed) {
              reviewGateFeedback = null;

              if (shouldPushToRemote(gitConfig, epilogueUnlocked)) {
                if (hadWork && commitOk) {
                  console.log(c.dim("  📤 Pushing to origin..."));
                  gitPush(workingDirectory);
                  ciCache.recordPush();
                  pushedThisIteration = true;
                  console.log(c.green("  ✓ Chunk sidecar fix pushed"));
                  await tryCreatePR();
                } else if (!hadWork) {
                  console.log(
                    c.dim(
                      "  ℹ️  CI Doctor (Chunk) fix already applied locally — no new changes to push.",
                    ),
                  );
                  ciCache.invalidate();
                }
              } else if (
                resolveGitPushMode(gitConfig) === "epilogue" &&
                !epilogueUnlocked &&
                hadWork
              ) {
                console.log(
                  c.dim(
                    "  ⏸️  Epilogue mode: Chunk fix committed locally (push deferred).",
                  ),
                );
              }
            } else {
              console.log(
                c.yellow(
                  "  ⚠️  CI Doctor (Chunk) fix did not pass Review Gate",
                ),
              );
              reviewGateFeedback = buildReviewGateFeedback(gateResult);
            }
          } else if (gitConfig.autoPush) {
            reviewGateFeedback = null;
            const commitBody = buildCiDoctorCommitBody(
              "sidecar",
              doctorAgentDesc,
              { gatePassed: true },
            );
            const hadWork = hasUncommittedChanges(workingDirectory);
            let commitOk = true;
            if (hadWork) {
              console.log(
                c.dim(
                  "  📝 Recording CI Doctor (Chunk) attempt as local commit...",
                ),
              );
              commitOk = gitCommit(
                workingDirectory,
                doctorSubject,
                coAuthor,
                commitBody,
              );
              if (!commitOk) {
                console.log(
                  c.yellow(
                    "  ⚠️  Could not create git commit for CI Doctor (Chunk) attempt",
                  ),
                );
              }
            }

            if (hadWork && commitOk) {
              if (shouldPushToRemote(gitConfig, epilogueUnlocked)) {
                console.log(c.dim("  📤 Pushing CI Doctor (Chunk) fix..."));
                gitPush(workingDirectory);
                ciCache.recordPush();
                pushedThisIteration = true;
                console.log(c.green("  ✓ Chunk sidecar fix pushed"));
                await tryCreatePR();
              } else {
                console.log(
                  c.dim(
                    "  ⏸️  Epilogue mode: Chunk fix committed locally (push deferred).",
                  ),
                );
              }
            } else if (!hadWork) {
              console.log(
                c.dim(
                  "  ℹ️  CI Doctor (Chunk) fix already applied locally — no new changes to push.",
                ),
              );
              ciCache.invalidate();
            }
          }

          metrics.iterations.push(
            buildIterationMetric({
              iteration: attempt,
              agentRole: "ci-doctor",
              ciStatusAtStart: injectedCI?.status.status || "unknown",
              ciQueriesMade: ciQueried ? 1 : 0,
              taskWorkedOn:
                "[CI Doctor] Fix Chunk sidecar (validate --remote) failure",
              ciFailureFixed: true,
              outcome: "ci-fix-attempted",
              costUsd: doctorResponse.total_cost_usd,
              durationMs: doctorDuration,
              usage: doctorResponse.usage,
              injectedCI,
              logMode: ciDoctorConfig.logMode,
              wallClockMs: Date.now() - iterationStart,
              stepTimings: {
                ...stepTimings,
                doctorMs: doctorDuration,
              },
            }),
          );

          if (attempt % 5 === 0) {
            const currentTasks = await loadTasks(workingDirectory, fs);
            updateMetricsSummary(metrics, cumulative, attempt, currentTasks);
            await saveMetrics(workingDirectory, metrics, fs);
          }
          return "continue";
        }

        if (doctorResponse.result.includes("<promise>needs-human</promise>")) {
          if (afkMode) {
            console.log(
              c.yellow(
                "\n  ⚠️  CI Doctor (Chunk) signaled needs-human — AFK mode ignores pause; continuing.",
              ),
            );
            metrics.iterations.push(
              buildIterationMetric({
                iteration: attempt,
                agentRole: "ci-doctor",
                ciStatusAtStart: injectedCI?.status.status || "unknown",
                ciQueriesMade: ciQueried ? 1 : 0,
                taskWorkedOn:
                  "[CI Doctor] Chunk sidecar — needs-human (AFK ignored)",
                ciFailureFixed: false,
                outcome: "needs-human-afk-ignored",
                costUsd: doctorResponse.total_cost_usd,
                durationMs: doctorDuration,
                usage: doctorResponse.usage,
                injectedCI,
                wallClockMs: Date.now() - iterationStart,
                stepTimings: {
                  ...stepTimings,
                  doctorMs: doctorDuration,
                },
              }),
            );
            reviewGateFeedback =
              "AFK mode: human pause disabled. Keep diagnosing or recreate the sidecar (`chunk sidecar create` / `use` / `add-ssh-key`) and signal a fix tag — do not use needs-human.";
            return "continue";
          }
          console.log(
            c.yellow("\n  ⚠️  CI Doctor (Chunk) requests human assistance!"),
          );
          console.log(
            c.dim(
              "  The Chunk sidecar failure may require manual intervention (auth, sidecar host, or Chunk CLI).",
            ),
          );

          metrics.iterations.push(
            buildIterationMetric({
              iteration: attempt,
              agentRole: "ci-doctor",
              ciStatusAtStart: injectedCI?.status.status || "unknown",
              ciQueriesMade: ciQueried ? 1 : 0,
              taskWorkedOn: "[CI Doctor] Chunk sidecar — needs human",
              ciFailureFixed: false,
              outcome: "needs-human",
              costUsd: doctorResponse.total_cost_usd,
              durationMs: doctorDuration,
              usage: doctorResponse.usage,
              injectedCI,
              logMode: ciDoctorConfig.logMode,
              wallClockMs: Date.now() - iterationStart,
              stepTimings: {
                ...stepTimings,
                doctorMs: doctorDuration,
              },
            }),
          );
          metrics.endTime = new Date().toISOString();
          const currentTasks = await loadTasks(workingDirectory, fs);
          updateMetricsSummary(metrics, cumulative, attempt, currentTasks);
          await saveMetrics(workingDirectory, metrics, fs);
          console.log(
            c.dim(
              `\n  Metrics saved to ${path.join(workingDirectory, "metrics.json")}`,
            ),
          );
          console.log(
            c.dim(
              "\n  Loop paused. Address the Chunk sidecar issue and run again to continue.",
            ),
          );
          process.exit(2);
        }

        return "noop";
      } catch (error) {
        console.log(
          c.yellow(
            `  ⚠️  CI Doctor (Chunk) error: ${error instanceof Error ? error.message : String(error)}`,
          ),
        );
        console.log(c.dim("  Falling through to Build Agent..."));
        return "noop";
      }
    };

    if (ciHasFailure && ciCache.isAlreadyFixed(failedPipelineNumber)) {
      console.log(
        c.dim(
          `  🏥 CI: Previous failure (pipeline #${failedPipelineNumber}) already addressed by CI Doctor — waiting for pipeline #${injectedCI!.status.pipelineNumber}`,
        ),
      );
    }

    const ciFailureFingerprint =
      injectedCI && injectedCI.status.status === "failed"
        ? computeCIFailureFingerprint(
            injectedCI.failureLogs,
            injectedCI.status.failedJobs,
          )
        : "";

    let skipDoctorForFingerprint = false;
    if (
      ciIsFailing &&
      ciDoctorConfig.enabled &&
      ciFailureFingerprint &&
      ciCache.shouldSkipDoctorForFingerprint(
        ciFailureFingerprint,
        ciDoctorConfig.maxInvocationsPerFailureFingerprint,
      )
    ) {
      skipDoctorForFingerprint = true;
      console.log(
        c.dim(
          `  🏥 CI Doctor skipped — same failure signature as a prior doctor run this push cycle (${ciDoctorConfig.maxInvocationsPerFailureFingerprint} max); Build Agent receives CI logs below.`,
        ),
      );
      const notice = buildCIDoctorFingerprintSkipNotice(
        ciFailureFingerprint.slice(0, 16),
      );
      reviewGateFeedback = reviewGateFeedback
        ? `${notice}\n\n---\n\n${reviewGateFeedback}`
        : notice;
    }

    if (ciIsFailing && ciDoctorConfig.enabled && !skipDoctorForFingerprint) {
      const chunkForDoctor = pendingChunkSidecarDoctorLogs;
      pendingChunkSidecarDoctorLogs = null;

      const doctorCI: InjectedCIStatus = {
        ...injectedCI!,
        chunkSidecarFailureLogs: chunkForDoctor ?? undefined,
      };

      // Run CI Doctor agent
      const preDoctorSha = getHeadSha(workingDirectory);
      try {
        const doctorResponse = await runCIDoctor(
          workingDirectory,
          doctorCI,
          runner!,
          ciDoctorConfig.model || config.model,
          { innerLoop: reviewGateConfig.innerLoop },
        );

        if (ciFailureFingerprint) {
          ciCache.recordDoctorInvocationForFingerprint(ciFailureFingerprint);
        }

        // Absorb any commits the agent made despite instructions
        absorbAgentCommits(workingDirectory, preDoctorSha);

        // Track CI Doctor cost
        cumulative.totalInputTokens += doctorResponse.usage.input_tokens;
        cumulative.totalOutputTokens += doctorResponse.usage.output_tokens;
        cumulative.totalCacheReadTokens +=
          doctorResponse.usage.cache_read_input_tokens;
        cumulative.totalCost += doctorResponse.total_cost_usd;

        const doctorDuration = doctorResponse.duration_ms || 0;
        const hasTokens =
          doctorResponse.usage.input_tokens > 0 ||
          doctorResponse.usage.output_tokens > 0;
        if (hasTokens) {
          console.log(
            c.dim(
              `  CI Doctor — Tokens In: ${doctorResponse.usage.input_tokens}  Out: ${doctorResponse.usage.output_tokens}`,
            ),
          );
          console.log(
            c.dim(
              `  CI Doctor — Cost: $${doctorResponse.total_cost_usd.toFixed(4)}`,
            ),
          );
        }

        if (doctorResponse.model) {
          lastKnownModel = doctorResponse.model;
          if (!actualModelReported) {
            console.log(c.cyan(`\n  Model: ${doctorResponse.model}`));
            actualModelReported = true;
          }
        }

        // CI Doctor made changes — run Review Gate on the fix
        if (
          doctorResponse.result.includes("<promise>ci-fix-attempted</promise>")
        ) {
          console.log(
            c.green("  🏥 CI Doctor applied a fix — running Review Gate..."),
          );

          const doctorSummary = extractCommitSummary(doctorResponse.result);
          const doctorSubject = buildCiDoctorCommitSubject(
            "pipeline",
            doctorSummary,
          );
          const doctorAgentDesc = extractCommitDescription(
            doctorResponse.result,
          );
          const coAuthor = getCoAuthor(config, lastKnownModel);
          const failedJobNames = injectedCI!.status.failedJobs?.map(
            (j) => j.name,
          );

          if (reviewGateConfig.enabled) {
            const gateResult = await runReviewGate(
              workingDirectory,
              reviewGateConfig,
            );
            absorbReviewGateOutcome(gateResult);

            const commitBody = buildCiDoctorCommitBody(
              "pipeline",
              doctorAgentDesc,
              {
                gatePassed: gateResult.passed,
                failedJobNames,
              },
            );

            const hadWork = hasUncommittedChanges(workingDirectory);
            let commitOk = true;
            if (hadWork) {
              console.log(
                c.dim("  📝 Recording CI Doctor attempt as local commit..."),
              );
              commitOk = gitCommit(
                workingDirectory,
                doctorSubject,
                coAuthor,
                commitBody,
              );
              if (!commitOk) {
                console.log(
                  c.yellow(
                    "  ⚠️  Could not create git commit for CI Doctor attempt",
                  ),
                );
              }
            }

            if (gateResult.passed) {
              if (failedPipelineNumber)
                ciCache.recordCIFix(failedPipelineNumber);

              if (shouldPushToRemote(gitConfig, epilogueUnlocked)) {
                if (hadWork && commitOk) {
                  console.log(c.dim("  📤 Pushing to origin..."));
                  gitPush(workingDirectory);
                  ciCache.recordPush();
                  pushedThisIteration = true;
                  console.log(c.green("  ✓ CI fix pushed"));
                  await tryCreatePR();
                } else if (!hadWork) {
                  console.log(
                    c.dim(
                      "  ℹ️  CI Doctor fix already applied locally — no new changes to push. Re-checking CI status next iteration.",
                    ),
                  );
                  ciCache.invalidate();
                }
              } else if (
                resolveGitPushMode(gitConfig) === "epilogue" &&
                !epilogueUnlocked &&
                hadWork
              ) {
                console.log(
                  c.dim(
                    "  ⏸️  Epilogue mode: CI Doctor fix committed locally (push deferred).",
                  ),
                );
              }
            } else {
              // Review Gate failed on the CI Doctor's fix — feed back to Build Agent
              console.log(
                c.yellow("  ⚠️  CI Doctor's fix didn't pass Review Gate"),
              );
              reviewGateFeedback = buildReviewGateFeedback(gateResult);
            }
          } else {
            // Review Gate disabled — just push
            if (failedPipelineNumber) ciCache.recordCIFix(failedPipelineNumber);

            const commitBody = buildCiDoctorCommitBody(
              "pipeline",
              doctorAgentDesc,
              { gatePassed: true, failedJobNames },
            );
            const hadWork = hasUncommittedChanges(workingDirectory);
            let commitOk = true;
            if (hadWork) {
              console.log(
                c.dim("  📝 Recording CI Doctor attempt as local commit..."),
              );
              commitOk = gitCommit(
                workingDirectory,
                doctorSubject,
                coAuthor,
                commitBody,
              );
              if (!commitOk) {
                console.log(
                  c.yellow(
                    "  ⚠️  Could not create git commit for CI Doctor attempt",
                  ),
                );
              }
            }

            if (
              shouldPushToRemote(gitConfig, epilogueUnlocked) &&
              hadWork &&
              commitOk
            ) {
              console.log(c.dim("  📤 Pushing CI Doctor fix..."));
              gitPush(workingDirectory);
              ciCache.recordPush();
              pushedThisIteration = true;
              console.log(c.green("  ✓ CI fix pushed"));
              await tryCreatePR();
            } else if (
              resolveGitPushMode(gitConfig) === "epilogue" &&
              !epilogueUnlocked &&
              hadWork &&
              commitOk
            ) {
              console.log(
                c.dim(
                  "  ⏸️  Epilogue mode: CI Doctor fix committed locally (push deferred).",
                ),
              );
            } else if (gitConfig.autoPush && !hadWork) {
              console.log(
                c.dim(
                  "  ℹ️  CI Doctor fix already applied locally — no new changes to push. Re-checking CI status next iteration.",
                ),
              );
              ciCache.invalidate();
            }
          }

          metrics.iterations.push(
            buildIterationMetric({
              iteration: attempt,
              agentRole: "ci-doctor",
              ciStatusAtStart: injectedCI?.status.status || "unknown",
              ciQueriesMade: ciQueried ? 1 : 0,
              taskWorkedOn: "[CI Doctor] Fix pipeline failure",
              ciFailureFixed: true,
              outcome: "ci-fix-attempted",
              costUsd: doctorResponse.total_cost_usd,
              durationMs: doctorDuration,
              usage: doctorResponse.usage,
              injectedCI,
              logMode: ciDoctorConfig.logMode,
              wallClockMs: Date.now() - iterationStart,
              stepTimings: {
                ...stepTimings,
                doctorMs: doctorDuration,
              },
            }),
          );

          // CI Doctor handled this iteration — continue to next
          if (attempt % 5 === 0) {
            const currentTasks = await loadTasks(workingDirectory, fs);
            updateMetricsSummary(metrics, cumulative, attempt, currentTasks);
            await saveMetrics(workingDirectory, metrics, fs);
          }
          continue;
        }

        if (doctorResponse.result.includes("<promise>needs-human</promise>")) {
          if (afkMode) {
            console.log(
              c.yellow(
                "\n  ⚠️  CI Doctor signaled needs-human — AFK mode ignores pause; continuing.",
              ),
            );
            metrics.iterations.push(
              buildIterationMetric({
                iteration: attempt,
                agentRole: "ci-doctor",
                ciStatusAtStart: injectedCI?.status.status || "unknown",
                ciQueriesMade: ciQueried ? 1 : 0,
                taskWorkedOn:
                  "[CI Doctor] Diagnosis — needs-human (AFK ignored)",
                ciFailureFixed: false,
                outcome: "needs-human-afk-ignored",
                costUsd: doctorResponse.total_cost_usd,
                durationMs: doctorDuration,
                usage: doctorResponse.usage,
                injectedCI,
                wallClockMs: Date.now() - iterationStart,
                stepTimings: {
                  ...stepTimings,
                  doctorMs: doctorDuration,
                },
              }),
            );
            reviewGateFeedback =
              "AFK mode: human pause disabled. Keep fixing the CI failure and signal <promise>ci-fix-attempted</promise> — do not use needs-human.";
            continue;
          }
          console.log(c.yellow("\n  ⚠️  CI Doctor requests human assistance!"));
          console.log(
            c.dim(
              "  The CI failure may require infrastructure changes or manual intervention.",
            ),
          );

          metrics.iterations.push(
            buildIterationMetric({
              iteration: attempt,
              agentRole: "ci-doctor",
              ciStatusAtStart: injectedCI?.status.status || "unknown",
              ciQueriesMade: ciQueried ? 1 : 0,
              taskWorkedOn: "[CI Doctor] Diagnosis — needs human",
              ciFailureFixed: false,
              outcome: "needs-human",
              costUsd: doctorResponse.total_cost_usd,
              durationMs: doctorDuration,
              usage: doctorResponse.usage,
              injectedCI,
              logMode: ciDoctorConfig.logMode,
              wallClockMs: Date.now() - iterationStart,
              stepTimings: {
                ...stepTimings,
                doctorMs: doctorDuration,
              },
            }),
          );
          metrics.endTime = new Date().toISOString();
          const currentTasks = await loadTasks(workingDirectory, fs);
          updateMetricsSummary(metrics, cumulative, attempt, currentTasks);
          await saveMetrics(workingDirectory, metrics, fs);
          console.log(
            c.dim(
              `\n  Metrics saved to ${path.join(workingDirectory, "metrics.json")}`,
            ),
          );
          console.log(
            c.dim(
              "\n  Loop paused. Address the CI issue and run again to continue.",
            ),
          );
          process.exit(2);
          return;
        }
      } catch (error) {
        console.log(
          c.yellow(
            `  ⚠️  CI Doctor error: ${error instanceof Error ? error.message : String(error)}`,
          ),
        );
        console.log(c.dim("  Falling through to Build Agent..."));
      }
    }

    const chunkDoctorLoopOutcome = await runChunkSidecarCIDoctorIfNeeded();
    if (chunkDoctorLoopOutcome === "continue") {
      continue;
    }

    // ─── PHASE 3: Build Agent ───
    // Build prompt content — lighter now (no CI failure context)
    let promptContent: string;
    try {
      // Don't inject CI failure context when CI Doctor just ran this iteration.
      // When the doctor is skipped (unchanged failure signature), the Build Agent
      // must see CI logs again.
      const alreadyFixedByDoctor = ciCache.isAlreadyFixed(failedPipelineNumber);
      const suppressCiFailureForBuildAgent =
        ciIsFailing && ciDoctorConfig.enabled && !skipDoctorForFingerprint;
      const buildAgentCI = suppressCiFailureForBuildAgent
        ? undefined
        : alreadyFixedByDoctor && injectedCI
          ? { status: injectedCI.status, failureLogs: null }
          : (injectedCI ?? undefined);
      promptContent = await buildPromptContent(
        workingDirectory,
        task,
        index,
        ciConfig,
        fs,
        buildAgentCI,
        gitConfig,
        validationManifest,
        { includeValidationManifest: index === 0 },
      );
    } catch (error) {
      throw new CommandError(
        `Failed to build prompt content: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    // Inject Review Gate feedback at the TOP of the prompt — highest priority
    if (reviewGateFeedback) {
      promptContent = reviewGateFeedback + "\n\n---\n\n" + promptContent;
      reviewGateFeedback = null; // Consumed — clear so it's not re-injected next iteration
    }

    // Show full prompt (no truncation) with clear formatting
    printFullPrompt(promptContent);

    // Call Build Agent
    const preBuildSha = getHeadSha(workingDirectory);
    let response;
    try {
      response = await withSpinner(
        "Running Build Agent…",
        () =>
          runner!.runClaude({
            promptContent,
            workingDirectory,
            model: config.model,
            timeoutMinutes: buildAgentConfig.timeoutMinutes,
            verbose: buildAgentConfig.verbose,
          }),
        "Build Agent finished",
      );
    } catch (error) {
      throw new CommandError(
        `Failed to run Build Agent: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    // Absorb any commits the agent made despite instructions
    absorbAgentCommits(workingDirectory, preBuildSha);

    const iterationDuration = Date.now() - iterationStart;

    // Update cumulative stats
    cumulative.totalInputTokens += response.usage.input_tokens;
    cumulative.totalOutputTokens += response.usage.output_tokens;
    cumulative.totalCacheReadTokens += response.usage.cache_read_input_tokens;
    cumulative.totalCost += response.total_cost_usd;

    // Print per-attempt stats
    const attemptStats: AttemptStats = {
      attempt,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      cacheReadTokens: response.usage.cache_read_input_tokens,
      cost: response.total_cost_usd,
      durationMs: response.duration_ms || iterationDuration,
    };

    const hasTokenStats =
      attemptStats.inputTokens > 0 ||
      attemptStats.outputTokens > 0 ||
      attemptStats.cost > 0;

    // Track the actual model used (from agent response)
    if (response.model) {
      lastKnownModel = response.model;
      if (!actualModelReported) {
        console.log(c.cyan(`\n  Model: ${response.model}`));
        actualModelReported = true;
      }
      if (response.model.toLowerCase().includes("synthetic")) {
        console.log(
          c.yellow(
            "  ℹ️  Claude Code reported a synthetic model — runs are not backed by a full API session. Expect empty or non-tagged replies; use `claude` while signed in with a real model for RalphCI.",
          ),
        );
      }
    }

    if (hasTokenStats) {
      console.log(
        c.dim(
          `  Tokens In: ${attemptStats.inputTokens}  Out: ${attemptStats.outputTokens}  Cache: ${attemptStats.cacheReadTokens}`,
        ),
      );
      console.log(c.dim(`  Cost: $${attemptStats.cost.toFixed(4)}`));
      console.log(
        c.dim("  Cumulative: ") + `$${cumulative.totalCost.toFixed(4)} total`,
      );
    } else if (response.duration_ms !== undefined) {
      console.log(c.dim(`  Duration: ${response.duration_ms}ms`));
    }

    // Record iteration metrics
    const iterationMetric = buildIterationMetric({
      iteration: attempt,
      agentRole: "build",
      ciStatusAtStart: injectedCI?.status.status || "not-checked",
      ciQueriesMade: ciQueried ? 1 : 0,
      taskWorkedOn: task.description,
      ciFailureFixed: response.result.includes(
        "<promise>ci-fix-attempted</promise>",
      ),
      outcome: "unknown",
      costUsd: attemptStats.cost,
      durationMs: attemptStats.durationMs,
      usage: {
        input_tokens: attemptStats.inputTokens,
        output_tokens: attemptStats.outputTokens,
        cache_read_input_tokens: attemptStats.cacheReadTokens,
      },
      injectedCI,
      wallClockMs: iterationDuration,
      stepTimings: {
        ...stepTimings,
        buildAgentMs: response.duration_ms || iterationDuration,
      },
    });

    // ─── Fallback server start: if src/ appeared but the watcher missed it ───
    // The filesystem watcher (watchForSrcDir) is the primary detection mechanism
    // and fires instantly mid-iteration. This is a belt-and-suspenders fallback.
    if (!serverProcess) {
      const srcPath = path.join(workingDirectory, serveConfig.directory);
      try {
        const srcNowExists = await fs.exists(srcPath);
        if (srcNowExists) {
          if (!serveConfig.enabled) {
            serveConfig.enabled = true;
          }
          console.log(
            c.cyan(
              `  🌐 ${serveConfig.directory}/ detected — starting local server on http://localhost:${serveConfig.port}...`,
            ),
          );
          serverProcess = startLocalServer(workingDirectory, serveConfig);
          if (serverProcess) {
            console.log(
              c.green(
                `  ✓ Server running: http://localhost:${serveConfig.port} → ${serveConfig.directory}/`,
              ),
            );
            if (stopSrcWatcher) {
              stopSrcWatcher();
              stopSrcWatcher = null;
            }
          }
        }
      } catch {
        // Ignore — will try again next iteration
      }
    }

    // ─── PHASE 4: Signal Handling + Review Gate ───

    if (hasOrchestratorCompletionTag(response.result)) {
      missingPromiseStreak = null;
    }

    if (response.result.includes("<promise>COMPLETE</promise>")) {
      console.log(
        c.green("\n  ✓ Build Agent signals ALL tasks complete and CI green!"),
      );
      iterationMetric.outcome = "COMPLETE";
      metrics.iterations.push(iterationMetric);

      // Mark current task complete
      const updatedTasks = markTaskComplete(tasks, index, true);
      await saveTasks(workingDirectory, updatedTasks, fs);

      // Run Review Gate before final push
      let finalizeGateOk = true;
      if (reviewGateConfig.enabled && hasUncommittedChanges(workingDirectory)) {
        const gateResult = await runReviewGate(
          workingDirectory,
          reviewGateConfig,
        );
        absorbReviewGateOutcome(gateResult);
        finalizeGateOk = gateResult.passed;
        if (!gateResult.passed) {
          console.log(
            c.yellow(
              "  ⚠️  Review Gate failed on finalize — recording local commit only; not pushing or exiting.",
            ),
          );
          reviewGateFeedback = buildReviewGateFeedback(gateResult);
        }
      }

      const finalizeBody = !finalizeGateOk
        ? "Review gate did not pass on finalize; push and completion deferred."
        : undefined;

      const hadFinalizeWorkBeforeCommit =
        hasUncommittedChanges(workingDirectory);
      let finalizeCommitted = false;
      if (hadFinalizeWorkBeforeCommit) {
        console.log(c.dim("  📝 Recording finalize as local commit..."));
        finalizeCommitted = gitCommit(
          workingDirectory,
          "chore: finalize all tasks",
          getCoAuthor(config, lastKnownModel),
          finalizeBody,
        );
      }

      if (!finalizeGateOk) {
        continue;
      }

      // COMPLETE means the agent believes the full run is done — unlock epilogue.
      if (resolveGitPushMode(gitConfig) === "epilogue") {
        epilogueUnlocked = true;
      }

      if (
        shouldPushToRemote(gitConfig, epilogueUnlocked) &&
        (!hadFinalizeWorkBeforeCommit || finalizeCommitted)
      ) {
        console.log(c.dim("  📤 Pushing final changes..."));
        gitPush(workingDirectory);
        ciCache.recordPush();
        pushedThisIteration = true;
        console.log(c.green("  ✓ Final changes pushed"));
        await tryCreatePR();
      }

      if (ciConfig.enabled && pushedThisIteration) {
        console.log(
          c.dim("  ⏳ Polling for CI result (after epilogue/final push)..."),
        );
        const pollStarted = Date.now();
        const settled = await pollPrefetchCIStatus(
          workingDirectory,
          ciConfig.maxCIWaitSeconds * 1000,
          verbose,
          ciDoctorConfig,
        );
        const ciPollMs = Date.now() - pollStarted;
        if (iterationMetric.stepTimings) {
          iterationMetric.stepTimings.ciPollMs = ciPollMs;
        }
        if (settled) {
          applyInjectedCIToIterationMetric(iterationMetric, settled);
          iterationMetric.ciQueriesMade = Math.max(
            iterationMetric.ciQueriesMade,
            1,
          );
          ciCache.cacheResult(settled);
          maybeMarkFirstCIGreen(metrics, settled);
          if (pushedThisIteration) {
            if (resolveGitPushMode(gitConfig) === "epilogue") {
              epilogueRemotePushCount += 1;
            }
            recordCIPushOutcome(metrics, gitConfig, settled, {
              isFirstEpiloguePush:
                resolveGitPushMode(gitConfig) === "epilogue" &&
                epilogueRemotePushCount === 1,
            });
          }
        }
      }

      if (ciConfig.approvalGateEnabled) {
        console.log(
          c.yellow(
            "\n  🚦 APPROVAL GATE: All tasks complete. Ready for human review before deploy.",
          ),
        );
        console.log(
          c.dim("  Review the changes and approve the deployment when ready."),
        );
      }

      // Save final metrics
      metrics.endTime = new Date().toISOString();
      updateMetricsSummary(metrics, cumulative, attempt, updatedTasks);
      await saveMetrics(workingDirectory, metrics, fs);
      console.log(
        c.dim(
          `\n  Metrics saved to ${path.join(workingDirectory, "metrics.json")}`,
        ),
      );

      await exitSuccess();
      return;
    }

    if (response.result.includes("<promise>success</promise>")) {
      console.log(c.green(`  ✓ Task ${index + 1} completed locally!`));
      iterationMetric.outcome = "success-local";

      // Mark task complete (locally verified, CI verification pending)
      const ciVerified = !ciConfig.requireGreenBeforeComplete;
      const updatedTasks = markTaskComplete(tasks, index, ciVerified);
      try {
        await saveTasks(workingDirectory, updatedTasks, fs);
        console.log(c.dim("  ✓ tasks.json updated"));
      } catch (error) {
        throw new CommandError(
          `Failed to save tasks.json: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      // ─── Review Gate: run whenever enabled; commit always documents iteration; push only if gate passes ───
      let gatePassedForPush = true;
      let gateRan = false;
      if (reviewGateConfig.enabled) {
        gateRan = true;
        const gateStarted = Date.now();
        const gateResult = await runReviewGate(
          workingDirectory,
          reviewGateConfig,
        );
        stepTimings.reviewGateMs = Date.now() - gateStarted;
        if (iterationMetric.stepTimings) {
          iterationMetric.stepTimings.reviewGateMs = stepTimings.reviewGateMs;
        }
        absorbReviewGateOutcome(gateResult);
        gatePassedForPush = gateResult.passed;

        if (!gateResult.passed) {
          console.log(
            c.yellow(
              "  ⚠️  Review Gate failed — recording local commit only (no push). Build Agent will fix next iteration.",
            ),
          );
          // Capture the full Review Gate feedback so the Build Agent gets detailed
          // context (lint errors, test failures, timeout output) in the next iteration.
          reviewGateFeedback = buildReviewGateFeedback(gateResult);
          iterationMetric.outcome = "review-gate-failed";
        }
      }

      const commitDesc = extractCommitDescription(response.result)?.trim();
      const bodyParts: string[] = [];
      if (commitDesc) {
        bodyParts.push(commitDesc);
      }
      if (gateRan) {
        bodyParts.push(
          `Review gate: ${gatePassedForPush ? "passed" : "did not pass"} before this commit.`,
        );
      }
      const featBody =
        bodyParts.length > 0 ? bodyParts.join("\n\n") : undefined;
      const featSubject = `feat: complete task ${index + 1} - ${task.description}`;

      const hadWorkBeforeFeatCommit = hasUncommittedChanges(workingDirectory);
      let featCommitted = false;
      if (hadWorkBeforeFeatCommit) {
        console.log(c.dim("  📝 Recording task completion as local commit..."));
        featCommitted = gitCommit(
          workingDirectory,
          featSubject,
          getCoAuthor(config, lastKnownModel),
          featBody,
        );
        if (!featCommitted) {
          console.log(
            c.yellow(
              "  ⚠️  Could not create local commit for this iteration (see git output above).",
            ),
          );
        }
      }

      // Check remaining tasks before deciding push — epilogue unlocks on last gate-green task.
      const remainingTasksAfterSuccess = updatedTasks.filter(
        (t) => t.passes !== true,
      );
      const allTasksLocallyComplete = remainingTasksAfterSuccess.length === 0;
      if (
        allTasksLocallyComplete &&
        gatePassedForPush &&
        resolveGitPushMode(gitConfig) === "epilogue"
      ) {
        if (!epilogueUnlocked) {
          console.log(
            c.green(
              "  📤 Epilogue: all tasks passed Review Gate — unlocking remote push…",
            ),
          );
        }
        epilogueUnlocked = true;
      }

      if (
        gatePassedForPush &&
        shouldPushToRemote(gitConfig, epilogueUnlocked) &&
        gitConfig.pushOnLocalSuccess &&
        (!hadWorkBeforeFeatCommit || featCommitted)
      ) {
        console.log(
          c.green(
            resolveGitPushMode(gitConfig) === "epilogue"
              ? "  📤 Epilogue push — triggering CI verification…"
              : "  📤 Review Gate passed — pushing to trigger CI verification…",
          ),
        );
        gitPush(workingDirectory);
        ciCache.recordPush();
        pushedThisIteration = true;
        console.log(c.green("  ✓ Changes pushed (CI will verify)"));
        await tryCreatePR();
      } else if (
        gatePassedForPush &&
        resolveGitPushMode(gitConfig) === "epilogue" &&
        !epilogueUnlocked
      ) {
        console.log(
          c.dim(
            "  ⏸️  Epilogue mode: local commit only (push deferred until all tasks pass Review Gate).",
          ),
        );
      } else if (
        !gatePassedForPush &&
        gitConfig.autoPush &&
        gitConfig.pushOnLocalSuccess
      ) {
        console.log(c.dim("  ⏸️  Not pushing (review gate did not pass)."));
      }

      // Check if all tasks are now complete
      const remainingTasks = remainingTasksAfterSuccess;
      const isLastTask =
        remainingTasks.length === 0 && !ciConfig.requireGreenBeforeComplete;

      if (isLastTask && gatePassedForPush) {
        console.log(c.green("\n  ✓ All tasks completed!"));

        if (ciConfig.approvalGateEnabled) {
          console.log(
            c.yellow(
              "\n  🚦 APPROVAL GATE: All tasks complete. Ready for human review before deploy.",
            ),
          );
        }

        metrics.iterations.push(iterationMetric);
        metrics.endTime = new Date().toISOString();
        updateMetricsSummary(metrics, cumulative, attempt, updatedTasks);
        await saveMetrics(workingDirectory, metrics, fs);
        console.log(
          c.dim(
            `\n  Metrics saved to ${path.join(workingDirectory, "metrics.json")}`,
          ),
        );
        await exitSuccess();
        return;
      }
    } else if (response.result.includes("<promise>ci-pending</promise>")) {
      console.log(
        c.cyan("  ⏳ CI verification pending — waiting for pipeline results"),
      );
      iterationMetric.outcome = "ci-pending";
    } else if (
      response.result.includes("<promise>ci-fix-attempted</promise>")
    ) {
      console.log(c.yellow("  🔧 CI fix attempted by Build Agent"));
      iterationMetric.outcome = "ci-fix-attempted";

      // Run Review Gate on the fix; commit always documents iteration; push only if gate passes
      let gatePassedForCIFix = true;
      let gateRanForCIFix = false;
      if (reviewGateConfig.enabled) {
        gateRanForCIFix = true;
        const gateResult = await runReviewGate(
          workingDirectory,
          reviewGateConfig,
        );
        absorbReviewGateOutcome(gateResult);
        gatePassedForCIFix = gateResult.passed;
      }

      const buildFixSummary = extractCommitSummary(response.result);
      const buildFixMsg = buildFixSummary
        ? `fix(ci): ${buildFixSummary}`
        : `fix(ci): address failure for task ${index + 1} - ${task.description}`;
      const buildFixDesc = extractCommitDescription(response.result)?.trim();
      const ciFixBodyParts: string[] = [];
      if (buildFixDesc) {
        ciFixBodyParts.push(buildFixDesc);
      }
      if (gateRanForCIFix) {
        ciFixBodyParts.push(
          `Review gate: ${gatePassedForCIFix ? "passed" : "did not pass"} before this commit.`,
        );
      }
      const buildFixBody =
        ciFixBodyParts.length > 0 ? ciFixBodyParts.join("\n\n") : undefined;

      const hadWorkBeforeCiFixCommit = hasUncommittedChanges(workingDirectory);
      let ciFixCommitted = false;
      if (hadWorkBeforeCiFixCommit) {
        console.log(
          c.dim("  📝 Recording Build Agent CI fix attempt as local commit..."),
        );
        ciFixCommitted = gitCommit(
          workingDirectory,
          buildFixMsg,
          getCoAuthor(config, lastKnownModel),
          buildFixBody,
        );
        if (!ciFixCommitted) {
          console.log(
            c.yellow(
              "  ⚠️  Could not create local commit for CI fix (see git output above).",
            ),
          );
        }
      }

      if (
        gatePassedForCIFix &&
        shouldPushToRemote(gitConfig, epilogueUnlocked) &&
        gitConfig.pushOnLocalSuccess &&
        (!hadWorkBeforeCiFixCommit || ciFixCommitted)
      ) {
        console.log(c.dim("  📤 Pushing CI fix for verification…"));
        gitPush(workingDirectory);
        ciCache.recordPush();
        pushedThisIteration = true;
        console.log(c.green("  ✓ CI fix pushed"));
        await tryCreatePR();
      } else if (
        gatePassedForCIFix &&
        resolveGitPushMode(gitConfig) === "epilogue" &&
        !epilogueUnlocked
      ) {
        console.log(
          c.dim(
            "  ⏸️  Epilogue mode: CI fix committed locally (push deferred until all tasks pass).",
          ),
        );
      } else if (
        !gatePassedForCIFix &&
        gitConfig.autoPush &&
        gitConfig.pushOnLocalSuccess
      ) {
        console.log(c.dim("  ⏸️  Not pushing (review gate did not pass)."));
      }
    } else if (response.result.includes("<promise>needs-human</promise>")) {
      if (afkMode) {
        console.log(
          c.yellow(
            "\n  ⚠️  Build Agent signaled needs-human — AFK mode ignores pause; continuing.",
          ),
        );
        iterationMetric.outcome = "needs-human-afk-ignored";
        reviewGateFeedback =
          "AFK mode: this is an unattended run. Do not signal needs-human. Keep working the current task and end with <promise>success</promise> or <promise>ci-fix-attempted</promise>.";
      } else {
        console.log(c.yellow("\n  ⚠️  Build Agent requests human assistance!"));
        console.log(c.dim("  Review activity.md for details on the issue."));
        iterationMetric.outcome = "needs-human";

        // Save metrics before pausing
        metrics.iterations.push(iterationMetric);
        metrics.endTime = new Date().toISOString();
        const currentTasks = await loadTasks(workingDirectory, fs);
        updateMetricsSummary(metrics, cumulative, attempt, currentTasks);
        await saveMetrics(workingDirectory, metrics, fs);
        console.log(
          c.dim(
            `\n  Metrics saved to ${path.join(workingDirectory, "metrics.json")}`,
          ),
        );

        console.log(
          c.dim(
            "\n  Loop paused. Address the issue and run again to continue.",
          ),
        );
        process.exit(2);
        return;
      }
    } else {
      console.log(
        c.dim(`  ⟳ Task ${index + 1} in progress (iterating locally, no push)`),
      );
      iterationMetric.outcome = "in-progress";

      if (!hasOrchestratorCompletionTag(response.result)) {
        if (
          missingPromiseStreak !== null &&
          missingPromiseStreak.index === index
        ) {
          missingPromiseStreak.count++;
        } else {
          missingPromiseStreak = { index, count: 1 };
        }

        if (missingPromiseStreak.count >= MISSING_PROMISE_TAG_STREAK_EXIT) {
          iterationMetric.outcome = "missing-promise-streak";
          metrics.iterations.push(iterationMetric);
          metrics.endTime = new Date().toISOString();
          const currentTasks = await loadTasks(workingDirectory, fs);
          updateMetricsSummary(metrics, cumulative, attempt, currentTasks);
          await saveMetrics(workingDirectory, metrics, fs);
          console.log(
            c.red(
              `\n  ✗ Stopping: ${missingPromiseStreak.count} consecutive Build Agent responses without a recognized <promise> tag on task ${index + 1}.`,
            ),
          );
          console.log(
            c.dim(
              "  Fix the agent prompt or runner output, then re-run. See metrics.json for this iteration.",
            ),
          );
          process.exit(1);
        }

        const tagReminder = buildMissingPromiseTagReminder(
          index + 1,
          missingPromiseStreak.count,
          { afk: afkMode },
        );
        reviewGateFeedback = reviewGateFeedback
          ? `${tagReminder}\n\n---\n\n${reviewGateFeedback}`
          : tagReminder;

        if (
          missingPromiseStreak.count === 3 ||
          missingPromiseStreak.count === 6 ||
          missingPromiseStreak.count === 9
        ) {
          console.log(
            c.yellow(
              `  ⚠️  No <promise> tag (${missingPromiseStreak.count}× on task ${index + 1}) — reminder injected; ${MISSING_PROMISE_TAG_STREAK_EXIT - missingPromiseStreak.count} more and the loop exits.`,
            ),
          );
        }
      }
    }

    // ─── Post-iteration: poll after push or when CI was already running ───
    if (
      shouldPollCIAfterIteration({
        ciEnabled: ciConfig.enabled,
        pushedThisIteration,
        ciWasRunningAtStart,
      })
    ) {
      const pollReason = pushedThisIteration
        ? "after push"
        : "CI was running at iteration start";
      console.log(c.dim(`  ⏳ Polling for CI result (${pollReason})...`));
      const pollStarted = Date.now();
      const settled = await pollPrefetchCIStatus(
        workingDirectory,
        ciConfig.maxCIWaitSeconds * 1000,
        verbose,
        ciDoctorConfig,
      );
      stepTimings.ciPollMs = Date.now() - pollStarted;
      if (iterationMetric.stepTimings) {
        iterationMetric.stepTimings.ciPollMs = stepTimings.ciPollMs;
      }
      if (settled) {
        applyInjectedCIToIterationMetric(iterationMetric, settled);
        if (pushedThisIteration) {
          iterationMetric.ciQueriesMade = Math.max(
            iterationMetric.ciQueriesMade,
            1,
          );
        }
        ciCache.cacheResult(settled);
        maybeMarkFirstCIGreen(metrics, settled);
        if (pushedThisIteration) {
          if (resolveGitPushMode(gitConfig) === "epilogue") {
            epilogueRemotePushCount += 1;
          }
          recordCIPushOutcome(metrics, gitConfig, settled, {
            isFirstEpiloguePush:
              resolveGitPushMode(gitConfig) === "epilogue" &&
              epilogueRemotePushCount === 1,
          });
        }
        if (settled.status.status === "success") {
          console.log(c.green("  ✅ CI pipeline settled: PASSING"));
        } else if (settled.status.status === "failed") {
          console.log(
            c.red("  ❌ CI pipeline settled: FAILED") +
              c.dim(" — CI Doctor will address next iteration"),
          );
        } else if (settled.status.status === "running") {
          console.log(
            c.dim(
              `  ⏳ CI still running after ${ciConfig.maxCIWaitSeconds}s — will check next iteration`,
            ),
          );
        }
      }
    }

    metrics.iterations.push(iterationMetric);

    // Periodic metrics save (update summary before saving)
    if (attempt % 5 === 0) {
      const currentTasks = await loadTasks(workingDirectory, fs);
      updateMetricsSummary(metrics, cumulative, attempt, currentTasks);
      await saveMetrics(workingDirectory, metrics, fs);
    }
  }

  // Max iterations reached without completing all tasks
  const finalTasks = await loadTasks(workingDirectory, fs);
  const remaining = finalTasks.filter((t) => t.passes !== true).length;

  // Save final metrics
  metrics.endTime = new Date().toISOString();
  updateMetricsSummary(metrics, cumulative, maxIterations, finalTasks);
  await saveMetrics(workingDirectory, metrics, fs);

  console.log(
    c.red(
      `\n  ✗ Maximum iterations (${maxIterations}) reached with ${remaining} task(s) still incomplete.`,
    ),
  );
  console.log(
    c.dim(`  Metrics saved to ${path.join(workingDirectory, "metrics.json")}`),
  );
  process.exit(1);
  return;
}
