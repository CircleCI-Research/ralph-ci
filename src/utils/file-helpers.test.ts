import { describe, it, expect, vi } from "vitest";
import {
  ensureDirectory,
  writeFileIfNotExists,
  FileSystem,
} from "./file-helpers.js";

describe("file-helpers", () => {
  describe("ensureDirectory", () => {
    it("should create directory if it does not exist", async () => {
      const mockFs: FileSystem = {
        exists: vi.fn().mockResolvedValue(false),
        mkdir: vi.fn().mockResolvedValue(undefined),
        writeFile: vi.fn(),
        readFile: vi.fn(),
      };

      await ensureDirectory("/test/dir", mockFs);

      expect(mockFs.exists).toHaveBeenCalledWith("/test/dir");
      expect(mockFs.mkdir).toHaveBeenCalledWith("/test/dir", {
        recursive: true,
      });
    });

    it("should not create directory if it already exists", async () => {
      const mockFs: FileSystem = {
        exists: vi.fn().mockResolvedValue(true),
        mkdir: vi.fn(),
        writeFile: vi.fn(),
        readFile: vi.fn(),
      };

      await ensureDirectory("/test/dir", mockFs);

      expect(mockFs.exists).toHaveBeenCalledWith("/test/dir");
      expect(mockFs.mkdir).not.toHaveBeenCalled();
    });
  });

  describe("writeFileIfNotExists", () => {
    it("should write file if it does not exist", async () => {
      const mockFs: FileSystem = {
        exists: vi.fn().mockResolvedValue(false),
        mkdir: vi.fn().mockResolvedValue(undefined),
        writeFile: vi.fn().mockResolvedValue(undefined),
        readFile: vi.fn(),
      };

      const result = await writeFileIfNotExists(
        "/test/file.txt",
        "content",
        false,
        mockFs,
      );

      expect(result.written).toBe(true);
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        "/test/file.txt",
        "content",
      );
    });

    it("should not write file if it exists and force is false", async () => {
      const mockFs: FileSystem = {
        exists: vi.fn().mockResolvedValue(true),
        mkdir: vi.fn(),
        writeFile: vi.fn(),
        readFile: vi.fn(),
      };

      const result = await writeFileIfNotExists(
        "/test/file.txt",
        "content",
        false,
        mockFs,
      );

      expect(result.written).toBe(false);
      expect(result.reason).toBe("File already exists");
      expect(mockFs.writeFile).not.toHaveBeenCalled();
    });

    it("should write file if it exists and force is true", async () => {
      const mockFs: FileSystem = {
        exists: vi.fn().mockResolvedValue(true),
        mkdir: vi.fn().mockResolvedValue(undefined),
        writeFile: vi.fn().mockResolvedValue(undefined),
        readFile: vi.fn(),
      };

      const result = await writeFileIfNotExists(
        "/test/file.txt",
        "content",
        true,
        mockFs,
      );

      expect(result.written).toBe(true);
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        "/test/file.txt",
        "content",
      );
    });

    it("should ensure parent directory exists before writing", async () => {
      const mockFs: FileSystem = {
        exists: vi
          .fn()
          .mockResolvedValueOnce(false) // file doesn't exist
          .mockResolvedValueOnce(false), // directory doesn't exist
        mkdir: vi.fn().mockResolvedValue(undefined),
        writeFile: vi.fn().mockResolvedValue(undefined),
        readFile: vi.fn(),
      };

      await writeFileIfNotExists(
        "/test/dir/file.txt",
        "content",
        false,
        mockFs,
      );

      expect(mockFs.mkdir).toHaveBeenCalledWith("/test/dir", {
        recursive: true,
      });
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        "/test/dir/file.txt",
        "content",
      );
    });
  });
});
