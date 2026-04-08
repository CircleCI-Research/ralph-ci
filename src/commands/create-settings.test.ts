import { describe, it, expect, beforeEach } from "vitest";
import { createSettings } from "./create-settings.js";
import { FileSystem } from "../utils/file-helpers.js";
import path from "path";

describe("create-settings", () => {
  let mockFs: FileSystem;
  let writtenFiles: Map<string, string>;

  beforeEach(() => {
    writtenFiles = new Map();
    mockFs = {
      exists: async (filePath: string) => {
        // Directories always exist in our mock
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
      mkdir: async () => {},
    };
  });

  it("should create .claude/settings.json and .mcp.json in working directory", async () => {
    const workingDir = "/test/dir";

    await createSettings({ workingDirectory: workingDir }, mockFs);

    const claudeSettingsPath = path.join(
      workingDir,
      ".claude",
      "settings.json",
    );
    const mcpPath = path.join(workingDir, ".mcp.json");

    expect(writtenFiles.has(claudeSettingsPath)).toBe(true);
    expect(writtenFiles.has(mcpPath)).toBe(true);
  });

  it("should create valid JSON in settings files", async () => {
    const workingDir = "/test/dir";

    await createSettings({ workingDirectory: workingDir }, mockFs);

    const claudeSettingsPath = path.join(
      workingDir,
      ".claude",
      "settings.json",
    );
    const mcpPath = path.join(workingDir, ".mcp.json");

    const claudeSettings = writtenFiles.get(claudeSettingsPath);
    const mcpSettings = writtenFiles.get(mcpPath);

    expect(() => JSON.parse(claudeSettings!)).not.toThrow();
    expect(() => JSON.parse(mcpSettings!)).not.toThrow();
  });

  it("should not overwrite existing files when force is false", async () => {
    const workingDir = "/test/dir";
    const claudeSettingsPath = path.join(
      workingDir,
      ".claude",
      "settings.json",
    );

    // Pre-populate with existing content
    writtenFiles.set(claudeSettingsPath, '{"existing": "content"}');

    await createSettings(
      { workingDirectory: workingDir, force: false },
      mockFs,
    );

    expect(writtenFiles.get(claudeSettingsPath)).toBe(
      '{"existing": "content"}',
    );
  });

  it("should overwrite existing files when force is true", async () => {
    const workingDir = "/test/dir";
    const claudeSettingsPath = path.join(
      workingDir,
      ".claude",
      "settings.json",
    );

    // Pre-populate with existing content
    writtenFiles.set(claudeSettingsPath, '{"existing": "content"}');

    await createSettings({ workingDirectory: workingDir, force: true }, mockFs);

    const newContent = writtenFiles.get(claudeSettingsPath);
    expect(newContent).not.toBe('{"existing": "content"}');
    expect(newContent).toContain("mcpServers");
  });

  it("should use current working directory when no workingDirectory option provided", async () => {
    const cwd = process.cwd();

    await createSettings({}, mockFs);

    const claudeSettingsPath = path.join(cwd, ".claude", "settings.json");
    const mcpPath = path.join(cwd, ".mcp.json");

    expect(writtenFiles.has(claudeSettingsPath)).toBe(true);
    expect(writtenFiles.has(mcpPath)).toBe(true);
  });

  it("should throw ValidationError when working directory does not exist", async () => {
    const nonExistentDir = "/non/existent/dir";
    const mockFsWithNoDir: FileSystem = {
      ...mockFs,
      exists: async (filePath: string) => {
        // Check for the specific non-existent directory first
        if (filePath === nonExistentDir) return false;
        // Directories always exist in our mock (except the non-existent one)
        if (!filePath.includes(".")) return true;
        // Files exist if they've been written
        return writtenFiles.has(filePath);
      },
    };

    await expect(
      createSettings({ workingDirectory: nonExistentDir }, mockFsWithNoDir),
    ).rejects.toThrow();
  });
});
