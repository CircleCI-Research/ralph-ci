import { describe, it, expect, beforeEach } from "vitest";
import { scaffoldJson } from "./scaffold-json.js";
import { FileSystem } from "../utils/file-helpers.js";
import path from "path";

describe("scaffold-json", () => {
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

  it("should create activity.md, plan.md, tasks.json, prompt.md, ralphci.json, screenshots/ and src/ folders", async () => {
    const workingDir = "/test/dir";

    await scaffoldJson({ workingDirectory: workingDir }, mockFs);

    const activityPath = path.join(workingDir, "activity.md");
    const planPath = path.join(workingDir, "plan.md");
    const tasksPath = path.join(workingDir, "tasks.json");
    const promptPath = path.join(workingDir, "prompt.md");
    const configPath = path.join(workingDir, "ralphci.json");
    const screenshotsDir = path.join(workingDir, "screenshots");
    const srcDir = path.join(workingDir, "src");

    expect(writtenFiles.has(activityPath)).toBe(true);
    expect(writtenFiles.has(planPath)).toBe(true);
    expect(writtenFiles.has(tasksPath)).toBe(true);
    expect(writtenFiles.has(promptPath)).toBe(true);
    expect(writtenFiles.has(configPath)).toBe(true);
    expect(createdDirs.has(screenshotsDir)).toBe(true);
    expect(createdDirs.has(srcDir)).toBe(true);
  });

  it("should create plan.md with details-only content (no embedded tasks)", async () => {
    const workingDir = "/test/dir";

    await scaffoldJson({ workingDirectory: workingDir }, mockFs);

    const planPath = path.join(workingDir, "plan.md");
    const planContent = writtenFiles.get(planPath);

    expect(planContent).toContain("# Project Plan");
    expect(planContent).toContain("## Project Overview");
    expect(planContent).toContain("## Additional Context");
    // Should NOT contain embedded task list
    expect(planContent).not.toContain("## Task List");
    expect(planContent).not.toContain("```json");
  });

  it("should create tasks.json with valid JSON array structure", async () => {
    const workingDir = "/test/dir";

    await scaffoldJson({ workingDirectory: workingDir }, mockFs);

    const tasksPath = path.join(workingDir, "tasks.json");
    const tasksContent = writtenFiles.get(tasksPath);

    expect(tasksContent).toBeDefined();
    const parsed = JSON.parse(tasksContent!);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBeGreaterThan(0);

    // Verify first task has required fields
    const firstTask = parsed[0];
    expect(firstTask).toHaveProperty("category");
    expect(firstTask).toHaveProperty("description");
    expect(firstTask).toHaveProperty("steps");
    expect(firstTask).toHaveProperty("passes");
    expect(Array.isArray(firstTask.steps)).toBe(true);
    expect(typeof firstTask.passes).toBe("boolean");
  });

  it("should create tasks.json with trailing newline", async () => {
    const workingDir = "/test/dir";

    await scaffoldJson({ workingDirectory: workingDir }, mockFs);

    const tasksPath = path.join(workingDir, "tasks.json");
    const tasksContent = writtenFiles.get(tasksPath);

    expect(tasksContent).toBeDefined();
    expect(tasksContent!.endsWith("\n")).toBe(true);
  });

  it("should create prompt.md with @tasks.json reference", async () => {
    const workingDir = "/test/dir";

    await scaffoldJson({ workingDirectory: workingDir }, mockFs);

    const promptPath = path.join(workingDir, "prompt.md");
    const promptContent = writtenFiles.get(promptPath);

    expect(promptContent).toContain("@plan.md");
    expect(promptContent).toContain("@activity.md");
    expect(promptContent).toContain("@tasks.json");
    expect(promptContent).toContain("Do NOT edit tasks.json");
    expect(promptContent).toContain("<promise>success</promise>");
    expect(promptContent).toContain("Do NOT create git commits or push");
  });

  it("should create ralphci.json with correct content", async () => {
    const workingDir = "/test/dir";

    await scaffoldJson({ workingDirectory: workingDir }, mockFs);

    const configPath = path.join(workingDir, "ralphci.json");
    const configContent = writtenFiles.get(configPath);

    expect(configContent).toBeDefined();
    const parsed = JSON.parse(configContent!);
    expect(parsed).toEqual({ runner: "claude" });
  });

  it("should not overwrite existing files when force is false", async () => {
    const workingDir = "/test/dir";
    const tasksPath = path.join(workingDir, "tasks.json");

    // Pre-populate with existing content
    writtenFiles.set(tasksPath, '["custom task"]\n');

    await scaffoldJson({ workingDirectory: workingDir, force: false }, mockFs);

    expect(writtenFiles.get(tasksPath)).toBe('["custom task"]\n');
  });

  it("should overwrite existing files when force is true", async () => {
    const workingDir = "/test/dir";
    const tasksPath = path.join(workingDir, "tasks.json");

    // Pre-populate with existing content
    writtenFiles.set(tasksPath, '["custom task"]\n');

    await scaffoldJson({ workingDirectory: workingDir, force: true }, mockFs);

    const newContent = writtenFiles.get(tasksPath);
    expect(newContent).not.toBe('["custom task"]\n');
    expect(() => JSON.parse(newContent!)).not.toThrow();
  });

  it("should use current working directory when no workingDirectory option provided", async () => {
    const cwd = process.cwd();

    await scaffoldJson({}, mockFs);

    const activityPath = path.join(cwd, "activity.md");
    const planPath = path.join(cwd, "plan.md");
    const tasksPath = path.join(cwd, "tasks.json");
    const promptPath = path.join(cwd, "prompt.md");
    const configPath = path.join(cwd, "ralphci.json");
    const screenshotsDir = path.join(cwd, "screenshots");
    const srcDir = path.join(cwd, "src");

    expect(writtenFiles.has(activityPath)).toBe(true);
    expect(writtenFiles.has(planPath)).toBe(true);
    expect(writtenFiles.has(tasksPath)).toBe(true);
    expect(writtenFiles.has(promptPath)).toBe(true);
    expect(writtenFiles.has(configPath)).toBe(true);
    expect(createdDirs.has(screenshotsDir)).toBe(true);
    expect(createdDirs.has(srcDir)).toBe(true);
  });

  it("should create working directory if it doesn't exist", async () => {
    const workingDir = "/new/test/dir";

    await scaffoldJson({ workingDirectory: workingDir }, mockFs);

    expect(createdDirs.has(workingDir)).toBe(true);
  });

  it("should create all files even if some already exist", async () => {
    const workingDir = "/test/dir";
    const activityPath = path.join(workingDir, "activity.md");
    const planPath = path.join(workingDir, "plan.md");
    const tasksPath = path.join(workingDir, "tasks.json");
    const promptPath = path.join(workingDir, "prompt.md");
    const configPath = path.join(workingDir, "ralphci.json");

    // Pre-populate only activity.md
    writtenFiles.set(activityPath, "# Existing Activity");

    await scaffoldJson({ workingDirectory: workingDir, force: false }, mockFs);

    // activity.md should remain unchanged
    expect(writtenFiles.get(activityPath)).toBe("# Existing Activity");
    // Other files should be created
    expect(writtenFiles.has(planPath)).toBe(true);
    expect(writtenFiles.has(tasksPath)).toBe(true);
    expect(writtenFiles.has(promptPath)).toBe(true);
    expect(writtenFiles.has(configPath)).toBe(true);
  });
});
