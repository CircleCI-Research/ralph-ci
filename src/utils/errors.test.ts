import { describe, it, expect } from "vitest";
import {
  RalError,
  ValidationError,
  FileOperationError,
  CommandError,
  formatError,
} from "./errors.js";

describe("errors", () => {
  describe("RalError", () => {
    it("should create error with correct name and message", () => {
      const error = new RalError("test message");
      expect(error.name).toBe("RalError");
      expect(error.message).toBe("test message");
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe("ValidationError", () => {
    it("should create error with correct name and message", () => {
      const error = new ValidationError("validation failed");
      expect(error.name).toBe("ValidationError");
      expect(error.message).toBe("validation failed");
      expect(error).toBeInstanceOf(RalError);
    });
  });

  describe("FileOperationError", () => {
    it("should create error with correct name, message, and filePath", () => {
      const error = new FileOperationError("file error", "/test/file.txt");
      expect(error.name).toBe("FileOperationError");
      expect(error.message).toBe("file error");
      expect(error.filePath).toBe("/test/file.txt");
      expect(error).toBeInstanceOf(RalError);
    });

    it("should work without filePath", () => {
      const error = new FileOperationError("file error");
      expect(error.message).toBe("file error");
      expect(error.filePath).toBeUndefined();
    });
  });

  describe("CommandError", () => {
    it("should create error with correct name, message, and exitCode", () => {
      const error = new CommandError("command failed", 1);
      expect(error.name).toBe("CommandError");
      expect(error.message).toBe("command failed");
      expect(error.exitCode).toBe(1);
      expect(error).toBeInstanceOf(RalError);
    });

    it("should work without exitCode", () => {
      const error = new CommandError("command failed");
      expect(error.message).toBe("command failed");
      expect(error.exitCode).toBeUndefined();
    });
  });

  describe("formatError", () => {
    it("should format RalError correctly", () => {
      const error = new RalError("test error");
      expect(formatError(error)).toBe("test error");
    });

    it("should format standard Error correctly", () => {
      const error = new Error("standard error");
      expect(formatError(error)).toBe("standard error");
    });

    it("should format string correctly", () => {
      expect(formatError("string error")).toBe("string error");
    });

    it("should format non-error values correctly", () => {
      expect(formatError(123)).toBe("123");
      expect(formatError({ message: "object" })).toContain("object");
    });
  });
});
