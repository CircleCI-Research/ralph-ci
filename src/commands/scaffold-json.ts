import path from "path";
import {
  ACTIVITY_TEMPLATE,
  PLAN_DETAILS_TEMPLATE,
  TASKS_JSON_TEMPLATE,
  PROMPT_JSON_TEMPLATE,
  CONFIG_TEMPLATE,
} from "../templates/index.js";
import {
  FileSystem,
  DefaultFileSystem,
  ensureDirectory,
  writeFileIfNotExists,
} from "../utils/file-helpers.js";

export interface ScaffoldJsonOptions {
  workingDirectory?: string;
  force?: boolean;
}

export async function scaffoldJson(
  options: ScaffoldJsonOptions = {},
  fs: FileSystem = new DefaultFileSystem(),
): Promise<void> {
  const workingDir = options.workingDirectory || process.cwd();
  const force = options.force || false;

  // Create working directory if it doesn't exist (scaffold creates it)
  await ensureDirectory(workingDir, fs);

  // Create activity.md
  const activityPath = path.join(workingDir, "activity.md");
  const activityResult = await writeFileIfNotExists(
    activityPath,
    ACTIVITY_TEMPLATE,
    force,
    fs,
  );

  if (activityResult.written) {
    console.log(`Created ${activityPath}`);
  } else {
    console.log(
      `Skipped ${activityPath} (already exists, use -f to overwrite)`,
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
    console.log(`Created ${planPath}`);
  } else {
    console.log(`Skipped ${planPath} (already exists, use -f to overwrite)`);
  }

  // Create tasks.json
  const tasksPath = path.join(workingDir, "tasks.json");
  const tasksContent = JSON.stringify(TASKS_JSON_TEMPLATE, null, 2) + "\n";
  const tasksResult = await writeFileIfNotExists(
    tasksPath,
    tasksContent,
    force,
    fs,
  );

  if (tasksResult.written) {
    console.log(`Created ${tasksPath}`);
  } else {
    console.log(`Skipped ${tasksPath} (already exists, use -f to overwrite)`);
  }

  // Create prompt.md
  const promptPath = path.join(workingDir, "prompt.md");
  const promptResult = await writeFileIfNotExists(
    promptPath,
    PROMPT_JSON_TEMPLATE,
    force,
    fs,
  );

  if (promptResult.written) {
    console.log(`Created ${promptPath}`);
  } else {
    console.log(`Skipped ${promptPath} (already exists, use -f to overwrite)`);
  }

  // Create ralphci.json
  const configPath = path.join(workingDir, "ralphci.json");
  const configContent = JSON.stringify(CONFIG_TEMPLATE, null, 2);
  const configResult = await writeFileIfNotExists(
    configPath,
    configContent,
    force,
    fs,
  );

  if (configResult.written) {
    console.log(`Created ${configPath}`);
  } else {
    console.log(`Skipped ${configPath} (already exists, use -f to overwrite)`);
  }

  // Create screenshots/ folder
  const screenshotsDir = path.join(workingDir, "screenshots");
  await ensureDirectory(screenshotsDir, fs);
  console.log(`Created ${screenshotsDir}`);

  // Create src/ folder for agent output files
  const srcDir = path.join(workingDir, "src");
  await ensureDirectory(srcDir, fs);
  console.log(`Created ${srcDir}/`);
}
