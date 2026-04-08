@plan.md @activity.md @tasks.json

# Development Loop (Local-Only Mode)

You are an AI assistant working in a local development loop.
CI integration is disabled - focus on local testing and verification.

## Instructions

1. Read activity.md to understand current state and recent work
2. Study plan.md for project context and details
3. Review the current task provided by the CLI below
4. Work on exactly ONE task: complete all steps
5. Run local tests to verify
6. Update activity.md with your changes and test results
7. Make one git commit with a clear message

IMPORTANT: Do NOT edit tasks.json directly. The CLI manages task completion status.

## Current Task

The CLI will insert the current task details here when invoking the agent.

## Success Signals

Output one of these signals based on outcome:

- `<promise>success</promise>` - Task complete, local tests PASS
- `<promise>needs-human</promise>` - Stuck on an issue that needs human review
- `<promise>COMPLETE</promise>` - ALL tasks done

## Activity Log Format

Each entry should include:

1. Task description
2. Work performed
3. Local test results
4. Outcome

Example entry:

```
## 2026-01-30 - Iteration 3

### Work Performed
- Implemented user authentication endpoint
- Added JWT token validation
- Created unit tests for auth module

### Test Results
- All unit tests pass (15/15)
- Integration test passes

### Outcome
- Committed: "feat: add user authentication endpoint"
- Task complete
```

## Dependencies

Reduce dependencies when possible. Use only well known dependencies.

## Output Directory

**IMPORTANT**: All source code and implementation files MUST be created in the `src/` folder.
The workflow files (activity.md, plan.md, tasks.json, etc.) stay at the root level.

Example:

- `src/index.html` - Your HTML files
- `src/style.css` - Your CSS files
- `src/game.js` - Your JavaScript files
- `src/README.md` - Project-specific documentation

## Running Tests

**ALWAYS use `pnpm test:run`** (single run, exits when done).
**NEVER use `pnpm test`** — it launches vitest in watch mode, which will hang indefinitely waiting for file changes and block the entire iteration.

## Test Timeout Policy

Tests are protected by **two layers of timeout**:

1. **Per-test timeout (10s)** — configured in `vitest.config.ts` via `testTimeout: 10_000`. Any single test that takes longer than 10 seconds will fail with a timeout error.
2. **Hard process timeout (120s)** — `pnpm test:run` wraps vitest with `scripts/run-with-timeout.mjs`. If the entire test suite exceeds 120 seconds, the process is killed with exit code 124.

### When tests timeout, you MUST:

1. **Do NOT simply re-run and hope it passes.** A timeout means something is wrong.
2. **Identify the hanging/slow test** from the vitest output (look for `0/N` progress or the last test that was running).
3. **Fix the root cause.** Common causes:
   - Non-deterministic loops (e.g., `while` loops with `Math.random` that may take unbounded iterations) — use deterministic fakes instead
   - Unresolved promises or forgotten `await` — ensure all async tests resolve
   - Real timers (`setTimeout`/`setInterval`) in production code triggered during import — guard with `typeof document` / environment checks, or mock timers in tests
   - Module-level side effects in imported files — isolate side effects behind guards
4. **Make tests deterministic.** Never rely on `Math.random` or real network calls in tests. Always inject fakes/mocks.
5. **Run `pnpm test:run` again** to verify the fix before continuing with your task.

### Writing good tests

- Each test should complete in < 100ms. If it takes longer, you're doing too much.
- Use `vi.useFakeTimers()` when testing code with timers.
- Use deterministic random functions (e.g., `() => 0.5`) instead of `Math.random`.
- Never spawn real child processes or make real HTTP calls in unit tests.
- Prefer testing pure functions over side-effectful code.

## Important Notes

- Focus on local testing and verification
- Each task should be a complete, reviewable unit of work
- Make meaningful commits with clear messages
