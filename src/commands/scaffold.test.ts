import { describe, it, expect, beforeEach } from "vitest";
import { scaffold } from "./scaffold.js";
import { FileSystem } from "../utils/file-helpers.js";
import path from "path";

describe("scaffold", () => {
  let mockFs: FileSystem;
  let writtenFiles: Map<string, string>;
  let createdDirs: Set<string>;

  beforeEach(() => {
    writtenFiles = new Map();
    createdDirs = new Set();
    mockFs = {
      exists: async (filePath: string) => {
        // Check if it's a directory that was created
        if (createdDirs.has(filePath)) return true;
        // Parent directories always exist in our mock (for file writes)
        // But specific subdirectories like 'screenshots' don't exist until created
        const dirName = path.basename(filePath);
        if (
          dirName === "screenshots" ||
          dirName === "src" ||
          filePath.endsWith("/new/test/dir")
        ) {
          return false;
        }
        // Other directories assumed to exist
        if (!filePath.includes(".")) return true;
        // Files exist if they've been written
        return writtenFiles.has(filePath);
      },
      readFile: async (filePath: string) => {
        const content = writtenFiles.get(filePath);
        if (!content) throw new Error(`File not found: ${filePath}`);
        return content;
      },
      writeFile: async (filePath: string, content: string) => {
        writtenFiles.set(filePath, content);
      },
      mkdir: async (dirPath: string) => {
        createdDirs.add(dirPath);
      },
    };
  });

  it("should create activity.md, plan.md, prompt.md, ralphci.json, screenshots/ and src/ folders", async () => {
    const workingDir = "/test/dir";

    await scaffold({ workingDirectory: workingDir }, mockFs);

    const activityPath = path.join(workingDir, "activity.md");
    const planPath = path.join(workingDir, "plan.md");
    const promptPath = path.join(workingDir, "prompt.md");
    const configPath = path.join(workingDir, "ralphci.json");
    const screenshotsDir = path.join(workingDir, "screenshots");
    const srcDir = path.join(workingDir, "src");

    expect(writtenFiles.has(activityPath)).toBe(true);
    expect(writtenFiles.has(planPath)).toBe(true);
    expect(writtenFiles.has(promptPath)).toBe(true);
    expect(writtenFiles.has(configPath)).toBe(true);
    expect(createdDirs.has(screenshotsDir)).toBe(true);
    expect(createdDirs.has(srcDir)).toBe(true);
  });

  it("should create valid markdown content in files", async () => {
    const workingDir = "/test/dir";

    await scaffold({ workingDirectory: workingDir }, mockFs);

    const activityPath = path.join(workingDir, "activity.md");
    const planPath = path.join(workingDir, "plan.md");
    const promptPath = path.join(workingDir, "prompt.md");

    const activityContent = writtenFiles.get(activityPath);
    const planContent = writtenFiles.get(planPath);
    const promptContent = writtenFiles.get(promptPath);

    expect(activityContent).toContain("# Project Build - Activity Log");
    expect(planContent).toContain("# Project Plan");
    expect(promptContent).toContain("@plan.md @activity.md");
  });

  it("should create ralphci.json with correct content", async () => {
    const workingDir = "/test/dir";

    await scaffold({ workingDirectory: workingDir }, mockFs);

    const configPath = path.join(workingDir, "ralphci.json");
    const configContent = writtenFiles.get(configPath);

    expect(configContent).toBeDefined();
    const parsed = JSON.parse(configContent!);
    expect(parsed).toEqual({ runner: "claude" });
  });

  it("should not overwrite existing files when force is false", async () => {
    const workingDir = "/test/dir";
    const activityPath = path.join(workingDir, "activity.md");

    // Pre-populate with existing content
    writtenFiles.set(activityPath, "# My Custom Activity Log");

    await scaffold({ workingDirectory: workingDir, force: false }, mockFs);

    expect(writtenFiles.get(activityPath)).toBe("# My Custom Activity Log");
  });

  it("should overwrite existing files when force is true", async () => {
    const workingDir = "/test/dir";
    const activityPath = path.join(workingDir, "activity.md");

    // Pre-populate with existing content
    writtenFiles.set(activityPath, "# My Custom Activity Log");

    await scaffold({ workingDirectory: workingDir, force: true }, mockFs);

    const newContent = writtenFiles.get(activityPath);
    expect(newContent).not.toBe("# My Custom Activity Log");
    expect(newContent).toContain("# Project Build - Activity Log");
  });

  it("should use current working directory when no workingDirectory option provided", async () => {
    const cwd = process.cwd();

    await scaffold({}, mockFs);

    const activityPath = path.join(cwd, "activity.md");
    const planPath = path.join(cwd, "plan.md");
    const promptPath = path.join(cwd, "prompt.md");
    const configPath = path.join(cwd, "ralphci.json");
    const screenshotsDir = path.join(cwd, "screenshots");
    const srcDir = path.join(cwd, "src");

    expect(writtenFiles.has(activityPath)).toBe(true);
    expect(writtenFiles.has(planPath)).toBe(true);
    expect(writtenFiles.has(promptPath)).toBe(true);
    expect(writtenFiles.has(configPath)).toBe(true);
    expect(createdDirs.has(screenshotsDir)).toBe(true);
    expect(createdDirs.has(srcDir)).toBe(true);
  });

  it("should create working directory if it doesn't exist", async () => {
    const workingDir = "/new/test/dir";

    await scaffold({ workingDirectory: workingDir }, mockFs);

    expect(createdDirs.has(workingDir)).toBe(true);
  });

  it("should create all files even if some already exist", async () => {
    const workingDir = "/test/dir";
    const activityPath = path.join(workingDir, "activity.md");
    const planPath = path.join(workingDir, "plan.md");
    const promptPath = path.join(workingDir, "prompt.md");
    const configPath = path.join(workingDir, "ralphci.json");

    // Pre-populate only activity.md
    writtenFiles.set(activityPath, "# Existing Activity");

    await scaffold({ workingDirectory: workingDir, force: false }, mockFs);

    // activity.md should remain unchanged
    expect(writtenFiles.get(activityPath)).toBe("# Existing Activity");
    // Other files should be created
    expect(writtenFiles.has(planPath)).toBe(true);
    expect(writtenFiles.has(promptPath)).toBe(true);
    expect(writtenFiles.has(configPath)).toBe(true);
  });
});
