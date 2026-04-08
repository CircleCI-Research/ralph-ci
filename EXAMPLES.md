# Ralph Loop - Example Workflows

This document provides detailed, real-world examples of using Ralph for different development scenarios.

## Table of Contents

- [Building a New Feature from Scratch](#building-a-new-feature-from-scratch)
- [Refactoring Existing Code](#refactoring-existing-code)
- [Debugging and Fixing a Bug](#debugging-and-fixing-a-bug)
- [RalphCI: Ship with Confidence](#ralphci-ship-with-confidence)

---

## Building a New Feature from Scratch

This example demonstrates using Ralph to build a complete new feature: a user notification system.

**Scenario:** You want to add a notification system to your Node.js application that can send emails and in-app notifications to users.

### Step 1: Create the Feature Directory and Scaffold

```bash
# From your project root
mkdir -p features/notifications
ralphci scaffold -w features/notifications
```

This creates the standard Ralph loop files: `activity.md`, `plan.md`, `prompt.md`, and `screenshots/`.

### Step 2: Write the Spec

Create `spec.md` in your feature directory with your requirements:

````markdown
# User Notification System

## Project Overview

Build a flexible notification system that supports multiple delivery methods (email, in-app) and can be easily extended for future notification types (SMS, push).

## Requirements

- Send notifications via email using nodemailer
- Store in-app notifications in database (PostgreSQL)
- Mark notifications as read/unread
- Support notification templates
- Handle notification preferences per user
- Queue notifications for async delivery

## Technical Constraints

- Use TypeScript with strict mode
- Follow repository pattern for data access
- Use existing database connection pool
- Minimize dependencies (only add nodemailer)
- Must work with existing User model

## API Design

```typescript
interface NotificationService {
  send(userId: string, notification: NotificationInput): Promise<void>;
  markAsRead(notificationId: string): Promise<void>;
  getUserNotifications(userId: string): Promise<Notification[]>;
}

interface NotificationInput {
  type: "email" | "in-app";
  subject: string;
  body: string;
  template?: string;
}
```
````

## Database Schema

```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  type VARCHAR(50) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Testing & Verification

- Unit tests for NotificationService (mock email sending)
- Unit tests for NotificationRepository (database operations)
- Integration test: Create notification and verify in database
- Manual test: Send test email and verify delivery
- Build must complete with no TypeScript errors

```

### Step 3: Generate the Plan

Ask an AI assistant to create your plan:

```

Please read @spec.md and generate a plan.md file for implementing this notification system.
Break it down into 6-10 tasks with specific, actionable steps.
Include verification steps for each task.
Use the Ralph loop plan.md format with JSON task list.

````

### Step 4: Review and Customize the Generated Plan

Edit `plan.md` to ensure tasks are appropriately sized:

```markdown
# Project Plan

## Project Overview

Implement a user notification system with email and in-app delivery.

@spec.md

---

## Task List

```json
[
  {
    "category": "setup",
    "description": "Set up database schema and install dependencies",
    "steps": [
      "Install nodemailer and @types/nodemailer dependencies",
      "Create database migration file for notifications table",
      "Run migration to create notifications table in development database",
      "Verify table exists with: psql -c '\\d notifications'",
      "Run npm run build to ensure no TypeScript errors"
    ],
    "passes": false
  },
  {
    "category": "implementation",
    "description": "Create Notification entity and types",
    "steps": [
      "Create src/entities/Notification.ts with Notification interface matching database schema",
      "Create src/types/notifications.ts with NotificationInput, NotificationType types",
      "Add type exports to src/types/index.ts",
      "Run npm run build and fix any TypeScript errors",
      "Verify types are properly exported"
    ],
    "passes": false
  },
  {
    "category": "implementation",
    "description": "Implement NotificationRepository for database operations",
    "steps": [
      "Create src/repositories/NotificationRepository.ts",
      "Implement create() method to insert notifications into database",
      "Implement findByUserId() to get user's notifications",
      "Implement markAsRead() to update read status",
      "Add proper error handling and database connection usage",
      "Write unit tests in tests/repositories/NotificationRepository.test.ts",
      "Run npm test and verify NotificationRepository tests pass"
    ],
    "passes": false
  },
  {
    "category": "implementation",
    "description": "Create EmailService for sending emails",
    "steps": [
      "Create src/services/EmailService.ts",
      "Configure nodemailer transport with SMTP settings from environment variables",
      "Implement sendEmail() method with error handling",
      "Add email template rendering support",
      "Write unit tests with mocked nodemailer in tests/services/EmailService.test.ts",
      "Run npm test and verify EmailService tests pass"
    ],
    "passes": false
  },
  {
    "category": "implementation",
    "description": "Implement NotificationService orchestration layer",
    "steps": [
      "Create src/services/NotificationService.ts",
      "Implement send() method that handles both email and in-app notifications",
      "Use NotificationRepository for in-app notifications",
      "Use EmailService for email notifications",
      "Implement getUserNotifications() and markAsRead() methods",
      "Add proper error handling and logging",
      "Write unit tests in tests/services/NotificationService.test.ts",
      "Run npm test and verify NotificationService tests pass"
    ],
    "passes": false
  },
  {
    "category": "integration",
    "description": "Add API routes for notifications",
    "steps": [
      "Create src/routes/notifications.ts",
      "Add POST /api/notifications route to send notification",
      "Add GET /api/notifications route to get user notifications",
      "Add PATCH /api/notifications/:id/read route to mark as read",
      "Add authentication middleware to protect routes",
      "Register routes in src/app.ts",
      "Run npm run build and verify no TypeScript errors"
    ],
    "passes": false
  },
  {
    "category": "testing",
    "description": "Write integration tests",
    "steps": [
      "Create tests/integration/notifications.test.ts",
      "Test creating in-app notification and verifying it's stored in database",
      "Test sending email notification (mock SMTP)",
      "Test retrieving user notifications",
      "Test marking notification as read",
      "Run npm test and verify all integration tests pass"
    ],
    "passes": false
  },
  {
    "category": "verification",
    "description": "Manual testing and documentation",
    "steps": [
      "Start the application in development mode",
      "Send a test email notification via API and verify email delivery",
      "Send a test in-app notification and verify it appears in GET endpoint",
      "Test marking notification as read",
      "Update API documentation with new notification endpoints",
      "Run npm run build and npm test to verify everything still works"
    ],
    "passes": false
  }
]
````

````

### Step 5: Run the Loop

```bash
# From project root, run the loop
ralphci run -w features/notifications -m 15
````

### Expected Output

```
Iteration 1/15
[Claude sets up database schema and installs nodemailer]
Input tokens: 12453
Output tokens: 1876
Cost this iteration: $0.089
Cumulative cost: $0.089

Iteration 2/15
[Claude creates Notification entity and types]
Input tokens: 14231
Output tokens: 1234
Cost this iteration: $0.078
Cumulative cost: $0.167

...

Iteration 8/15
[Claude completes final verification task]
Input tokens: 18492
Output tokens: 987
Cost this iteration: $0.091
Cumulative cost: $0.634

<promise>COMPLETE</promise>

✓ Ralph loop completed successfully!
Total iterations: 8
Total cost: $0.634
```

### Review the Results

After completion, check:

- `features/notifications/activity.md` - Detailed log of what was implemented
- `git log` - Incremental commits for each task
- Run `npm test` - All tests should pass
- Check `src/` - New files created for the notification system

### Key Takeaways

- **Complete workflow**: From requirements to working implementation
- **Feature isolation**: Using working directory for feature-specific loop files
- **AI-assisted planning**: Letting AI help break down the spec into tasks
- **Incremental development**: Each task builds on previous ones
- **Self-verification**: Claude tests its own work at each step
- **Cost tracking**: See exactly how much the implementation costs

---

## Refactoring Existing Code

This example demonstrates using Ralph to refactor existing code with dependent tasks that build on each other.

**Scenario:** You have an Express.js API with inconsistent error handling scattered across route handlers. You want to refactor it to use a centralized error handling system.

### Step 1: Create the Feature Directory and Scaffold

```bash
# From your project root
mkdir -p features/error-handling-refactor
ralphci scaffold -w features/error-handling-refactor
```

This creates the standard Ralph loop files in your feature directory.

### Step 2: Write the Spec

Create `spec.md` in your feature directory describing the refactoring goals:

````markdown
# Centralized Error Handling Refactor

## Project Overview

Refactor the Express API to use a consistent, centralized error handling pattern with custom error classes and middleware.

## Current State vs Target State

**Current:**

- Error handling is inconsistent across routes
- Some routes send raw error messages
- Error responses have different formats
- Stack traces sometimes leak to clients

**Target:**

- Custom AppError class for operational errors
- Centralized error handling middleware
- Consistent error response format
- Proper logging of errors
- Stack traces only in development mode

## Technical Approach

### Custom Error Class

```typescript
class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public isOperational: boolean = true,
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
  }
}
```
````

### Error Response Format

```typescript
interface ErrorResponse {
  status: "error";
  statusCode: number;
  message: string;
  stack?: string; // only in development
}
```

## Migration Strategy

1. Create custom error class and middleware
2. Update one route file at a time
3. Test each route after migration
4. Remove old error handling code

## Files to Modify

- Create: src/errors/AppError.ts
- Create: src/middleware/errorHandler.ts
- Update: src/routes/users.ts, posts.ts, comments.ts
- Update: src/app.ts (register middleware)

````

### Step 3: Generate the Plan and Run

Generate your plan using an AI assistant, then edit `features/error-handling-refactor/plan.md` with the generated tasks:

```bash
ralphci run -w features/error-handling-refactor -m 12
````

### Key Takeaways

- **Sequential dependencies**: Tasks build on each other (create classes → create middleware → use in routes)
- **Incremental refactoring**: One route file at a time, not everything at once
- **Test-driven changes**: Update tests alongside code changes
- **Risk mitigation**: Verify each step before moving to the next

---

## Debugging and Fixing a Bug

This example demonstrates using Ralph to systematically investigate, fix, and verify a bug.

**Scenario:** Users are reporting that the shopping cart occasionally loses items when they navigate away and come back. The bug is intermittent and you need to investigate the root cause.

### Step 1: Create the Feature Directory and Scaffold

```bash
mkdir -p features/cart-bug-fix
ralphci scaffold -w features/cart-bug-fix
```

This creates the standard Ralph loop files in your feature directory.

### Step 2: Write the Spec

Create `spec.md` in your feature directory documenting the bug and investigation approach:

```markdown
# Shopping Cart Persistence Bug Fix

## Problem Statement

Users report that items in their shopping cart sometimes disappear when they:

- Navigate to other pages and return
- Refresh the page
- Close and reopen the browser

## Current Implementation

The shopping cart uses:

- React Context API for state management
- localStorage for persistence
- useEffect hook to sync cart to localStorage

## Suspected Issues

1. **Race condition**: localStorage updates may not complete before page unload
2. **Serialization issues**: Complex cart items may not serialize correctly
3. **Context reset timing**: CartContext may initialize before localStorage loads

## Investigation Tasks

1. Review localStorage sync logic in CartContext
2. Check for race conditions in useEffect dependencies
3. Verify error handling around localStorage operations
4. Add logging to track when cart data is written/read

## Testing Strategy

- Unit tests with mocked localStorage
- Manual testing: add items → navigate → refresh → verify persistence
- Test with localStorage disabled (graceful degradation)
```

### Step 3: Generate the Plan and Run

Generate your plan with an AI assistant (investigation tasks first, then fix tasks), edit `features/cart-bug-fix/plan.md`, then run:

```bash
ralphci run -w features/cart-bug-fix -m 15
```

### Key Takeaways

- **Structured debugging**: Investigation tasks before fix tasks
- **Root cause analysis**: Understanding the problem before applying fixes
- **Incremental fixes**: Small, testable changes rather than big rewrites
- **Activity logging**: Full debugging trail captured in activity.md
- **Debug instrumentation**: Adding temporary logging to understand behavior

### After Completion

Check `features/cart-bug-fix/activity.md` for:

- Root cause identified (e.g., "Race condition in useEffect")
- Specific code issues found with line numbers
- Description of the fix applied
- Test results for each scenario

---

## RalphCI: Ship with Confidence

This example demonstrates using **RalphCI** to build a feature with full CircleCI integration, ensuring production readiness.

**Scenario:** You're building an authentication feature that must pass both local tests AND your CI/CD pipeline before being considered complete.

### Step 1: Set Up CircleCI MCP Server

Ensure you have the CircleCI MCP server configured. This enables the agent to query CI status during the loop.

### Step 2: Create the Feature Directory and Scaffold

```bash
# From your project root
mkdir -p features/auth-system
ralphci scaffold-ci -w features/auth-system
```

This creates CI-aware files including a `ralphci.json` with CI configuration:

```json
{
  "runner": "claude",
  "git": {
    "autoPush": true,
    "pushOnLocalSuccess": true
  },
  "ci": {
    "enabled": true,
    "provider": "circleci",
    "waitForCI": true,
    "maxCIWaitSeconds": 300,
    "requireGreenBeforeComplete": true,
    "approvalGateEnabled": true,
    "branchStrategy": "feature-branch"
  }
}
```

### Step 3: Write the Spec

Create `spec.md` in your feature directory:

```markdown
# User Authentication System

## Project Overview

Implement secure user authentication with JWT tokens, requiring validation in CI.

## Requirements

- User registration with email/password
- Login returning JWT token
- Password hashing with bcrypt
- Token validation middleware
- Integration tests that run in CI

## CI Requirements

- All unit tests must pass
- Integration tests must pass against CI database
- Security scanning must pass
- Code coverage > 80%

## Technical Constraints

- Use existing database connection
- Follow existing error handling patterns
- Must pass CI pipeline before merge
```

### Step 4: Create Tasks

Edit `tasks.json`:

```json
[
  {
    "category": "setup",
    "description": "Set up auth module structure and dependencies",
    "steps": [
      "Create src/auth/ directory structure",
      "Install bcrypt and jsonwebtoken",
      "Add types for auth module",
      "Run local build - verify no errors"
    ],
    "passes": false,
    "ciVerified": false
  },
  {
    "category": "implementation",
    "description": "Implement user registration",
    "steps": [
      "Create registerUser function with password hashing",
      "Add input validation with Zod",
      "Write unit tests",
      "Run local tests - verify all pass"
    ],
    "passes": false,
    "ciVerified": false
  },
  {
    "category": "implementation",
    "description": "Implement login and JWT generation",
    "steps": [
      "Create loginUser function",
      "Implement JWT token generation",
      "Write unit tests for login flow",
      "Run local tests - verify all pass"
    ],
    "passes": false,
    "ciVerified": false
  },
  {
    "category": "integration",
    "description": "Add integration tests for CI",
    "steps": [
      "Create integration test suite",
      "Test full registration -> login flow",
      "Ensure tests work with CI database config",
      "Run local tests, then push and verify CI passes"
    ],
    "passes": false,
    "ciVerified": false
  }
]
```

### Step 5: Run the CI-Aware Loop

```bash
ralphci run-ci -m 15 -w features/auth-system
```

### What Happens During the Loop

**Each iteration, the agent:**

1. **Queries CircleCI first** using MCP tools:

   ```
   ## CI Status Check - 2026-01-30T10:15:00Z
   - Pipeline: running
   - Failed tests: none yet
   - Decision: Continue with planned task while CI completes
   ```

2. **Makes decisions based on CI state:**
   - If CI is red: Prioritizes fixing CI before continuing with planned work
   - If CI is green: Proceeds with next task
   - If CI is running: Continues local work, monitors progress

3. **Auto-pushes after commits** (triggering new CI builds)

4. **Records everything in activity.md** with CI context

### Example Activity Log Entry

```markdown
## 2026-01-30 - Iteration 4

### CI Status Check

- Pipeline: failed
- Failed tests: tests/integration/auth.test.ts::should_handle_duplicate_email
- Key failure: Unique constraint violation not caught
- Decision: Fix CI failure before proceeding with login implementation

### Work Performed

- Investigated CI failure logs
- Found: duplicate email registration returns 500 instead of 400
- Added proper error handling for unique constraint violation
- Local tests: all pass (including new test for duplicate email)

### Outcome

- Committed fix: "fix: handle duplicate email registration gracefully"
- Auto-pushed to trigger CI
- Expecting CI to pass on next run
```

### Step 6: Approval Gate

When all tasks complete AND CI is green, the loop pauses:

```
✓ All tasks completed!
Verifying CI is green before declaring complete...

🚦 APPROVAL GATE: All tasks complete. Ready for human review before deploy.
Review the changes and approve the deployment when ready.

Metrics saved to features/auth-system/metrics.json
```

### Step 7: Review Metrics

Check `metrics.json` for experiment data:

```json
{
  "startTime": "2026-01-30T10:00:00Z",
  "endTime": "2026-01-30T11:30:00Z",
  "summary": {
    "totalIterations": 12,
    "totalTokens": 185000,
    "totalCost": 2.15,
    "ciQueriesTotal": 12,
    "ciFailuresEncountered": 3,
    "ciFailuresFixed": 3,
    "tasksCompleted": 4,
    "totalDurationMs": 5400000
  }
}
```

### Key Takeaways

- **CI-first approach**: Agent checks CI at the start of every iteration
- **CI failures take priority**: Real production blockers get fixed first
- **Auto-push**: No manual git operations needed
- **Approval gate**: Human stays in the loop for deploy decisions
- **Full audit trail**: activity.md captures CI context for every iteration
- **Metrics collection**: Data for analyzing agent effectiveness

### Variations

**Full CD (no approval gate):**

```bash
ralphci run-ci -m 15 --no-approval-gate -w features/auth-system
```

**Direct to main (skip feature branch):**

```bash
ralphci run-ci -m 15 --branch-strategy direct-to-main -w features/auth-system
```

**Unlimited iterations (careful!):**

```bash
ralphci run-ci --unlimited -w features/auth-system
```

---

## Tips for All Workflows

1. **Start with a detailed spec**: The better your spec, the better the generated plan
2. **Review AI-generated plans carefully**: Before running the loop
3. **Set max-iterations higher than needed**: You can always stop early
4. **Monitor progress**: Check activity.md between iterations if desired
5. **Use git for reviews**: Each task gets a commit for easy review
6. **Adjust and resume**: If a task fails, modify plan.md and run again

## Tips for RalphCI

7. **Ensure MCP server is configured**: The agent needs CircleCI MCP tools
8. **Use feature branches**: Default branch strategy isolates experimental work
9. **Keep approval gate enabled**: Until you trust the agent's judgment fully
10. **Review metrics**: Learn from iteration counts and CI failure patterns
11. **CI failures are learning opportunities**: Tune your prompts based on common failures
