import * as path from "path";
import { FileSystem, DefaultFileSystem } from "./file-helpers.js";
import { ValidationError } from "./errors.js";

export async function validateWorkingDirectory(
  workingDir: string,
  fileSystem: FileSystem = new DefaultFileSystem(),
): Promise<void> {
  const exists = await fileSystem.exists(workingDir);
  if (!exists) {
    throw new ValidationError(
      `Working directory does not exist: ${workingDir}`,
    );
  }
}

export async function validateRequiredFiles(
  workingDir: string,
  requiredFiles: string[],
  fileSystem: FileSystem = new DefaultFileSystem(),
): Promise<{ valid: boolean; missing: string[] }> {
  const missing: string[] = [];

  for (const file of requiredFiles) {
    const filePath = path.join(workingDir, file);
    const exists = await fileSystem.exists(filePath);
    if (!exists) {
      missing.push(file);
    }
  }

  return {
    valid: missing.length === 0,
    missing,
  };
}
