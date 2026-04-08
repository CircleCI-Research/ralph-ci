import { describe, it, expect, vi } from "vitest";
import {
  validateWorkingDirectory,
  validateRequiredFiles,
} from "./validation.js";
import { FileSystem } from "./file-helpers.js";
import { ValidationError } from "./errors.js";

describe("validation", () => {
  describe("validateWorkingDirectory", () => {
    it("should pass if directory exists", async () => {
      const mockFs: FileSystem = {
        exists: vi.fn().mockResolvedValue(true),
        mkdir: vi.fn(),
        writeFile: vi.fn(),
        readFile: vi.fn(),
      };

      await validateWorkingDirectory("/test/dir", mockFs);
      expect(mockFs.exists).toHaveBeenCalledWith("/test/dir");
    });

    it("should throw ValidationError if directory does not exist", async () => {
      const mockFs: FileSystem = {
        exists: vi.fn().mockResolvedValue(false),
        mkdir: vi.fn(),
        writeFile: vi.fn(),
        readFile: vi.fn(),
      };

      await expect(
        validateWorkingDirectory("/test/dir", mockFs),
      ).rejects.toThrow(ValidationError);
      await expect(
        validateWorkingDirectory("/test/dir", mockFs),
      ).rejects.toThrow("Working directory does not exist: /test/dir");
    });
  });

  describe("validateRequiredFiles", () => {
    it("should return valid true when all files exist", async () => {
      const mockFs: FileSystem = {
        exists: vi.fn().mockResolvedValue(true),
        mkdir: vi.fn(),
        writeFile: vi.fn(),
        readFile: vi.fn(),
      };

      const result = await validateRequiredFiles(
        "/test/dir",
        ["file1.txt", "file2.txt"],
        mockFs,
      );

      expect(result.valid).toBe(true);
      expect(result.missing).toEqual([]);
    });

    it("should return valid false and list missing files", async () => {
      const mockFs: FileSystem = {
        exists: vi
          .fn()
          .mockResolvedValueOnce(true) // file1.txt exists
          .mockResolvedValueOnce(false) // file2.txt missing
          .mockResolvedValueOnce(false), // file3.txt missing
        mkdir: vi.fn(),
        writeFile: vi.fn(),
        readFile: vi.fn(),
      };

      const result = await validateRequiredFiles(
        "/test/dir",
        ["file1.txt", "file2.txt", "file3.txt"],
        mockFs,
      );

      expect(result.valid).toBe(false);
      expect(result.missing).toEqual(["file2.txt", "file3.txt"]);
    });

    it("should handle empty file list", async () => {
      const mockFs: FileSystem = {
        exists: vi.fn(),
        mkdir: vi.fn(),
        writeFile: vi.fn(),
        readFile: vi.fn(),
      };

      const result = await validateRequiredFiles("/test/dir", [], mockFs);

      expect(result.valid).toBe(true);
      expect(result.missing).toEqual([]);
      expect(mockFs.exists).not.toHaveBeenCalled();
    });
  });
});
