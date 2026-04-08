# Agent Guidelines for RalphCI

## Project Overview

**RalphCI** (`ralphci`) is a TypeScript CLI that closes the gap between "local tests pass" and "actually works in production" by integrating AI coding agents with your real CI pipeline.

The key insight: AI agents shouldn't declare victory when local tests pass—they should verify against your actual CI pipeline. RalphCI queries CircleCI at the start of each iteration, prioritizes CI failures, and won't complete until the real pipeline is green.

## Package Management

Use **pnpm** for all package management:

```bash
pnpm install
pnpm test
pnpm run lint
```

**No build step required.** The `ralphci` binary uses `tsx` to run TypeScript source directly. After `pnpm install && pnpm link --global`, every `ralphci` invocation always runs the latest source — no `pnpm build` needed.

## Code Style

- Do not use `[debug]` prefixes in console.log statements
- Use TypeScript strict mode
- Follow existing patterns in `src/commands/` and `src/utils/`
- Write tests for new functionality (see `*.test.ts` files)

## Pre-Approval Gate (MANDATORY)

**Before presenting ANY change for user review ("Keep All"), you MUST run all three commands in order and verify they pass:**

```bash
pnpm lint:fix && pnpm format:fix && pnpm test:run
```

This is non-negotiable. Every single approvable change must pass lint, formatting, and tests before the human sees it. Do NOT ask the user to review changes that haven't been validated.

- `pnpm lint:fix` — ESLint auto-fix (e.g., single vs double quotes)
- `pnpm format:fix` — Prettier auto-fix (formatting)
- `pnpm test:run` — Run the full test suite

If any command fails, fix the issue and re-run all three before presenting. If tests fail, do not skip them — fix the code or the tests.

---

## Understanding RalphCI

### The Problem We're Solving

Traditional AI coding loops work like this:

1. Agent writes code
2. Agent runs local tests
3. Local tests pass
4. Human ships and **prays it works in production**

The gap between "local tests pass" and "actually works in CI/production" is where bugs hide.

### Our Solution: RalphCI

**RalphCI** closes this gap with a **phased agent architecture**:

1. **CI Status Check** (cached — only queries API after a push)
2. If CI is red → **CI Doctor** agent diagnoses and fixes the failure (full untruncated logs)
3. If CI is green → **Build Agent** works on the current task (lighter, focused prompt)
4. **Review Gate** validates changes before push (deterministic lint:fix + tests with timeout)
5. Only pushes when Review Gate passes → **Smart push** triggers CI
6. Next iteration: cached CI check, repeat
7. Only complete when ALL tasks done AND CI is green
8. Approval gate for human review before deploy

---

## The Tradeoff Triangle

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

| Optimize For             | Sacrifice        | Result                               |
| ------------------------ | ---------------- | ------------------------------------ |
| Small PRs + Low CI Costs | Token efficiency | More local iterations before pushing |
| Small PRs + Low Tokens   | CI efficiency    | Push every commit (expensive)        |
| Low CI + Low Tokens      | Reviewability    | Big mega-commits (hard to review)    |

### Our Recommended Balance

**One task = One commit = One CI verification**

- Tasks should be 15-30 minutes of work
- Agent iterates locally until task passes
- Then pushes once to verify in CI
- Result: Reviewable commits, reasonable CI usage, manageable token costs

---

## Agent Architecture

RalphCI uses **specialized agents** for different concerns, orchestrated by the CLI:

### Build Agent

- **Role:** Writes code and tests for the current task
- **Prompt:** Lighter, focused on coding — no CI failure noise
- **Template:** `PROMPT_CI_TEMPLATE` in `src/templates/index.ts`
- CI failure handling is delegated to CI Doctor

### CI Doctor Agent

- **Role:** Diagnoses and fixes ANY CI pipeline failure
- **Prompt:** Minimal noise, maximum CI context (full untruncated logs)
- **Template:** `PROMPT_CI_DOCTOR_TEMPLATE` in `src/templates/index.ts`
- Only invoked when CI is red
- Handles: lint failures, test failures, build errors, dependency issues, Docker problems, env/config issues, flaky tests
- Makes the fix directly, then Review Gate validates

### Review Gate (deterministic, no LLM)

- **Role:** Pre-push quality check
- **Module:** `src/utils/review-gate.ts`
- Runs `pnpm lint:fix` (auto-corrects style issues before they reach CI)
- Runs `pnpm test:run` with hard timeout (default 60s — never hangs)
- If gate fails, feedback is injected into the Build Agent's next iteration
- Configurable via `reviewGate` in `ralphci.json`

### CI Query Cache

