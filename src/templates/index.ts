export const CLAUDE_SETTINGS_TEMPLATE = {
  mcpServers: {
    filesystem: {
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-filesystem", process.cwd()],
    },
  },
};

export const MCP_SETTINGS_TEMPLATE = {
  mcpServers: {
    filesystem: {
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-filesystem", process.cwd()],
    },
  },
};

export const CONFIG_TEMPLATE = {
  runner: "claude",
};

export const ACTIVITY_TEMPLATE = `# Project Build - Activity Log

## Current Status
**Last Updated:** ${new Date().toISOString().split("T")[0]}
**Tasks Completed:** 0
**Current Task:** Ready to begin

---

## Session Log

Add dated entries here as you complete tasks. Include:
- Task name and description
- Changes made
- Testing and verification results
- Dependencies installed and why
- Any problems encountered and lessons learned
`;

export const PLAN_TEMPLATE = `# Project Plan

## Project Overview

[Describe your project here]

---

## Task List

IMPORTANT: Only work on one task! Exit the session after finishing a single task!

\`\`\`json
[
  {
    "category": "setup",
    "description": "Example task",
    "steps": [
      "First step",
      "Second step",
      "Third step"
    ],
    "passes": false
  }
]
\`\`\`
`;

export const PROMPT_TEMPLATE = `@plan.md @activity.md

## Instructions

1. Read activity.md to understand current state and what was recently accomplished.
2. Study plan.md thoroughly.
3. Open plan.md and find the next highest leverage task with "passes": false
4. Work on exactly ONE task: complete all steps for that task. Important: ONLY WORK ON A SINGLE TASK.
5. Verify the task is working.
6. Update the activity log.
7. Update that task's passes value in plan.md from false to true. Important: Only modify the passes field. Do not remove or rewrite tasks.
8. Do NOT create git commits or push — the orchestrator handles all git operations.

## Activity Log

After completing a task, append a dated progress entry to activity.md describing what you changed, and the result of verifying the task is working.

If any problems or mistakes are discovered, append a dated entry to activity.md describing what happened, and what should be avoided in the future.

Make note of any dependencies that were installed, and why.

## Task Verification

After implementing, run the cli and/or the tests to verify.

**ALWAYS use \`pnpm test:run\`** (single run, exits when done).
**NEVER use \`pnpm test\`** — it launches vitest in watch mode, which will hang indefinitely waiting for file changes and block the entire iteration.

## Dependencies

Reduce dependencies when possible. Use only well known dependencies.

## Output Directory

**IMPORTANT**: All source code and implementation files MUST be created in the \`src/\` folder.
The workflow files (activity.md, plan.md, tasks.json, etc.) stay at the root level.

## Plan Completion Criteria Output

IMPORTANT: When ALL tasks have passes true, output <promise>COMPLETE</promise>
`;

// JSON-workflow templates (for scaffold-json command)

export const PLAN_DETAILS_TEMPLATE = `# Project Plan

## Project Overview

[Describe your project here]

## File Structure

All source code and output files should be created in the \`src/\` folder:

\`\`\`
[working-directory]/
├── activity.md      # Activity log
├── plan.md          # This file
├── tasks.json       # Task list (managed by CLI)
├── prompt.md        # Agent instructions
├── ralphci.json     # Configuration
├── screenshots/     # Screenshots
└── src/             # Source code and output files
    ├── ...          # Your implementation files go here
    └── README.md    # (optional) Project-specific docs
\`\`\`

## Additional Context

[Add any design decisions, architectural notes, or other relevant details here]
`;

export const TASKS_JSON_TEMPLATE = [
  {
    category: "setup",
    description: "Example task",
    steps: ["First step", "Second step", "Third step"],
    passes: false,
  },
];

