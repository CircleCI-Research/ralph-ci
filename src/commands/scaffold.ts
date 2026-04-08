import path from "path";
import {
  ACTIVITY_TEMPLATE,
  PLAN_TEMPLATE,
  PROMPT_TEMPLATE,
  CONFIG_TEMPLATE,
} from "../templates/index.js";
import {
  FileSystem,
  DefaultFileSystem,
  ensureDirectory,
  writeFileIfNotExists,
} from "../utils/file-helpers.js";

export interface ScaffoldOptions {
  workingDirectory?: string;
  force?: boolean;
}

export async function scaffold(
  options: ScaffoldOptions = {},
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

  // Create plan.md
  const planPath = path.join(workingDir, "plan.md");
  const planResult = await writeFileIfNotExists(
    planPath,
    PLAN_TEMPLATE,
    force,
    fs,
  );

  if (planResult.written) {
    console.log(`Created ${planPath}`);
  } else {
    console.log(`Skipped ${planPath} (already exists, use -f to overwrite)`);
  }

  // Create prompt.md
  const promptPath = path.join(workingDir, "prompt.md");
  const promptResult = await writeFileIfNotExists(
    promptPath,
    PROMPT_TEMPLATE,
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