- **Role:** Avoids redundant CircleCI API calls
- **Module:** `src/utils/ci-cache.ts`
- Only queries CI when a push happened since the last check
- Reduces API calls per run by ~50-70%

### Iteration Flow

```
For each iteration:
  1. ORCHESTRATOR (CLI): Load tasks, select next task
  2. CI CHECK (cached): Skip API if no push since last query
  3. IF CI is red:
     a. CI DOCTOR: Diagnose + fix failure (full logs)
     b. REVIEW GATE: Validate the fix (lint + tests)
     c. ORCHESTRATOR: Push if gate passes
  4. IF CI is green/N/A:
     a. BUILD AGENT: Work on task (code + tests)
     b. REVIEW GATE: Validate changes (lint + tests)
     c. ORCHESTRATOR: Push if gate passes (smart push)
  5. Update metrics, check completion
```

---

## Smart Push Strategy

The CLI uses **smart push** by default to minimize CI costs:

### How It Works

```
Iteration 1: work → commit → local tests FAIL → no push
Iteration 2: work → commit → local tests FAIL → no push
Iteration 3: work → commit → local tests PASS → PUSH → CI runs
Iteration 4: CI failed → work → commit → PASS → PUSH → CI runs
Iteration 5: CI passed → task complete ✓
```

**Result**: 5 iterations = 2 CI runs (not 5)

### The Rule

Only push when:

- Agent signals `<promise>success</promise>` (local tests pass), OR
- Agent signals `<promise>ci-fix-attempted</promise>` (CI fix ready)

Never push when:

- Still iterating locally
- Local tests failing
- Just fixing lint/typos

### Configuration

```bash
# Default: CI enabled, smart push (recommended)
ralphci run -m 10

# Local-only mode: CI disabled
ralphci run --no-ci -m 10

# Chatty mode: push every commit (not recommended)
ralphci run -m 10 --push-every-commit

# Manual only: no auto-push
ralphci run -m 10 --no-auto-push
```

---

## Commit Convention

