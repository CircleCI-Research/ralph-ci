import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  c,
  printIterationSeparator,
  printFullPrompt,
  withSpinner,
} from "./terminal.js";

describe("terminal", () => {
  describe("c (color helpers)", () => {
    it("wraps text with ANSI codes", () => {
      expect(c.dim("foo")).toContain("foo");
      expect(c.dim("foo")).toContain("\u001b[");
      expect(c.cyan("bar")).toContain("bar");
      expect(c.green("ok")).toContain("ok");
    });
  });

  describe("printIterationSeparator", () => {
    it("writes iteration info to stdout", () => {
      const write = vi
        .spyOn(process.stdout, "write")
        .mockImplementation(() => true);
      printIterationSeparator(1, 10);
      expect(write).toHaveBeenCalled();
      const calls = write.mock.calls.map((c) => c[0]).join("");
      expect(calls).toContain("Iteration 1/10");
      write.mockRestore();
    });
  });

  describe("printFullPrompt", () => {
    it("prints all lines without truncation", () => {
      const write = vi
        .spyOn(process.stdout, "write")
        .mockImplementation(() => true);
      const lines = Array.from({ length: 14 }, (_, i) => `Line ${i + 1}`);
      printFullPrompt(lines.join("\n"));
      const allWritten = write.mock.calls.map((c) => c[0]).join("");
      expect(allWritten).toContain("Prompt");
      expect(allWritten).toContain("Line 1");
      expect(allWritten).toContain("Line 10");
      expect(allWritten).toContain("Line 11");
      expect(allWritten).toContain("Line 14");
      expect(allWritten).not.toContain("more line");
      write.mockRestore();
    });
  });

  describe("withSpinner", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it("returns the task result and shows done message", async () => {
      const write = vi
        .spyOn(process.stdout, "write")
        .mockImplementation(() => true);
      const result = await withSpinner(
        "Running…",
        () => Promise.resolve(42),
        "Done",
      );
      expect(result).toBe(42);
      const calls = write.mock.calls.map((c) => c[0]).join("");
      expect(calls).toContain("Done");
      write.mockRestore();
    });

    it("rethrows if task rejects", async () => {
      const write = vi
        .spyOn(process.stdout, "write")
        .mockImplementation(() => true);
      await expect(
        withSpinner("Running…", () => Promise.reject(new Error("fail"))),
      ).rejects.toThrow("fail");
      write.mockRestore();
    });
  });
});