export const PROMPT_JSON_TEMPLATE = `@plan.md @activity.md @tasks.json

## Instructions

1. Read activity.md to understand current state and what was recently accomplished.
2. Study plan.md for project context and details.
3. Review tasks.json - the CLI will provide you with a single task to work on below.
4. Work on exactly ONE task: complete all steps for that task. Important: ONLY WORK ON A SINGLE TASK.
5. Verify the task is working by running tests and/or the CLI.
6. Update activity.md with a dated entry describing your changes and verification results.
7. Do NOT create git commits or push — the orchestrator handles all git operations.
8. Output <promise>success</promise> if and only if the task is fully complete and verified.

IMPORTANT: Do NOT edit tasks.json directly. The CLI manages task completion status.

## Current Task

The CLI will insert the current task details here when invoking the agent.

## Activity Log

After completing a task, append a dated progress entry to activity.md describing what you changed, and the result of verifying the task is working.

If any problems or mistakes are discovered, append a dated entry to activity.md describing what happened, and what should be avoided in the future.

Make note of any dependencies that were installed, and why.

## Task Verification

After implementing, run the cli and/or the tests to verify the implementation works correctly.

## Dependencies

Reduce dependencies when possible. Use only well known dependencies.

## Output Directory

**IMPORTANT**: All source code and implementation files MUST be created in the \`src/\` folder.
The workflow files (activity.md, plan.md, tasks.json, etc.) stay at the root level.

## Running Tests

**ALWAYS use \`pnpm test:run\`** (single run, exits when done).
**NEVER use \`pnpm test\`** — it launches vitest in watch mode, which will hang indefinitely waiting for file changes and block the entire iteration.

## Success Criteria

Output <promise>success</promise> ONLY when:
- All steps for the current task are complete
- The implementation has been tested and verified to work
- The activity log has been updated
`;

// CI-aware workflow templates (for scaffold-ci command)

export const ACTIVITY_CI_TEMPLATE = `# Project Build - Activity Log

## Current Status
**Last Updated:** ${new Date().toISOString().split("T")[0]}
**Tasks Completed:** 0
**Current Task:** Ready to begin
**CI Status:** Not yet checked

---

## CI Status Log

Record CI pipeline status at the start of each iteration here.

---

## Session Log

Add dated entries here as you complete tasks. Include:
- CI status at start of iteration
- Task name and description
- Changes made
- Testing and verification results (local AND CI)
- Dependencies installed and why
- Any problems encountered and lessons learned
`;

export const CONFIG_CI_TEMPLATE = {
  runner: "claude",
  buildAgent: {
    timeoutMinutes: 30, // Hard timeout for agent process (prevents hanging)
    verbose: true, // Stream turn-by-turn output for visibility
  },
  git: {
    autoPush: true,
    pushOnLocalSuccess: true, // Smart push: only push when local tests pass
  },
  ci: {
    enabled: true,
    provider: "circleci",
    waitForCI: true,
    maxCIWaitSeconds: 300,
    requireGreenBeforeComplete: true,
    approvalGateEnabled: true,
    branchStrategy: "feature-branch",
    doctor: {
      enabled: true,
      maxLogLength: 0, // 0 = unlimited — CI Doctor gets full untruncated logs
      logMode: "full",
    },
  },
  reviewGate: {
    enabled: true,
    testTimeoutSeconds: 60,
    formatFixEnabled: true,
    lintFixEnabled: true,
    testsEnabled: true,
    // Optional: CircleCI Chunk sidecar remote microbuilds after local lint/tests
    // chunkSidecar: { enabled: true, strictCli: true },
  },
};

export const TASKS_CI_JSON_TEMPLATE = [
  {
    category: "setup",
    description: "Example task with CI verification",
    steps: [
      "First step",
      "Second step",
      "Third step",
      "Verify locally: run tests",
      "Push and verify CI passes",
    ],
    passes: false,
    ciVerified: false,
  },
];

