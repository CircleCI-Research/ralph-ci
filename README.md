<div align="center">
  <img width="2816" height="1536" alt="RalphCI-4__Gemini_Generated_Image_2hfqkv2hfqkv2hfq" src="https://github.com/user-attachments/assets/469e9d40-101c-48cc-a03b-7a38b9b000bc" />
</div>

# RalphCI (`ralphci`)

**Ship AI-generated code with speed and confidence — no prayers required.**

RalphCI is a CLI tool that closes the gap between "local tests pass" and "actually works in production" by integrating AI coding agents with your real CI pipeline.

```
Before RalphCI:  spec → agent iterates → local tests pass → ship and pray 🙏
With RalphCI:    spec → agent iterates → local tests pass → CI verifies → ship with confidence 🚀
```

## Why RalphCI?

Traditional AI coding loops have a blind spot: the agent declares victory when local tests pass, but your CI pipeline catches things local tests miss—environment issues, integration failures, race conditions, config drift.

**RalphCI fixes this:**

- **CLI pre-fetches CI status** at the start of each iteration and injects it into the agent's context
- CI failure logs are **automatically included** in the prompt when CI is red
- CI failures take **priority** over planned tasks (agent sees explicit instructions)
- Agent won't declare victory until the **real pipeline is green**
- Smart push strategy minimizes CI costs while maintaining verification

**Guaranteed CI Awareness**: Unlike prompt-only approaches that rely on the agent to fetch CI status, RalphCI's CLI orchestrates **specialized agents** — a Build Agent for coding, a CI Doctor for failure diagnosis (with full untruncated logs), and a deterministic Review Gate that catches lint/test issues before they ever reach CI.

