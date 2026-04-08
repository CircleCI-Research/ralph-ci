import * as fs from "fs";
import * as path from "path";

export interface FileSystem {
  writeFile(filePath: string, content: string): Promise<void>;
  readFile(filePath: string): Promise<string>;
  exists(filePath: string): Promise<boolean>;
  mkdir(dirPath: string, options?: { recursive?: boolean }): Promise<void>;
}

export class DefaultFileSystem implements FileSystem {
  async writeFile(filePath: string, content: string): Promise<void> {
    await fs.promises.writeFile(filePath, content, "utf-8");
  }

  async readFile(filePath: string): Promise<string> {
    return await fs.promises.readFile(filePath, "utf-8");
  }

  async exists(filePath: string): Promise<boolean> {
    try {
      await fs.promises.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async mkdir(
    dirPath: string,
    options?: { recursive?: boolean },
  ): Promise<void> {
    await fs.promises.mkdir(dirPath, options);
  }
}

export async function ensureDirectory(
  dirPath: string,
  fileSystem: FileSystem = new DefaultFileSystem(),
): Promise<void> {
  const exists = await fileSystem.exists(dirPath);
  if (!exists) {
    await fileSystem.mkdir(dirPath, { recursive: true });
  }
}

export async function writeFileIfNotExists(
  filePath: string,
  content: string,
  force: boolean = false,
  fileSystem: FileSystem = new DefaultFileSystem(),
): Promise<{ written: boolean; reason?: string }> {
  const exists = await fileSystem.exists(filePath);

  if (exists && !force) {
    return { written: false, reason: "File already exists" };
  }

  const dir = path.dirname(filePath);
  await ensureDirectory(dir, fileSystem);
  await fileSystem.writeFile(filePath, content);

  return { written: true };
}
