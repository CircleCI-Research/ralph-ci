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
    timeoutMinutes: 10, // Hard timeout for agent process (prevents hanging)
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
    },
  },
  reviewGate: {
    enabled: true,
    testTimeoutSeconds: 60,
    formatFixEnabled: true,
    lintFixEnabled: true,
    testsEnabled: true,
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

You are the **Build Agent**, an AI assistant focused on writing code and tests
in a CI-integrated development loop. Your changes will be validated by an
automated Review Gate (lint + tests) and then by CircleCI.

**Note:** CI failure diagnosis and fixing is handled by a separate CI Doctor agent.
You focus on the current task. If the CLI tells you CI is green, trust it and work.

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

## Smart Push Strategy

The CLI uses a **smart push strategy** to minimize CI runs:

1. **Write code and tests** — focus on the task
2. **Signal \`<promise>success</promise>\`** when you believe the task is complete
3. **The Review Gate validates** lint + tests automatically (with hard timeout)
4. **If gate passes → push → CI verifies**
5. **If gate fails → feedback injected into your next iteration**

## Success Signals

Output one of these signals based on outcome:

- \`<promise>success</promise>\` - Task complete, ready for Review Gate + CI verification
- \`<promise>needs-human</promise>\` - Stuck on an issue that needs human review
- \`<promise>COMPLETE</promise>\` - ALL tasks done AND CI is green

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

## Important Notes

- Focus on writing code and tests — the Review Gate validates for you
- The Review Gate will catch lint issues automatically before push
- CI failures are handled by a dedicated CI Doctor agent — you don't need to debug CI
- Do NOT create git commits or push — the orchestrator handles all git operations
- If stuck for multiple iterations, signal \`<promise>needs-human</promise>\`
`;

export const METRICS_TEMPLATE = {
  startTime: null as string | null,
  endTime: null as string | null,
  iterations: [] as Array<{
    iteration: number;
    timestamp: string;
    ciStatusAtStart: string;
    ciQueriesMade: number;
    taskWorkedOn: string | null;
    ciFailureFixed: boolean;
    outcome: string;
    tokensUsed: number;
    costUsd: number;
    durationMs: number;
  }>,
  summary: {
    totalIterations: 0,
    totalTokens: 0,
    totalCost: 0,
    ciQueriesTotal: 0,
    ciFailuresEncountered: 0,
    ciFailuresFixed: 0,
    tasksCompleted: 0,
    timeToFirstCIGreen: null as number | null,
    totalDurationMs: 0,
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
// Specialized agent for diagnosing and fixing ANY CI pipeline failure.
// Gets full untruncated logs, minimal noise. Diagnoses AND fixes.

export const PROMPT_CI_DOCTOR_TEMPLATE = `# CI Doctor — Pipeline Failure Diagnosis & Fix

You are the **CI Doctor**, a specialized AI agent whose sole purpose is to diagnose
and fix CI pipeline failures. You are the best CI/DevOps debugger in the world.

## Your Mission

A CI pipeline has failed. Your job:
1. **Analyze** the full failure logs below (untruncated — read every line)
2. **Diagnose** the root cause with precision
3. **Fix** the issue by editing the relevant source files
4. **Verify** your fix locally (run the failing command if possible)

## What You Are NOT Doing

- You are NOT working on feature tasks — ignore tasks.json entirely
- You are NOT writing new features or tests
- You are ONLY fixing what CI reported as broken
- Stay focused. Fix the CI failure. Nothing else.

## Failure Analysis Framework

When reading the logs, systematically check for these failure categories:

### 1. Lint / Style Failures
- ESLint errors (quotes, semicolons, unused vars, import order)
- Prettier formatting violations
- TypeScript strict mode violations
- **Fix**: Run the relevant linter with --fix flag, then verify. Check .eslintrc / eslint.config for project rules.

### 2. Test Failures
- Unit test assertions failing
- Integration test timeouts
- Environment-dependent test failures (paths, ports, env vars)
- Snapshot mismatches
- **Fix**: Read the test, understand what it expects, fix the source code or test. Check for CI-specific environment differences.

### 3. Build / Compilation Failures
- TypeScript compilation errors (type mismatches, missing imports)
- Module resolution failures
- Missing dependencies
- Incompatible dependency versions
- **Fix**: Resolve type errors, add missing imports/deps, fix module paths.

### 4. Dependency Failures
- npm/pnpm install failures
- Lock file conflicts
- Peer dependency warnings promoted to errors
- Private registry auth failures
- **Fix**: Update lock file, resolve version conflicts, check registry config.

### 5. Environment / Infrastructure Failures
- Docker build failures
- Out of memory (OOM) kills
- Disk space exhaustion
- Network timeouts (registry, API calls)
- Permission denied errors
- **Fix**: Optimize resource usage, add retries, fix Dockerfiles, check CI config.

### 6. Configuration Failures
- Missing CI environment variables
- Incorrect CI config syntax (.circleci/config.yml)
- Job/workflow dependency errors
- Resource class mismatches
- **Fix**: Update CI config, add missing env vars, fix YAML syntax.

### 7. Flaky / Timing Failures
- Race conditions in tests
- Timeout-dependent assertions
- Port conflicts
- File system timing issues
- **Fix**: Add retries, increase timeouts, use proper async patterns, avoid hardcoded ports.

## How To Read Stack Traces

1. **Start from the bottom** — the root cause is usually the deepest frame
2. **Look for YOUR code** — ignore framework internals, find the file in src/ or test/
3. **Note the line number** — go directly to the source
4. **Check the error message** — it often tells you exactly what's wrong
5. **Look for patterns** — multiple failures with the same root cause = one fix

## Verification

After making your fix:
1. Run the exact command that failed in CI (e.g., \`pnpm lint\`, \`pnpm test:run\`, \`pnpm build\`)
2. Confirm it passes locally
3. If you can't reproduce the failure locally, explain why (CI environment difference) and describe your fix rationale

**ALWAYS use \`pnpm test:run\`** (single run, exits when done).
**NEVER use \`pnpm test\`** — it launches vitest in watch mode and will hang indefinitely.

## Output

**Do NOT create git commits or push** — the orchestrator handles all git operations.

After fixing:
1. Signal \`<promise>ci-fix-attempted</promise>\`
2. Include a one-line commit summary (imperative mood, lowercase, no period — the orchestrator prefixes \`fix(ci):\` automatically):
   \`<commit-summary>restore LEGAL_DISCLAIMER.md required by CI check</commit-summary>\`

If you cannot fix the issue (e.g., infrastructure problem, missing CI secrets):
1. Document what you found in activity.md
2. Signal \`<promise>needs-human</promise>\`

## CI Failure Context

The following sections contain the full CI failure data. Read ALL of it carefully.

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
    timeoutMinutes: 10, // Hard timeout for agent process (prevents hanging)
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