The name comes from the "Ralph Loop" concept ([Ralph Wiggum](https://ghuntley.com/ralph/))—run an agent in a loop until tasks are complete. RalphCI extends this with CI awareness.

For controlled experiments on the same question (local green vs. pipeline green), see the CircleCI Loop Lab article [_We Let an AI Agent Say 'I Passed.' Was It Actually Good?_](https://loop.circleci.com/we-let-an-ai-agent-say-i-passed-was-it-actually-good).

## Quick Start

### Standard Workflow (CI Enabled by Default)

```bash
# 1. Clone and set up
git clone https://github.com/CircleCI-Research/ralph-ci.git
cd ralph-ci
pnpm install
pnpm link --global

# 2. Create a new project
mkdir my-project && cd my-project

# 3. Set up workflow files
ralphci scaffold

# 4. Edit your plan and tasks
# Edit plan.md - add project details and context
# Edit tasks.json - define your tasks array

# 5. Set up CircleCI token for CI status fetching
export CIRCLE_TOKEN="your-circleci-api-token"

# 6. Run the loop (CI enabled by default)
ralphci run -m 10

# 7. Monitor progress
cat activity.md    # Includes CI status per iteration
cat tasks.json     # See which tasks are complete AND CI-verified
cat metrics.json   # Experiment data (iterations, tokens, CI queries)
```

**What happens (with CI enabled):**

- **CI Status** checked at start of each iteration (cached — skips API when no push occurred)
- If CI is red → **CI Doctor** agent diagnoses + fixes failure (full untruncated logs)
- If CI is green → **Build Agent** works on task (lighter, focused prompt)
- **Review Gate** validates before every push: `lint:fix` + `test:run` (60s timeout — never hangs), optionally Chunk `validate --remote` after local checks
- **Smart push**: Only pushes when Review Gate passes (saves CI costs)
- Approval gate before deploy (configurable)

**Smart Push Strategy:**

```
Iteration 1: work → commit (no push) → local tests fail
Iteration 2: work → commit (no push) → local tests fail
Iteration 3: work → commit (no push) → local tests PASS → push → CI runs
```

Result: 3 iterations = 1 CI run (not 3). Saves time and CI costs.

**Configuration options:**

```bash
ralphci run -m 10                       # Default: 10 iterations, CI enabled, smart push, approval gate
ralphci run -m 10 --no-ci               # Disable CI integration (local-only workflow)
ralphci run --unlimited                 # No iteration limit (use with caution)
ralphci run --push-every-commit         # Chatty mode: push every commit (not recommended)
ralphci run --no-approval-gate          # Auto-deploy when CI green (full CD)
ralphci run --no-auto-push              # Manual git push only
ralphci run --no-require-green          # Don't require CI green before complete
ralphci run --branch-strategy direct-to-main  # Skip feature branches
ralphci run --no-draft-pr                     # Create PR as ready for review (not draft)
ralphci run -v                          # Verbose output for debugging
```

---

### Local-Only Workflow (CI Disabled)

For local development without CI integration:

```bash
# Set up workflow files for local-only mode
ralphci scaffold --no-ci

# Edit plan.md - add project details and context
# Edit tasks.json - define your tasks array

# Run the loop (CI disabled)
ralphci run --no-ci -m 10

# Monitor progress
cat activity.md
cat tasks.json
git log
```

---

### Legacy Workflows

<details>
<summary><strong>Markdown Workflow</strong> (Legacy)</summary>

```bash
# Set up Ralph loop files
ralphci scaffold-md

# Edit plan.md - define your tasks in JSON format
# Edit prompt.md - customize instructions (optional)

# Run the loop
ralphci run-md -m 10

# Monitor progress
cat activity.md
git log
```

</details>

<details>
<summary><strong>JSON Workflow</strong> (Legacy)</summary>

```bash
# Set up Ralph loop files for JSON workflow
ralphci scaffold-json

# Edit plan.md - add project details and context (no tasks)
# Edit tasks.json - define your tasks array
# Edit prompt.md - customize instructions (optional)

# Run the loop
ralphci run-json -m 10

# Monitor progress
cat activity.md
cat tasks.json  # See which tasks are complete
git log
```

</details>

## Prerequisites

- Node.js 18+
- **One of the following AI CLI tools:**
  - **Claude CLI** (default): `npm install -g @anthropic-ai/claude`
    - Requires Anthropic API key configured for Claude CLI
  - **Cursor CLI** (alternative): Install Cursor editor from [cursor.sh](https://cursor.sh)
    - The `agent` command is included with Cursor

## Configuration

Ralph supports multiple AI backends through a `ralphci.json` configuration file in your working directory.

### ralphci.json

Create a `ralphci.json` file in your project root or feature directory to configure the AI runner:

**Using Claude (default):**

```json
{
  "runner": "claude"
}
```

**Using Cursor:**

```json
{
  "runner": "cursor",
  "model": "composer-1"
}
```

**Configuration Options:**

| Field                                                  | Type                              | Default              | Description                                                                                                                                              |
| ------------------------------------------------------ | --------------------------------- | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `runner`                                               | `"claude"` \| `"cursor"`          | `"claude"`           | Which AI CLI to use                                                                                                                                      |
| `model`                                                | `string`                          | —                    | Model to use (e.g. `"claude-opus-4-6"` for Claude, `"composer-1"` for Cursor)                                                                            |
| `uniqueId`                                             | `string`                          | —                    | Unique ID for auto-branch and PR creation (see [Auto Branch & PR](#auto-branch--pr))                                                                     |
| `taskSelection`                                        | `"first-incomplete"` \| `"smart"` | `"first-incomplete"` | Task selection strategy                                                                                                                                  |
| `git.autoPush`                                         | `boolean`                         | `true`               | Auto-push commits to remote (independent of CI)                                                                                                          |
| `git.pushOnLocalSuccess`                               | `boolean`                         | `true`               | Only push when local tests pass (smart push)                                                                                                             |
| `git.baseBranch`                                       | `string`                          | —                    | Base branch for feature branches. `"current"` = branch at run start. Default: auto-detect `main`/`master`                                                |
| `reviewGate.enabled`                                   | `boolean`                         | `true`               | Enable pre-push quality gate (lint:fix + tests)                                                                                                          |
| `reviewGate.testTimeoutSeconds`                        | `number`                          | `60`                 | Hard timeout for test:run (prevents hanging)                                                                                                             |
| `reviewGate.lintFixEnabled`                            | `boolean`                         | `true`               | Auto-run lint:fix before push                                                                                                                            |
| `reviewGate.testsEnabled`                              | `boolean`                         | `true`               | Run tests as part of Review Gate                                                                                                                         |
| `reviewGate.chunkSidecar.enabled`                      | `boolean`                         | `false`              | After local format/lint/tests pass, run `chunk sidecar sync` and `chunk validate --remote` ([Chunk sidecars](https://circleci.com/blog/chunk-sidecars/)) |
| `reviewGate.chunkSidecar.strictCli`                    | `boolean`                         | `false`              | If true, Review Gate fails when the Chunk CLI is missing; if false, remote step is skipped with a log line                                               |
| `reviewGate.chunkSidecar.skipSync`                     | `boolean`                         | `false`              | Only run `chunk validate --remote` (no `chunk sidecar sync`)                                                                                             |
| `reviewGate.chunkSidecar.syncTimeoutSeconds`           | `number`                          | `180`                | Hard timeout for `chunk sidecar sync`                                                                                                                    |
| `reviewGate.chunkSidecar.remoteValidateTimeoutSeconds` | `number`                          | `120`                | Hard timeout for `chunk validate --remote`                                                                                                               |
| `reviewGate.chunkSidecar.validateTarget`               | `string`                          | —                    | Optional microbuild name: `chunk validate <name> --remote`                                                                                               |
| `ci.doctor.enabled`                                    | `boolean`                         | `true`               | Enable CI Doctor agent for failure diagnosis                                                                                                             |
| `ci.doctor.maxLogLength`                               | `number`                          | `0`                  | Max log chars (0 = unlimited — full logs for CI Doctor)                                                                                                  |
| `ci.doctor.model`                                      | `string`                          | —                    | Model override for CI Doctor (defaults to main model)                                                                                                    |

**Task Selection Modes:**

- `first-incomplete` (default): Always picks the first incomplete task in order. Predictable, no extra cost.
- `smart`: Uses an agent call to intelligently select the best next task based on dependencies and logical ordering. Adds ~$0.01-0.02 per run but can improve results for larger plans.

**Notes:**

- If `ralphci.json` doesn't exist, Ralph uses Claude by default
- The `model` field is passed to the Claude CLI via `--model` (e.g. `"claude-opus-4-6"`). If omitted, Claude uses its default model.
- When using Cursor, token usage and cost information are not displayed (Cursor doesn't provide this data)
- If `ci.enabled` is set to `false` in the config, CI remains disabled even without the `--no-ci` flag. The config setting takes precedence.
- Git push behavior (`git.autoPush`, `git.pushOnLocalSuccess`) is independent of CI. You can auto-push to GitHub even with CI disabled.
- `git.baseBranch` controls which branch feature branches are created from. Set to `"current"` to branch from wherever you are when you run `ralphci run`, or specify an explicit branch name like `"develop"`. If omitted, auto-detects `main` or `master`.

**Chunk sidecar (optional):** For [CircleCI Chunk sidecars](https://circleci.com/blog/chunk-sidecars/) and microbuilds, install the [Chunk CLI](https://github.com/CircleCI-Public/chunk-cli), run `chunk init` and `chunk auth set circleci` in your repo, create/select a sidecar as in the Chunk docs, then set `reviewGate.chunkSidecar.enabled` to `true` in `ralphci.json`. The Review Gate will run local format/lint/tests first, then sync to the sidecar and run `chunk validate --remote` before push. Requires a paid CircleCI plan with sidecar preview access.

**Example with working directory:**

```bash
# Create config for a specific feature
mkdir -p features/my-feature
echo '{"runner": "cursor", "model": "composer-1"}' > features/my-feature/ralphci.json
ralphci scaffold -w features/my-feature
ralphci run -w features/my-feature -m 10
```

## Auto Branch & PR

When `uniqueId` is set in `ralphci.json`, `ralphci run` automatically creates a feature branch and GitHub PR before starting the agent loop.

**Base branch:** Feature branches are created from the base branch configured via `git.baseBranch`. Set to `"current"` to branch from your current branch, or specify a branch name like `"develop"`. If omitted, auto-detects `main` or `master`.

**Branch naming:** The branch name is derived from the working directory path relative to the repo root, with `__<uniqueId>` appended:

```
Working directory: experiments/no-ci_vs_ci/claude-default/ci-iteration-1/
uniqueId: "0"
Branch name:      experiments/no-ci_vs_ci/claude-default/ci-iteration-1__0
```

**PR behavior:**

- PRs start as **draft** by default while the agent loop is running
- On successful completion (all tasks done, CI green if required), the PR is automatically **marked as ready for review**
- Use `--no-draft-pr` to create the PR as ready for review immediately
- The PR title is extracted from `plan.md` (first heading, with `[#<uniqueId>]` suffix)
- On completion, a **metrics summary table** is appended to the PR description

**Idempotency:** Re-running with the same `uniqueId` checks out the existing branch and skips PR creation — safe to resume interrupted runs.

**Final commit:** On successful completion, any uncommitted changes (especially `metrics.json`) are automatically committed and pushed before the PR is finalized.

**Example `ralphci.json`:**

```json
{
  "uniqueId": "1.0.0",
  "runner": "claude",
  "model": "claude-opus-4-6",
  "git": {
    "autoPush": true,
    "pushOnLocalSuccess": true,
    "baseBranch": "current"
  },
  "ci": {
    "enabled": true,
    "provider": "circleci",
    "doctor": {
      "enabled": true,
      "maxLogLength": 0
    }
  },
  "reviewGate": {
    "enabled": true,
    "testTimeoutSeconds": 60,
    "lintFixEnabled": true,
    "testsEnabled": true
  }
}
```

**Requirements:** GitHub CLI (`gh`) must be installed and authenticated. If `gh` is not available, branch creation still works but PR creation is skipped.

## Core Concepts

### Workflow Comparison

RalphCI supports two main modes:

| Feature            | CI Enabled (Default)      | Local-Only (`--no-ci`)            |
| ------------------ | ------------------------- | --------------------------------- |
| **Commands**       | `scaffold`, `run`         | `scaffold --no-ci`, `run --no-ci` |
| **CI integration** | Full (API + optional MCP) | None                              |
| **Auto push**      | Smart push on success     | Configurable via `git.autoPush`   |
| **Approval gate**  | Enabled                   | Disabled                          |
| **Task tracking**  | `ciVerified` field        | `passes` only                     |
| **Use when**       | Production-ready CI/CD    | Local development, learning       |

**Recommendation:**

- **Use CI mode** (default) when shipping to production with confidence
- **Use `--no-ci`** for local development, learning, or when CI isn't configured

### The Ralph Loop

Ralph automates iterative development by having an AI assistant (Claude or Cursor):

1. Read the activity log to understand current state
2. Find the next incomplete task in your plan
3. Complete all steps for that task
4. Verify the task works
5. Update the activity log
6. Mark the task as complete
7. Make a git commit
8. Repeat until all tasks are done

### The RalphCI Loop (Phased Architecture)

**RalphCI** extends the standard loop with **specialized agents** and CI integration:

1. **CI Check** — CLI checks CI status (cached; only hits API after a push)
2. **CI Doctor** (if CI is red) — Specialized agent diagnoses and fixes CI failure using full untruncated logs
3. **Build Agent** (if CI is green) — Lighter agent works on task (coding + tests, no CI noise)
4. **Review Gate** — Deterministic pre-push check: auto `lint:fix` + `test:run` with hard timeout
5. **Smart Push** — Only pushes when Review Gate passes
6. Repeat until all tasks done AND CI green
7. **Approval gate** for human review before deploy

**Why specialized agents?** The CI Doctor receives full stack traces (unlimited log length) and uses a prompt purpose-built for CI debugging. The Build Agent stays lean and focused on coding. Neither gets distracted by the other's context.

### Agent Architecture

RalphCI uses **three specialized components** instead of one monolithic agent:

| Component       | Type                   | Purpose                                                                      |
| --------------- | ---------------------- | ---------------------------------------------------------------------------- |
| **Build Agent** | LLM agent              | Writes code and tests. Lighter prompt — no CI failure noise                  |
| **CI Doctor**   | LLM agent              | Diagnoses and fixes CI failures. Full untruncated logs, purpose-built prompt |
| **Review Gate** | Deterministic (no LLM) | Pre-push `lint:fix` + `test:run` with hard timeout. Zero token cost          |
| **CI Cache**    | Utility                | Tracks pushes, skips redundant API calls. Reduces CI queries ~50-70%         |

**Why specialize?**

- The CI Doctor receives **complete stack traces** (unlimited log length) and uses a prompt purpose-built for CI pipeline debugging — lint, test, build, dependency, Docker, env, config, and flaky test failures
- The Build Agent stays lean — no CI context clutter, focused on the current task
- The Review Gate catches lint/test issues **before they ever reach CI** — eliminating the most common class of CI failures at zero agent cost

### The Tradeoff Triangle

When building with AI agents and CI, you're balancing three competing concerns:

```
          Small PRs / Easy Review
                   /\
                  /  \
                 /    \
                /      \
               /        \
              /__________\
       Token Costs    CI Costs
```

**You can optimize for two, but not all three:**

| Strategy          | Small PRs | Low Tokens | Low CI | Tradeoff           |
| ----------------- | --------- | ---------- | ------ | ------------------ |
| Push every commit | ✅        | ❌         | ❌     | Expensive, slow CI |
| Big batches       | ❌        | ✅         | ✅     | Hard to review     |
| **Smart push**    | ✅        | ✅         | ✅\*   | Sweet spot         |

\*Smart push achieves all three by only pushing when local tests pass, batching failed iterations.

**Our recommended balance**: One task = One commit = One CI verification

- Tasks: 15-30 minutes of work each
- Commits: One logical unit per commit
- CI runs: Only when local tests pass

### Smart Push Strategy

The CLI uses **smart push** by default to minimize CI runs:

```
Iteration 1: work → commit → local tests FAIL → no push
Iteration 2: work → commit → local tests FAIL → no push
Iteration 3: work → commit → local tests PASS → PUSH → CI runs
Iteration 4: CI failed → work → commit → PASS → PUSH → CI runs
Iteration 5: CI passed → task complete ✓
```

**Result**: 5 iterations = 2 CI runs (not 5)

**The rule**: Only push when the agent signals `<promise>success</promise>` (local tests pass). This batches failed iterations locally before hitting CI.

### When Is a Commit Worthy?

A commit should pass all three criteria:

| Criterion      | Question                               |
| -------------- | -------------------------------------- |
| **Works**      | Do local tests pass?                   |
| **Complete**   | Is it a logical unit of work?          |
| **Standalone** | Could someone review just this commit? |

Good: `feat: add user registration endpoint` (complete, tested, reviewable)
Bad: `WIP`, `fix typo`, `iteration 3 of 10` (incomplete or noise)

### Key Files

- **plan.md**: JSON task list with descriptions, steps, and pass/fail status
- **activity.md**: Detailed log of what Claude accomplished each iteration
- **prompt.md**: Instructions that guide Claude's behavior
- **spec.md** (optional): Detailed specification/requirements document

### Working Directory Pattern

```bash
# Organize features in subdirectories
mkdir -p features/my-feature
ralphci scaffold -w features/my-feature
# Edit features/my-feature/plan.md and spec.md
ralphci run -w features/my-feature -m 15

# AI runs from project root (can edit source files)
# But reads plan/activity from features/my-feature/
```

This lets you work on multiple features in parallel with isolated plans.

## Commands

RalphCI provides a unified workflow with optional CI integration:

### `ralphci check-ci`

Verify CircleCI API connection and token validity. Use this to quickly test that your `CIRCLE_TOKEN` is set up correctly.

```bash
ralphci check-ci              # Basic connection check
ralphci check-ci -v           # Verbose (shows token prefix)
```

**What it checks:**

1. `CIRCLE_TOKEN` environment variable is set
2. Token is valid (makes API call to `/api/v2/me`)
3. Git context (detects project slug and current branch)
4. CI status for current branch (if in a git repo)

**Example output:**

```
🔍 Checking CircleCI connection...

✅ CIRCLE_TOKEN is set

🔗 Verifying token with CircleCI API...
✅ Token is valid
   Authenticated as: Your Name

📁 Checking git context...
✅ Project: gh/your-org/your-repo
   Branch: main

📊 Fetching CI status for current branch...
✅ CI Status: success
   All workflows passed
   Pipeline #123

✅ CircleCI connection verified!
```

### `ralphci scaffold`

Generate RalphCI workflow files. CI integration is enabled by default.

```bash
ralphci scaffold                            # Create with CI enabled (default)
ralphci scaffold --no-ci                    # Create for local-only workflow
ralphci scaffold -w ./my-feature            # Create in subdirectory
ralphci scaffold -f                         # Overwrite existing files
ralphci scaffold --no-approval-gate         # Disable approval gate
ralphci scaffold --no-auto-push             # Disable automatic git push
ralphci scaffold --branch-strategy direct-to-main  # Work directly on main
```

Creates: `activity.md`, `plan.md`, `tasks.json`, `prompt.md`, `ralphci.json`, `screenshots/`, `src/`

**With CI enabled (default):**

- Activity log includes CI status section
- Tasks track both local completion (`passes`) and CI verification (`ciVerified`)
- Prompt instructs agent to query CI at the start of each iteration
- Config includes CI-specific settings (auto-push, approval gate, etc.)

**With `--no-ci`:**

- Simplified activity log
- Tasks track only local completion (`passes`)
- Prompt focuses on local testing
- CI features disabled in config

### `ralphci run`

Execute the RalphCI loop. CI integration is enabled by default.

```bash
ralphci run -m 10                           # Run with CI enabled (default)
ralphci run -m 10 --no-ci                   # Run in local-only mode
ralphci run -m 10 -w ./features/auth        # Run with specific working directory
ralphci run --unlimited                     # No iteration limit (use with caution)
ralphci run --no-approval-gate              # Auto-deploy when CI green
ralphci run --no-auto-push                  # Don't auto-push after commits
ralphci run --no-require-green              # Allow completion without CI verification
ralphci run --ci-wait 600                   # Wait up to 600s for CI between iterations
ralphci run --push-every-commit             # Chatty mode: push every commit (not recommended)
ralphci run --branch-strategy direct-to-main  # Work directly on main
ralphci run --no-draft-pr                     # Create PR as ready for review (not draft)
ralphci run -v                              # Verbose output for debugging smart selection
```

**Behavior (CI enabled):**

- CLI pre-fetches CircleCI status at the START of each iteration and injects it into the prompt
- CI failures (with logs) take priority over planned tasks (agent fixes CI first)
- Auto-pushes after commits to trigger CI (unless `--no-auto-push`)
- Requires CI green before marking all tasks complete (unless `--no-require-green`)
- Approval gate pauses for human review before deploy (unless `--no-approval-gate`)
- Collects metrics for experiment analysis (saved to `metrics.json`)
- On completion: final metrics are committed/pushed and appended to the PR description

**Behavior (local-only with `--no-ci`):**

- No CI queries or integration
- Auto push is controlled by `git.autoPush` in `ralphci.json` (independent of CI)
- Tasks complete when local tests pass
- No approval gate

**CI Status Injection & CI Doctor (when CI enabled):**

The CLI uses a **cached query system** — only hits the CircleCI API when a push has occurred since the last check:

1. Pipeline status (success/failed/running)
2. Failed job names and numbers
3. **Full untruncated failure logs** (sent to CI Doctor agent for diagnosis)

When CI is red, the **CI Doctor** agent receives the complete logs and fixes the issue directly. The Build Agent never sees CI failure noise. Requires `CIRCLE_TOKEN` env var.

**Optional MCP Tools (for advanced use):**

The agent can also use CircleCI MCP tools for mid-iteration queries:

- `get_latest_pipeline_status` - Re-check CI after pushing a fix
- `get_job_test_results` - Get detailed test results
- `get_build_failure_logs` - Get more failure context
- `rerun_workflow` - Retry a failed workflow

**Decision logic based on CI state:**

| CI State | Action                                           |
| -------- | ------------------------------------------------ |
| Green    | Proceed with planned task, verify completion     |
| Red      | **Priority**: Fix CI failure before planned task |
| Running  | Proceed with local work, note CI pending         |
| None     | Work on task, push when ready to verify          |

**Success signals:**

- `<promise>success</promise>` - Task complete locally, ready for CI verification
- `<promise>ci-pending</promise>` - Pushed changes, waiting for CI
- `<promise>ci-fix-attempted</promise>` - Attempted to fix a CI failure
- `<promise>needs-human</promise>` - Stuck, needs human review
- `<promise>COMPLETE</promise>` - ALL tasks done AND CI is green

**Exit codes:**

- `0` - All tasks complete (and CI green if required)
- `1` - Max iterations reached with incomplete tasks
- `2` - Agent requested human assistance (`<promise>needs-human</promise>`)

**Metrics output (`metrics.json`):**

```json
{
  "startTime": "2026-01-30T10:00:00Z",
  "endTime": "2026-01-30T10:45:00Z",
  "iterations": [...],
  "summary": {
    "totalIterations": 8,
    "totalTokens": 125000,
    "totalCost": 1.23,
    "ciQueriesTotal": 8,
    "ciFailuresEncountered": 2,
    "ciFailuresFixed": 2,
    "tasksCompleted": 5,
    "totalDurationMs": 2700000
  }
}
```

**Metrics summary fields:**

| Field                   | Description                                            |
| ----------------------- | ------------------------------------------------------ |
| `totalIterations`       | Number of loop iterations run                          |
| `totalTokens`           | Total input + output tokens used                       |
| `totalCost`             | Total cost in USD                                      |
| `ciQueriesTotal`        | Total CI status queries made (sum from all iterations) |
| `ciFailuresEncountered` | Number of iterations where CI fix was attempted        |
| `ciFailuresFixed`       | Number of iterations where CI was successfully fixed   |
| `tasksCompleted`        | Number of tasks with `passes: true`                    |
| `timeToFirstCIGreen`    | Time in ms until first CI green (if tracked)           |
| `totalDurationMs`       | Total elapsed time in milliseconds                     |

The summary is calculated from iteration data and saved automatically at the end of each run, on periodic saves (every 5 iterations), and when the agent signals completion or requests human help.

### `ralphci create-settings`

Generate Claude and MCP configuration files (optional, for advanced MCP features).

```bash
ralphci create-settings              # Create in current directory
ralphci create-settings -w ./project # Create in subdirectory
ralphci create-settings -f           # Overwrite existing
```

Creates: `.claude/settings.json`, `.mcp.json`

### Legacy Commands

The following commands are maintained for backwards compatibility:

| Legacy Command          | Replacement              |
| ----------------------- | ------------------------ |
| `ralphci scaffold-ci`   | `ralphci scaffold`       |
| `ralphci run-ci`        | `ralphci run`            |
| `ralphci scaffold-md`   | Legacy markdown workflow |
| `ralphci run-md`        | Legacy markdown workflow |
| `ralphci scaffold-json` | Legacy JSON workflow     |
| `ralphci run-json`      | Legacy JSON workflow     |

**tasks.json schema:**

```json
[
  {
    "category": "implementation",
    "description": "Create user authentication module",
    "steps": [
      "Create src/auth/authenticate.ts",
      "Implement JWT token validation",
      "Add unit tests in tests/auth/authenticate.test.ts",
      "Run npm test -- verify tests pass"
    ],
    "passes": false,
    "ciVerified": false
  }
]
```

**Required fields:**

- `category` (string): Task category (e.g., "setup", "implementation", "testing")
- `description` (string): Clear description of what to accomplish
- `steps` (array): Explicit steps to complete the task
- `passes` (boolean): Completion status (CLI sets to true on success)
- `ciVerified` (boolean, CI mode only): CI verification status

**What the AI can edit:**

- ✅ Source code, tests, documentation
- ✅ activity.md (progress logging)
- ✅ plan.md (notes and context)
- ❌ tasks.json (CLI owns task completion status)

## Writing Your Plan

### 1. Write a Spec (Recommended for Complex Features)

Create `spec.md` with detailed requirements:

````markdown
# Feature Name

## Project Overview

What you're building and why.

## Requirements

- Functional requirement 1
- Functional requirement 2
- Non-functional requirements

## Technical Constraints

- Use TypeScript strict mode
- Follow existing patterns in src/
- Minimize dependencies

## API Design

```typescript
interface MyFeature {
  doSomething(input: string): Promise<Result>;
}
```
````

## Testing & Verification

- Unit tests for all functions
- Integration test for end-to-end flow
- Manual test: do X and verify Y

```

### 2. Generate a Plan with AI

Use Claude or ChatGPT to generate your task breakdown:

**Example prompt:**
```

I have a spec.md file describing a new feature. Please read @spec.md
and generate a plan.md with 6-10 tasks in the Ralph loop JSON format.
Each task should have: category, description, clear steps, and verification.
Tasks should be 5-15 minutes of work each.

````

### 3. Review and Refine the Plan

Edit `plan.md` to ensure quality:

```markdown
# Project Plan

## Project Overview
Brief description of what you're building.

@spec.md

---

## Task List

```json
[
  {
    "category": "setup",
    "description": "Set up database schema and install dependencies",
    "steps": [
      "Install required npm packages: zod, bcrypt",
      "Create database migration for users table",
      "Run migration: npm run migrate",
      "Verify table exists: psql -c '\\d users'",
      "Run npm run build - should have no TypeScript errors"
    ],
    "passes": false
  },
  {
    "category": "implementation",
    "description": "Create User repository with CRUD operations",
    "steps": [
      "Create src/repositories/UserRepository.ts",
      "Implement create, findById, findByEmail, update methods",
      "Add proper TypeScript types and error handling",
      "Write unit tests in tests/repositories/UserRepository.test.ts",
      "Run npm test - verify UserRepository tests pass"
    ],
    "passes": false
  }
]
````

````

**Good task characteristics:**
- ✅ Clear, specific description
- ✅ 5-15 minutes of focused work
- ✅ Explicit verification step
- ✅ Lists specific files to create/modify
- ❌ Avoid: "Implement everything" (too vague)
- ❌ Avoid: "Add one import" (too small)

### 4. Customize the Prompt (Optional)

Edit `prompt.md` to add project-specific guidance:

```markdown
## Project Context
- TypeScript Node.js API using Express and PostgreSQL
- Follow existing patterns in src/repositories/ and src/services/
- Use Zod for validation

## Coding Standards
- Add JSDoc comments for public functions
- Prefer async/await over .then() chains

## Testing Requirements
- Write unit tests for all new functions
- Mock external dependencies (database, APIs)
````

## Choosing max-iterations

Formula: `max-iterations = number_of_tasks + buffer`

Examples:

- 5 tasks → use `-m 8` (5 + 3 buffer)
- 10 tasks → use `-m 13` (10 + 3 buffer)
- 20 tasks → use `-m 25` (20 + 5 buffer)

**Why a buffer?**

- Tests might fail and need fixing
- Build errors need resolution
- Tasks might be more complex than anticipated

**Cost:** Typically $0.05-$0.15 per iteration depending on context size.

**Tip:** Start conservative and run again if needed. Progress is saved.

```bash
ralphci run -m 5    # Run 5 iterations
cat activity.md # Check progress
ralphci run -m 5    # Continue where you left off
```

## Common Pitfalls and Solutions

| Pitfall                   | Solution                                                 |
| ------------------------- | -------------------------------------------------------- |
| Tasks too large (>30 min) | Break into smaller tasks (<15 min each)                  |
| Unclear success criteria  | Add explicit verification: "Run tests, verify X passes"  |
| Missing dependencies      | Include installation in task steps                       |
| Tests don't exist yet     | Order tasks: implement → write tests → run tests         |
| Context grows too large   | Keep plan focused; completed tasks marked `passes: true` |
| Loop gets stuck on a task | Pause, fix manually or refine task steps, resume         |

## Example Workflows

For detailed, real-world examples see [EXAMPLES.md](EXAMPLES.md):

1. **Building a New Feature from Scratch**: Complete workflow for implementing a notification system
2. **Refactoring Existing Code**: Systematic refactoring of error handling across an Express API
3. **Debugging and Fixing a Bug**: Structured investigation and fix for an intermittent cart bug

Quick example - Building a feature:

```bash
# 1. Create feature directory and spec
mkdir -p features/notifications
cd features/notifications
# Write spec.md with requirements

# 2. Generate plan with AI assistant
# "Please read @spec.md and generate a plan.md..."

# 3. Scaffold and run (CI enabled by default)
cd ../..  # back to project root
ralphci scaffold -w features/notifications
ralphci run -w features/notifications -m 15

# Or for local-only development:
ralphci scaffold --no-ci -w features/notifications
ralphci run --no-ci -w features/notifications -m 15

# 4. Review results
cat features/notifications/activity.md
git log --oneline
```

## Tips and Best Practices

### Writing Effective Plans

- **Task granularity**: Aim for 5-15 minute tasks
- **Clear steps**: Use action verbs, specify files, include verification
- **Verification**: Every task needs a "verify it works" step
- **Dependencies**: Order tasks properly (create before using)
- **Categories**: Use consistent categories: setup, implementation, refactoring, testing, verification, cleanup

### Customizing prompt.md

Add project-specific context, coding standards, and testing requirements. Keep it concise - the prompt is included in every iteration. Works with both Claude and Cursor runners.

### Using spec.md

For non-trivial features, write a spec.md and reference it with `@spec.md` in plan.md. Include:

- Requirements and constraints
- API contracts and data structures
- Examples and use cases
- Testing criteria

Benefits: separation of concerns, better context for Claude, easier to maintain.

### Cost Optimization

- Monitor cumulative cost output
- Keep context focused (smaller plan.md and prompt.md)
- Break large features into separate loops
- Typical feature: $0.50-$1.50 for 10 iterations

### Workflow Tips

1. **Start small**: First loop? Try 3-5 simple tasks
2. **Review frequently**: Check activity.md after iterations
3. **Use git effectively**: Each task = 1 commit, easy to review/revert
4. **Leverage AI for planning**: Let AI generate task breakdown, then review
5. **Parallel features**: Use different working directories for multiple features
6. **Document learnings**: activity.md captures insights, root causes, patterns

## Local Development Setup

For contributors working on the CLI itself:

### 1. Clone and Install

```bash
git clone <repository-url>
cd ralph-ci
pnpm install
pnpm link --global
```

**No build step required.** The `ralphci` binary uses `tsx` to run TypeScript source directly, so every invocation always runs the latest code. Just edit files in `src/` and your changes take effect immediately.

### 2. Verify It Works

```bash
# Test from anywhere
cd ~/some-other-project
ralphci --version            # Should show version
ralphci scaffold             # Should work!
```

**Unlink when done:**

```bash
pnpm unlink --global
```

### 3. Development Commands

```bash
pnpm run lint                    # Lint code
pnpm run dev scaffold            # Run in dev mode (alternative to global link)
pnpm run dev run -m 10           # Dev mode with args
```

## Testing

```bash
pnpm test                        # Run all tests
pnpm run test:watch              # Watch mode
```

Test coverage: 378 tests across 22 test files covering file operations, commands, utilities, review gate, CI cache, and configuration.

## Package Manager

This project uses **pnpm** for faster installs and efficient disk space usage.

## Ralph Loop Philosophy

- **Specialized Agents**: Build Agent (coding), CI Doctor (failure diagnosis), Review Gate (quality automation)
- **Structured Planning**: Clear tasks with pass/fail states
- **Activity Logging**: Every change documented with verification
- **Incremental Progress**: One task at a time, git commit per task
- **Pre-Push Validation**: Review Gate catches lint/test issues before CI (zero token cost)
- **CI-First**: CI Doctor receives full untruncated logs for any pipeline failure
- **Cost Tracking**: Token usage tracked per-iteration and cumulatively (Claude runner)
- **Early Exit**: Completes when AI outputs `<promise>COMPLETE</promise>`
- **Multi-Backend Support**: Works with Claude CLI or Cursor CLI via ralphci.json configuration

## File Structure

```
my-project/
├── .claude/
│   └── settings.json       # Claude config (optional, for MCP)
├── .mcp.json               # MCP server config (optional, for advanced CI features)
├── ralphci.json            # Runner configuration (runner, ci.doctor, reviewGate, etc.)
├── activity.md             # Activity log (required for run)
├── plan.md                 # Project plan (required for run)
├── prompt.md               # Build Agent instructions (required for run)
├── spec.md                 # Specification (optional)
├── screenshots/            # Screenshots directory
└── src/                    # Source code output directory
    └── ...                 # Agent creates implementation files here
```

**Output Directory Convention**: The agent creates all source code and implementation files in the `src/` folder. This keeps workflow files (activity.md, plan.md, tasks.json, etc.) separate from the actual project output.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes with tests
4. Run `pnpm test` to verify
5. Submit a pull request

## License

MIT

## Support

For issues or questions, visit the project repository.
