import path from "path";
import {
  CLAUDE_SETTINGS_TEMPLATE,
  MCP_SETTINGS_TEMPLATE,
} from "../templates/index.js";
import {
  FileSystem,
  DefaultFileSystem,
  ensureDirectory,
  writeFileIfNotExists,
} from "../utils/file-helpers.js";
import { validateWorkingDirectory } from "../utils/validation.js";

export interface CreateSettingsOptions {
  workingDirectory?: string;
  force?: boolean;
}

export async function createSettings(
  options: CreateSettingsOptions = {},
  fs: FileSystem = new DefaultFileSystem(),
): Promise<void> {
  const workingDir = options.workingDirectory || process.cwd();
  const force = options.force || false;

  // Validate working directory exists
  await validateWorkingDirectory(workingDir, fs);

  // Ensure .claude directory exists
  const claudeDir = path.join(workingDir, ".claude");
  await ensureDirectory(claudeDir, fs);

  // Create .claude/settings.json
  const claudeSettingsPath = path.join(claudeDir, "settings.json");
  const claudeSettingsContent = JSON.stringify(
    CLAUDE_SETTINGS_TEMPLATE,
    null,
    2,
  );
  const claudeResult = await writeFileIfNotExists(
    claudeSettingsPath,
    claudeSettingsContent,
    force,
    fs,
  );

  if (claudeResult.written) {
    console.log(`Created ${claudeSettingsPath}`);
  } else {
    console.log(
      `Skipped ${claudeSettingsPath} (already exists, use -f to overwrite)`,
    );
  }

  // Create .mcp.json
  const mcpPath = path.join(workingDir, ".mcp.json");
  const mcpContent = JSON.stringify(MCP_SETTINGS_TEMPLATE, null, 2);
  const mcpResult = await writeFileIfNotExists(mcpPath, mcpContent, force, fs);

  if (mcpResult.written) {
    console.log(`Created ${mcpPath}`);
  } else {
    console.log(`Skipped ${mcpPath} (already exists, use -f to overwrite)`);
  }
}