RalphCI uses **[Conventional Commits](https://www.conventionalcommits.org/)** for all git commits. The orchestrator constructs commit messages automatically — agents never commit directly.

### Format

```
type(scope): description
```

- **type** — the kind of change: `feat`, `fix`, `refactor`, `chore`, `test`, `docs`, `ci`, `perf`, `style`
- **scope** — optional context: `ci`, `metrics`, module name, etc.
- **description** — imperative mood, lowercase, no period

### How the Orchestrator Maps Commit Types

| Scenario             | Commit Message                               |
| -------------------- | -------------------------------------------- |
| Task completed       | `feat: complete task N - <task description>` |
| CI fix (CI Doctor)   | `fix(ci): <commit-summary from agent>`       |
| CI fix (Build Agent) | `fix(ci): <commit-summary from agent>`       |
| Finalization         | `chore: finalize all tasks`                  |
| Metrics              | `chore(metrics): save run metrics`           |

The CI Doctor and Build Agent provide the description via a `<commit-summary>` tag; the orchestrator prefixes the appropriate type. See `gitCommitAndPush()` in `src/commands/run-ci.ts`.

### When Is a Commit Worthy?

A commit is "worthy" when it passes all three criteria:

| Criterion      | Question                        | Why                           |
| -------------- | ------------------------------- | ----------------------------- |
| **Works**      | Do local tests pass?            | Don't waste CI on broken code |
| **Complete**   | Is it a logical unit?           | Reviewable, revertable        |
| **Standalone** | Could someone review just this? | Small PR = fast review        |

### Good Commits

| Commit Message                           | Why It's Good                    |
| ---------------------------------------- | -------------------------------- |
| `feat: add user registration endpoint`   | Complete feature, tests pass     |
| `fix: handle duplicate email gracefully` | One bug, one fix                 |
| `refactor: extract auth middleware`      | Logical unit, behavior unchanged |

### Bad Commits

| Commit Message         | Why It's Bad                                  |
| ---------------------- | --------------------------------------------- |
| `WIP`                  | Incomplete, can't review                      |
| `fix typo`             | Too small, noise                              |
| `implement everything` | Too big, can't review                         |
| `iteration 3 of 10`    | Meaningless to reviewer                       |
| `Fixed stuff`          | Past tense, vague — use imperative mood       |
| `Add user auth.`       | Trailing period, capitalized — follow the fmt |

---

## Key Commands

```bash
# Verify CircleCI connection
ralphci check-ci           # Check CIRCLE_TOKEN and API connection
ralphci check-ci -v        # Verbose (shows token prefix)

# Primary workflow (CI enabled by default)
ralphci scaffold           # Create workflow files (CI enabled)
ralphci run -m 10          # Run with CircleCI integration

# Local-only workflow (CI disabled)
ralphci scaffold --no-ci   # Create workflow files (local-only)
ralphci run --no-ci -m 10  # Run without CI integration

# Legacy commands (still supported)
ralphci scaffold-md        # Create markdown workflow files
ralphci run-md -m 10       # Run markdown workflow
ralphci scaffold-json      # Create JSON workflow files
ralphci run-json -m 10     # Run JSON workflow
```

## Run Command Options

```bash
ralphci run -m 10                             # Default: 10 iterations, CI enabled, smart push, approval gate
ralphci run --no-ci -m 10                     # Disable CI integration (local-only)
ralphci run --unlimited                       # No iteration limit (use with caution)
ralphci run --push-every-commit               # Chatty mode (not recommended)
ralphci run --no-approval-gate                # Auto-deploy when CI green
ralphci run --no-auto-push                    # Manual git push only
ralphci run --no-require-green                # Complete without CI verification
ralphci run --branch-strategy direct-to-main  # Skip feature branches
ralphci run --no-draft-pr                     # Create PR as ready for review (not draft)
```

---

## Architecture Notes

### File Structure

```
src/
├── commands/
│   ├── check-ci.ts       # Verify CircleCI API connection
│   ├── run.ts            # Legacy markdown workflow
│   ├── run-json.ts       # Legacy JSON workflow
│   ├── run-ci.ts         # Main workflow — phased loop (CI optional via --no-ci)
│   ├── scaffold.ts       # Legacy scaffold markdown files
│   ├── scaffold-json.ts  # Legacy scaffold JSON files
│   └── scaffold-ci.ts    # Main scaffold (CI optional via --no-ci)
├── templates/
│   └── index.ts          # All prompt templates (Build Agent, CI Doctor, no-CI)
├── utils/
│   ├── circleci-api.ts   # CircleCI API client (unlimited log fetching)
│   ├── ci-cache.ts       # CI query cache (push-aware)
│   ├── claude-runner.ts  # Claude CLI integration
│   ├── cursor-runner.ts  # Cursor CLI integration
│   ├── config.ts         # ralphci.json loading (reviewGate, ci.doctor configs)
│   ├── review-gate.ts    # Pre-push quality gate (lint:fix + tests with timeout)
│   └── validation.ts     # File validation
└── index.ts              # CLI entry point
```

### Key Files for RalphCI

- `prompt.md` - Build Agent instructions (lighter prompt, focused on coding)
- `ralphci.json` - Configuration (runner, model, `git.baseBranch`, git push strategy, CI provider, `uniqueId`, `reviewGate`, `ci.doctor`)
- `tasks.json` - Tasks with `ciVerified` field
- `metrics.json` - Experiment data (iterations, CI queries, costs); auto-committed and appended to PR on completion
- `src/` - Output directory where agent creates all source code and implementation files

### Auto Branch & PR

When `uniqueId` is set in `ralphci.json`, `ralphci run` automatically:

1. Creates a branch named `<relative-dir-path>__<uniqueId>` from the configured base branch (`git.baseBranch` — defaults to auto-detect `main`/`master`, set to `"current"` to branch from the starting branch)
2. Creates a draft GitHub PR (title from `plan.md`, body with plan summary)
3. On successful completion: commits final metrics, appends metrics summary to PR, marks PR as ready for review

Use `--no-draft-pr` to skip the draft stage and create the PR as ready for review immediately.

---

## For CircleCI AI Team

This project demonstrates:

1. **Specialized Agent Architecture**: Build Agent (coding) + CI Doctor (failure diagnosis) + Review Gate (quality automation)
2. **CI-First Pattern**: Check CI status before working, not after
3. **CI Doctor**: All-purpose CI failure debugger that receives full untruncated logs
4. **Review Gate**: Deterministic pre-push validation that eliminates preventable CI failures
5. **Smart Push + CI Cache**: Minimize CI runs AND API calls while maintaining verification
6. **Approval Gates**: Keep humans in the loop for deploy decisions
7. **Metrics Collection**: Data for analyzing agent effectiveness

The key insight: **Don't use one agent for everything. Specialize where context truly differs (CI debugging vs. coding), automate what's deterministic (linting, test validation), and keep the coding agent focused on what requires intelligence.**

---

## Contributing

1. Fork the repository
2. Create a feature branch
3. Write tests for new functionality
4. Run `pnpm test` to verify
5. Submit a pull request

When working on this codebase, use RalphCI:

```bash
ralphci scaffold -w features/your-feature
ralphci run -m 10 -w features/your-feature
```
