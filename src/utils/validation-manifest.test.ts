import path from "path";
import { fileURLToPath } from "url";
import { describe, it, expect } from "vitest";
import {
  generateValidationManifest,
  injectValidationManifestIntoPrompt,
  resolvePackageRoot,
  formatManifestCompact,
  VALIDATION_MANIFEST_PLACEHOLDER,
  VALIDATION_MANIFEST_REMINDER,
} from "./validation-manifest.js";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);

describe("resolvePackageRoot", () => {
  it("finds repo root from experiment run directory", () => {
    const runDir = path.join(
      repoRoot,
      "experiments",
      "cost-of-a-green-pr",
      "runs",
      "per-task",
      "calibration",
    );
    expect(resolvePackageRoot(runDir)).toBe(repoRoot);
  });
});

describe("generateValidationManifest", () => {
  it("lists gates and script pointers without prescriptive marker table", () => {
    const manifest = generateValidationManifest(repoRoot);
    expect(manifest.innerGates).toEqual(["install", "lint", "test", "build"]);
    expect(manifest.outerCiJobs).toEqual(["lint", "test", "build"]);
    expect(
      manifest.gatePointers.some((p) => p.scriptPath?.includes("pnpm lint")),
    ).toBe(true);
    expect(manifest.markdown).toContain("descriptive only");
    expect(manifest.markdown).not.toContain("Required markers");
  });
});

describe("injectValidationManifestIntoPrompt", () => {
  it("replaces placeholder when present", () => {
    const out = injectValidationManifestIntoPrompt(
      `Before\n${VALIDATION_MANIFEST_PLACEHOLDER}\nAfter`,
      "## manifest",
    );
    expect(out).toContain("## manifest");
    expect(out).not.toContain(VALIDATION_MANIFEST_PLACEHOLDER);
  });
});

describe("formatManifestCompact", () => {
  it("lists gates without full markdown table", () => {
    const manifest = generateValidationManifest(repoRoot);
    const compact = formatManifestCompact(manifest);
    expect(compact).toContain("Inner gates:");
    expect(compact).not.toContain("| Gate / job |");
    expect(compact.length).toBeLessThan(manifest.markdown.length);
  });
});

describe("VALIDATION_MANIFEST_REMINDER", () => {
  it("is a short one-section reminder", () => {
    expect(VALIDATION_MANIFEST_REMINDER).toContain("task 1");
    expect(VALIDATION_MANIFEST_REMINDER.length).toBeLessThan(200);
  });
});