export const PROMPT_CI_TEMPLATE = `@plan.md @activity.md @tasks.json

# Build Agent — CI-Aware Development Loop

You write code and tests. The Review Gate validates (lint/tests, optional Chunk sidecar);
CircleCI runs on push. **CI Doctor** fixes pipeline failures — you focus on the current task.

## Instructions

1. Read recent activity and plan.md for context
2. Complete exactly ONE task from the CLI section below
3. Write code and tests; append a dated entry to activity.md
4. Do **not** edit tasks.json, commit, or push — the orchestrator handles git

## Current Task

The CLI will insert the current task details here when invoking the agent.

## DO NOT Run Tests Yourself

The Review Gate runs validation after you signal success. **Never** run \`pnpm test\` (watch mode hangs)
or \`pnpm test:run\` — the gate runs tests with a timeout. Fix injected Review Gate errors on retry.

## Success Signals

- \`<promise>success</promise>\` — task complete (Review Gate + CI next)
- \`<promise>needs-human</promise>\` — blocked on human-only issue
- \`<promise>COMPLETE</promise>\` — all tasks done and CI green

Include \`<commit-description>\`…\`</commit-description>\` with bullet points when signaling success.

## Output

Source code lives under \`src/\`. Workflow files (activity.md, plan.md, tasks.json) stay at workspace root.
`;

export const METRICS_TEMPLATE = {
  startTime: null as string | null,
  endTime: null as string | null,
  iterations: [] as Array<{
    iteration: number;
    timestamp: string;
    agentRole: "build" | "ci-doctor" | "smart-select";
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
  }>,
  summary: {
    totalIterations: 0,
    totalTokens: 0,
    totalTokensIn: 0,
    totalTokensOut: 0,
    diagnosisTokens: 0,
    codegenTokens: 0,
    totalCost: 0,
    ciQueriesTotal: 0,
    ciFailuresEncountered: 0,
    ciFailuresFixed: 0,
    tasksCompleted: 0,
    timeToFirstCIGreen: null as number | null,
    totalDurationMs: 0,
    pipelineRuns: 0,
    totalPipelineDurationMs: 0,
    totalEstimatedCredits: null as number | null,
    innerLoopMode: null as "local+sidecar" | "sidecar-only" | null,
    ciPushesTotal: 0,
    ciPushesGreen: 0,
    everyCommitGreenRate: null as number | null,
    firstPushGreen: null as boolean | null,
  },
};

// No-CI workflow template (for --no-ci flag)
// Same structure as CI template but without CircleCI-specific instructions
export const PROMPT_NO_CI_TEMPLATE = `@plan.md @activity.md @tasks.json

# Development Loop (Local-Only Mode)

You are an AI assistant working in a local development loop.
CI integration is disabled - focus on local testing and verification.

## Instructions

1. Read activity.md to understand current state and recent work
2. Study plan.md for project context and details
3. Review the current task provided by the CLI below
4. Work on exactly ONE task: complete all steps
5. Write code AND tests for the task
6. Update activity.md with your changes

**Do NOT create git commits or push** — the orchestrator handles all git operations.

IMPORTANT: Do NOT edit tasks.json directly. The CLI manages task completion status.

## Current Task

The CLI will insert the current task details here when invoking the agent.

## DO NOT Run Tests Yourself

**The automated Review Gate runs \`lint:fix\` and \`test:run\` for you after you finish.**
You do NOT need to run \`pnpm test\`, \`pnpm test:run\`, or any test command yourself.

If the Review Gate finds test failures or a timeout, the CLI will inject the full
error output into your next iteration so you can fix it. Focus on writing correct
code and tests — the Review Gate validates them with a hard timeout so nothing hangs.

**NEVER run \`pnpm test\`** — it launches vitest in watch mode and will hang your process.
**NEVER run \`pnpm test:run\`** — the Review Gate handles this with a proper timeout.

## Success Signals

Output one of these signals based on outcome:

- \`<promise>success</promise>\` - Task complete, ready for Review Gate validation
- \`<promise>needs-human</promise>\` - Stuck on an issue that needs human review
- \`<promise>COMPLETE</promise>\` - ALL tasks done

When signaling \`<promise>success</promise>\`, also include a detailed commit description
summarizing the changes you made. This becomes the git commit body. Use bullet points
for individual changes:

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

## Activity Log Format

Each entry should include:
1. Task description
2. Work performed
3. Outcome

Example entry:
\`\`\`
## 2026-01-30 - Iteration 3

### Work Performed
- Implemented user authentication endpoint
- Added JWT token validation
- Created unit tests for auth module

### Outcome
- Task complete — orchestrator will commit and push
\`\`\`

## Dependencies

Reduce dependencies when possible. Use only well known dependencies.

## Output Directory

**IMPORTANT**: All source code and implementation files MUST be created in the \`src/\` folder.
The workflow files (activity.md, plan.md, tasks.json, etc.) stay at the root level.

Example:
- \`src/index.html\` - Your HTML files
- \`src/style.css\` - Your CSS files
- \`src/app.js\` - Your JavaScript files
- \`src/README.md\` - Project-specific documentation

## Important Notes

- Focus on writing code and tests — the Review Gate validates for you
- Each task should be a complete, reviewable unit of work
- Do NOT create git commits or push — the orchestrator handles all git operations
`;

