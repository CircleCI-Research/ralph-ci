import { readFileSync, existsSync } from "fs";
import path from "path";

export interface GateScriptPointer {
  gate: string;
  scope: "inner" | "outer";
  configPath: string;
  scriptPath?: string;
}

export interface ValidationManifest {
  generatedAt: string;
  innerGates: string[];
  outerCiJobs: string[];
  gatePointers: GateScriptPointer[];
  markdown: string;
}

interface ChunkConfigCommand {
  name?: string;
  role?: string;
  run?: string;
}

interface ChunkConfig {
  commands?: ChunkConfigCommand[];
}

const INNER_CONFIG = ".chunk/config.json";
const OUTER_CONFIG = ".circleci/config.yml";
const CHUNK_ENV_SCRIPT = "scripts/chunk-remote-env.sh";

const OUTER_JOB_SCRIPTS: Record<string, string> = {
  "require-cost-of-a-green-pr-snake-md":
    "scripts/ci-require-cost-of-a-green-pr-snake-md.sh",
  "require-green-pr-cost-md": "scripts/ci-require-green-pr-cost.sh",
  "release-attestation": "scripts/ci-fat-log-noise.sh",
  lint: "pnpm lint (see job in .circleci/config.yml)",
  test: "pnpm test:run (see job in .circleci/config.yml)",
  build: "pnpm build (see job in .circleci/config.yml)",
};

function readJsonFile<T>(filePath: string): T | null {
  if (!existsSync(filePath)) return null;
  try {
    return JSON.parse(readFileSync(filePath, "utf-8")) as T;
  } catch {
    return null;
  }
}

function parseInnerGates(chunkConfigPath: string): string[] {
  const config = readJsonFile<ChunkConfig>(chunkConfigPath);
  if (!config?.commands?.length) {
    return ["install", "lint", "test", "build"];
  }
  return config.commands
    .filter((cmd) => cmd.role === "gate" || cmd.name === "install")
    .map((cmd) => cmd.name ?? "unknown");
}

/** Jobs declared in the CircleCI workflow. */
function parseOuterCiJobs(circleCiConfigPath: string): string[] {
  const defaults = ["lint", "test", "build"];
  if (!existsSync(circleCiConfigPath)) {
    return defaults;
  }
  const content = readFileSync(circleCiConfigPath, "utf-8");
  return defaults.filter((job) => content.includes(`${job}:`));
}

function buildGatePointers(
  packageRoot: string,
  innerGates: string[],
  outerCiJobs: string[],
): GateScriptPointer[] {
  const pointers: GateScriptPointer[] = [
    {
      gate: "chunk sidecar (all inner gates)",
      scope: "inner",
      configPath: INNER_CONFIG,
      scriptPath: CHUNK_ENV_SCRIPT,
    },
  ];

  for (const gate of innerGates) {
    if (gate === "require-cost-of-a-green-pr-snake-md") {
      pointers.push({
        gate,
        scope: "inner",
        configPath: INNER_CONFIG,
        scriptPath: `${CHUNK_ENV_SCRIPT} --gate-cost-of-a-green-pr-snake`,
      });
    }
  }

  pointers.push({
    gate: "circleci workflow (experiment branches)",
    scope: "outer",
    configPath: OUTER_CONFIG,
  });

  for (const job of outerCiJobs) {
    const scriptPath = OUTER_JOB_SCRIPTS[job];
    if (scriptPath) {
      pointers.push({
        gate: job,
        scope: "outer",
        configPath: OUTER_CONFIG,
        scriptPath,
      });
    }
  }

  return pointers;
}

