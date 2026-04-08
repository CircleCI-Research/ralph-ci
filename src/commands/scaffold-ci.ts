import path from "path";
import {
  ACTIVITY_CI_TEMPLATE,
  ACTIVITY_NO_CI_TEMPLATE,
  PLAN_DETAILS_TEMPLATE,
  TASKS_CI_JSON_TEMPLATE,
  TASKS_NO_CI_JSON_TEMPLATE,
  PROMPT_CI_TEMPLATE,
  PROMPT_NO_CI_TEMPLATE,
  CONFIG_CI_TEMPLATE,
  CONFIG_NO_CI_TEMPLATE,
} from "../templates/index.js";
import {
  FileSystem,
  DefaultFileSystem,
  ensureDirectory,
  writeFileIfNotExists,
} from "../utils/file-helpers.js";

export interface ScaffoldCIOptions {
  workingDirectory?: string;
  force?: boolean;
  branchStrategy?: "feature-branch" | "direct-to-main";
  approvalGate?: boolean;
  autoPush?: boolean;
  ciEnabled?: boolean; // Enable/disable CI integration (default: true)
}

export async function scaffoldCI(
  options: ScaffoldCIOptions = {},
  fs: FileSystem = new DefaultFileSystem(),
): Promise<void> {
  const workingDir = options.workingDirectory || process.cwd();
  const force = options.force || false;
  // CI is enabled by default
  const ciEnabled = options.ciEnabled !== false;

  // Create working directory if it doesn't exist
  await ensureDirectory(workingDir, fs);

  if (ciEnabled) {
    console.log("Scaffolding RalphCI workflow files (CI enabled)...\n");
  } else {
    console.log("Scaffolding RalphCI workflow files (local-only mode)...\n");
  }

  // Create activity.md (CI or local version)
  const activityPath = path.join(workingDir, "activity.md");
  const activityTemplate = ciEnabled
    ? ACTIVITY_CI_TEMPLATE
    : ACTIVITY_NO_CI_TEMPLATE;
  const activityResult = await writeFileIfNotExists(
    activityPath,
    activityTemplate,
    force,
    fs,
  );

  if (activityResult.written) {
    console.log(`✓ Created ${activityPath}`);
  } else {
    console.log(
      `⊘ Skipped ${activityPath} (already exists, use -f to overwrite)`,
    );
  }

  // Create plan.md (details only, no tasks)
  const planPath = path.join(workingDir, "plan.md");
  const planResult = await writeFileIfNotExists(
    planPath,
    PLAN_DETAILS_TEMPLATE,
    force,
    fs,
  );

  if (planResult.written) {
    console.log(`✓ Created ${planPath}`);
  } else {
    console.log(`⊘ Skipped ${planPath} (already exists, use -f to overwrite)`);
  }

  // Create tasks.json (CI or local version)
  const tasksPath = path.join(workingDir, "tasks.json");
  const tasksTemplate = ciEnabled
    ? TASKS_CI_JSON_TEMPLATE
    : TASKS_NO_CI_JSON_TEMPLATE;
  const tasksContent = JSON.stringify(tasksTemplate, null, 2) + "\n";
  const tasksResult = await writeFileIfNotExists(
    tasksPath,
    tasksContent,
    force,
    fs,
  );

  if (tasksResult.written) {
    console.log(`✓ Created ${tasksPath}`);
  } else {
    console.log(`⊘ Skipped ${tasksPath} (already exists, use -f to overwrite)`);
  }

  // Create prompt.md (CI or local version)
  const promptPath = path.join(workingDir, "prompt.md");
  const promptTemplate = ciEnabled ? PROMPT_CI_TEMPLATE : PROMPT_NO_CI_TEMPLATE;
  const promptResult = await writeFileIfNotExists(
    promptPath,
    promptTemplate,
    force,
    fs,
  );

  if (promptResult.written) {
    console.log(`✓ Created ${promptPath}`);
  } else {
    console.log(
      `⊘ Skipped ${promptPath} (already exists, use -f to overwrite)`,
    );
  }

  // Create ralphci.json with configuration
  const configPath = path.join(workingDir, "ralphci.json");
  let configContent: string;

  if (ciEnabled) {
    const ciConfig = {
      ...CONFIG_CI_TEMPLATE,
      git: {
        ...CONFIG_CI_TEMPLATE.git,
        autoPush: options.autoPush ?? CONFIG_CI_TEMPLATE.git.autoPush,
      },
      ci: {
        ...CONFIG_CI_TEMPLATE.ci,
        branchStrategy:
          options.branchStrategy || CONFIG_CI_TEMPLATE.ci.branchStrategy,
        approvalGateEnabled:
          options.approvalGate ?? CONFIG_CI_TEMPLATE.ci.approvalGateEnabled,
      },
    };
    configContent = JSON.stringify(ciConfig, null, 2) + "\n";
  } else {
    const noCIConfig = {
      ...CONFIG_NO_CI_TEMPLATE,
    };
    configContent = JSON.stringify(noCIConfig, null, 2) + "\n";
  }

  const configResult = await writeFileIfNotExists(
    configPath,
    configContent,
    force,
    fs,
  );

  if (configResult.written) {
    console.log(`✓ Created ${configPath}`);
  } else {
    console.log(
      `⊘ Skipped ${configPath} (already exists, use -f to overwrite)`,
    );
  }

  // Create screenshots/ folder
  const screenshotsDir = path.join(workingDir, "screenshots");
  await ensureDirectory(screenshotsDir, fs);
  console.log(`✓ Created ${screenshotsDir}/`);

  // Create src/ folder for agent output files
  const srcDir = path.join(workingDir, "src");
  await ensureDirectory(srcDir, fs);
  console.log(`✓ Created ${srcDir}/`);

  // Print summary and next steps
  if (ciEnabled) {
    const ciConfig = JSON.parse(configContent);
    console.log(`
─────────────────────────────────────────────────────────
RalphCI Setup Complete! (CI Enabled)
─────────────────────────────────────────────────────────

Files created:
  • activity.md  - Activity log with CI status section
  • plan.md      - Project plan and context
  • tasks.json   - Task list with CI verification tracking
  • prompt.md    - CI-aware agent instructions
  • ralphci.json - Configuration with CI settings
  • src/         - Output directory for source code

CI Configuration:
  • Provider:        ${ciConfig.ci.provider}
  • Push Strategy:   ${ciConfig.git.pushOnLocalSuccess ? "smart (only when local tests pass)" : "every commit"}
  • Approval Gate:   ${ciConfig.ci.approvalGateEnabled ? "enabled" : "disabled"}
  • Branch Strategy: ${ciConfig.ci.branchStrategy}
  • Require CI Green: ${ciConfig.ci.requireGreenBeforeComplete ? "yes" : "no"}

Agent Architecture:
  • Build Agent:   Writes code + tests (CI-aware, lighter prompt)
  • CI Doctor:     Diagnoses and fixes CI failures (ci.doctor in ralphci.json)
  • Review Gate:   Pre-push lint:fix + tests with ${ciConfig.reviewGate?.testTimeoutSeconds ?? 60}s timeout

Next Steps:
  1. Edit plan.md with your project details
  2. Edit tasks.json with your task list
  3. Ensure CircleCI MCP server is configured
  4. Run: ralphci run -m 10 -w ${workingDir}

The loop will:
  • Check CI status (cached — only queries after push)
  • If CI red → CI Doctor diagnoses + fixes → Review Gate validates
  • If CI green → Build Agent works on task → Review Gate validates
  • Review Gate runs lint:fix + tests before every push
  • Only pushes when Review Gate passes (smart push)
  • Require human approval before deploy (if approval gate enabled)
─────────────────────────────────────────────────────────
`);
  } else {
    console.log(`
─────────────────────────────────────────────────────────
RalphCI Setup Complete! (Local-Only Mode)
─────────────────────────────────────────────────────────

Files created:
  • activity.md  - Activity log
  • plan.md      - Project plan and context
  • tasks.json   - Task list
  • prompt.md    - Agent instructions
  • ralphci.json - Configuration (CI disabled)
  • src/         - Output directory for source code

Next Steps:
  1. Edit plan.md with your project details
  2. Edit tasks.json with your task list
  3. Run: ralphci run --no-ci -m 10 -w ${workingDir}

The agent will:
  • Work on one task at a time
  • Verify locally using tests
  • Commit changes with clear messages
  • Continue until all tasks complete
─────────────────────────────────────────────────────────
`);
  }
}