// ─── CI Doctor Agent Template ───
// Slim prompt: failure logs carry detail; doctor fixes only what CI/sidecar reported.

export const PROMPT_CI_DOCTOR_TEMPLATE = `# CI Doctor — Fix CI Failure

Fix the reported **CircleCI pipeline** or **Chunk sidecar** failure only. Ignore tasks.json and feature work.

1. Read the failure data below (pre-shaped when noted).
2. Edit source/config to fix the root cause.
3. Do **not** commit or push — the orchestrator handles git.

## Signals

- Fixed: \`<promise>ci-fix-attempted</promise>\` plus:
  - \`<commit-summary>one-line imperative summary</commit-summary>\`
  - \`<commit-description>what failed, root cause, what you changed</commit-description>\`
- Unfixable (infra/secrets): note in activity.md, then \`<promise>needs-human</promise>\`

Commit prefix: \`fix(ci):\` for CircleCI job failures; \`fix(ci-sidecar):\` for Chunk sidecar only.

## CI Failure Context

`;

/** Extra guidance when logs are pre-shaped failure reports (not raw job output). */
export const PROMPT_CI_DOCTOR_FAILURE_REPORT_NOTE = `Failure data below is a **pre-shaped report** — fix the cited errors; do not re-summarize the entire log.

`;

/** When Review Gate uses sidecar-only, local test runs are redundant. */
export const PROMPT_CI_DOCTOR_SIDECAR_ONLY_NOTE = `Inner loop is **sidecar-only** — do not run full \`pnpm test:run\` locally; fix what the log cites. Review Gate re-validates.

`;

// Activity template for no-CI mode (simplified)
export const ACTIVITY_NO_CI_TEMPLATE = `# Project Build - Activity Log

## Current Status
**Last Updated:** ${new Date().toISOString().split("T")[0]}
**Tasks Completed:** 0
**Current Task:** Ready to begin

---

## Session Log

Add dated entries here as you complete tasks. Include:
- Task name and description
- Changes made
- Testing and verification results
- Dependencies installed and why
- Any problems encountered and lessons learned
`;

// Tasks template for no-CI mode (without ciVerified field)
export const TASKS_NO_CI_JSON_TEMPLATE = [
  {
    category: "setup",
    description: "Example task",
    steps: [
      "First step",
      "Second step",
      "Third step",
      "Verify locally: run tests",
    ],
    passes: false,
  },
];

// Config template for no-CI mode
export const CONFIG_NO_CI_TEMPLATE = {
  runner: "claude",
  buildAgent: {
    timeoutMinutes: 30, // Hard timeout for agent process (prevents hanging)
    verbose: true, // Stream turn-by-turn output for visibility
  },
  git: {
    autoPush: false,
    pushOnLocalSuccess: false,
  },
  ci: {
    enabled: false,
    provider: "none",
    waitForCI: false,
    maxCIWaitSeconds: 0,
    requireGreenBeforeComplete: false,
    approvalGateEnabled: false,
    branchStrategy: "feature-branch" as const,
    doctor: {
      enabled: false, // No CI = no CI Doctor
    },
  },
  reviewGate: {
    enabled: true, // Review Gate is useful even without CI (catches lint issues)
    testTimeoutSeconds: 60,
    formatFixEnabled: true,
    lintFixEnabled: true,
    testsEnabled: true,
  },
};