function formatManifestMarkdown(
  manifest: Omit<ValidationManifest, "markdown">,
): string {
  const lines = [
    "## Validation Manifest (auto-generated, descriptive only)",
    "",
    `Generated: ${manifest.generatedAt}`,
    "",
    "This manifest lists **where** gates are defined — not what to create. `@`-read the",
    "referenced configs/scripts on demand to learn requirements for this run's `src/`.",
    "",
    "### Inner loop (Chunk sidecar — Review Gate)",
    "",
    ...manifest.innerGates.map((gate) => `- \`${gate}\``),
    "",
    "### Outer loop (CircleCI — thick workflow on push)",
    "",
    ...manifest.outerCiJobs.map((job) => `- \`${job}\``),
    "",
    "### Config and script pointers",
    "",
    "| Gate / job | Scope | Config | Script (read on demand) |",
    "| ---------- | ----- | ------ | ------------------------- |",
    ...manifest.gatePointers.map((p) => {
      const script = p.scriptPath ? `\`${p.scriptPath}\`` : "—";
      return `| ${p.gate} | ${p.scope} | \`${p.configPath}\` | ${script} |`;
    }),
    "",
    "**Per-task push:** before each success signal, assume this commit will push",
    "and thick CI will run — satisfy inner (sidecar) and outer gates you identified.",
    "",
    "**Single-push (deferred CI):** outer CI runs only after all tasks pass Review Gate;",
    "re-check outer requirements from your preflight notes before the unlock push.",
    "",
  ];
  return lines.join("\n");
}

export function resolvePackageRoot(workingDirectory: string): string {
  let dir = path.resolve(workingDirectory);
  while (true) {
    if (existsSync(path.join(dir, ".chunk", "config.json"))) {
      return dir;
    }
    if (existsSync(path.join(dir, "package.json"))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }
  return path.resolve(workingDirectory);
}

export function generateValidationManifest(
  packageRoot: string,
): ValidationManifest {
  const chunkConfigPath = path.join(packageRoot, INNER_CONFIG);
  const circleCiConfigPath = path.join(packageRoot, OUTER_CONFIG);

  const innerGates = parseInnerGates(chunkConfigPath);
  const outerCiJobs = parseOuterCiJobs(circleCiConfigPath);
  const gatePointers = buildGatePointers(packageRoot, innerGates, outerCiJobs);
  const generatedAt = new Date().toISOString();

  const base = {
    generatedAt,
    innerGates,
    outerCiJobs,
    gatePointers,
  };

  return {
    ...base,
    markdown: formatManifestMarkdown(base),
  };
}

export const VALIDATION_MANIFEST_PLACEHOLDER = "{{VALIDATION_MANIFEST}}";

/** One-line reminder after task 1 — avoids re-injecting the full manifest table. */
export const VALIDATION_MANIFEST_REMINDER =
  "## Validation Manifest\n\nGate pointers were injected on task 1. Read `@preflight.md` and `@`-read gate configs/scripts on demand.\n";

/** Compact manifest for preflight and token-sensitive paths (~80% smaller than full markdown). */
export function formatManifestCompact(
  manifest: Pick<
    ValidationManifest,
    "innerGates" | "outerCiJobs" | "gatePointers"
  >,
): string {
  const configs = [...new Set(manifest.gatePointers.map((p) => p.configPath))];
  const scripts = manifest.gatePointers
    .map((p) => p.scriptPath)
    .filter((s): s is string => !!s);
  const uniqueScripts = [...new Set(scripts)];

  const lines = [
    "## Validation Manifest (compact)",
    "",
    "**Inner gates:** " + manifest.innerGates.map((g) => `\`${g}\``).join(", "),
    "**Outer CI jobs:** " +
      manifest.outerCiJobs.map((j) => `\`${j}\``).join(", "),
    "**Configs:** " + configs.map((c) => `\`${c}\``).join(", "),
  ];
  if (uniqueScripts.length > 0) {
    lines.push(
      "**Scripts (read on demand):** " +
        uniqueScripts.map((s) => `\`${s}\``).join(", "),
    );
  }
  lines.push("");
  return lines.join("\n");
}

export function injectValidationManifestIntoPrompt(
  promptTemplate: string,
  manifestMarkdown: string,
): string {
  if (promptTemplate.includes(VALIDATION_MANIFEST_PLACEHOLDER)) {
    return promptTemplate.replace(
      VALIDATION_MANIFEST_PLACEHOLDER,
      manifestMarkdown,
    );
  }
  return `${promptTemplate}\n\n${manifestMarkdown}`;
}
