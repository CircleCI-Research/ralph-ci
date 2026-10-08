import { readFile } from "fs/promises";
import path from "path";
import { CommandError } from "./errors.js";

/**
 * CircleCI Chunk sidecar remote validation (optional).
 * Runs after local format/lint/tests when enabled — see Chunk CLI README:
 * https://github.com/CircleCI-Public/chunk-cli/blob/main/README.md
 */
export interface ChunkSidecarGateConfig {
  /**
   * After local steps, run Chunk remote validation (`chunk validate --remote`)
   * when true. The workspace is uploaded first unless `skipSync` is set
   * (default: false).
   */
  enabled: boolean;
  /**
   * How the package root is copied to the sidecar before `chunk validate --remote`.
   * - **chunk-cli (default):** `chunk sidecar sync` — matches
   *   [Chunk CLI](https://github.com/CircleCI-Public/chunk-cli) docs (may require
   *   the current commit to exist on `origin` for git-based sync).
   * - **tar-ssh:** gzip tar over the CircleCI sidecar **WebSocket + SSH** tunnel
   *   (RalphCI; unpushed / dirty trees without GitHub).
   */
  syncMode: "tar-ssh" | "chunk-cli";
  /** Seconds before killing the upload step (`tar-ssh` stream or `chunk sidecar sync`) (default: 180) */
  syncTimeoutSeconds: number;
  /** Seconds before killing `chunk validate --remote` (default: 300) */
  remoteValidateTimeoutSeconds: number;
  /**
   * If true, Review Gate fails when the Chunk CLI is missing or not runnable.
   * If false, missing CLI skips remote validation with a dim log line (default: false).
   */
  strictCli: boolean;
  /**
   * Run `chunk validate --remote` only (skip `chunk sidecar sync`).
   * Use when you sync manually or another tool syncs for you (default: false).
   */
  skipSync: boolean;
  /** Optional validation name: `chunk validate <name> --remote` */
  validateTarget?: string;
  /**
   * Path on the sidecar where the repo is synced (passed to `chunk sidecar sync`
   * and `chunk validate --remote --workdir`). Chunk defaults to `./workspace`,
   * but `chunk sidecar sync` places the project under `./workspace/<basename>`.
   * When omitted, RalphCI uses `./workspace/${basename(packageRoot)}` so sync
   * and validate target the same directory.
   */
  remoteWorkdir?: string;
}

export type ReviewGateInnerLoop = "local+sidecar" | "sidecar-only";

export interface ReviewGateConfig {
  /** Whether the review gate is enabled (default: true) */
  enabled: boolean;
  /**
   * Inner validation loop mode (default: local+sidecar).
   * - **local+sidecar:** local format/lint/tests, then Chunk sidecar when enabled.
   * - **sidecar-only:** local format:fix only; lint/tests run on the sidecar (and CI).
   */
  innerLoop: ReviewGateInnerLoop;
  /** Timeout in seconds for test:run before killing (default: 60) */
  testTimeoutSeconds: number;
  /** Whether to run format:fix (Prettier) before commits (default: true) */
  formatFixEnabled: boolean;
  /** Whether to run lint:fix (ESLint) before commits (default: true) */
  lintFixEnabled: boolean;
  /** Whether to run tests as part of the gate (default: true) */
  testsEnabled: boolean;
  /** Chunk sidecar remote microbuilds (resolved with defaults) */
  chunkSidecar: ChunkSidecarGateConfig;
}

export interface BuildAgentConfig {
  /** Timeout in minutes for the Build Agent process (default: 10) */
  timeoutMinutes: number;
  /** Enable verbose turn-by-turn output from Claude CLI (default: true) */
  verbose: boolean;
}

export interface PreflightSurveyConfig {
  /** Run one Build Agent survey turn before task 1 (default: false) */
  enabled: boolean;
}

export type CIDoctorLogMode = "full" | "failure-report";

export interface CIDoctorConfig {
  /** Whether the CI Doctor agent is enabled (default: true when CI is enabled) */
  enabled: boolean;
  /** Maximum log length to pass to CI Doctor (0 = unlimited) (default: 0) */
  maxLogLength: number;
  /**
   * How CircleCI failure context is fetched for the doctor (and Build Agent when
   * the doctor is skipped).
   * - **full** (default): unshaped job logs via the REST API. Baseline / control.
   * - **failure-report**: `circleci run get --failure-report` condensed output.
   */
  logMode: CIDoctorLogMode;
  /** Model override for CI Doctor agent (default: uses main runner model) */
  model?: string;
  /**
   * Max CI Doctor invocations per stable failure fingerprint (logs + failed jobs)
   * before skipping the doctor until the next push. Default 1.
   */
  maxInvocationsPerFailureFingerprint: number;
}

export interface RalConfig {
  runner: "claude" | "cursor";
  model?: string;
  taskSelection?: "first-incomplete" | "smart";
  buildAgent?: Partial<BuildAgentConfig>;
  preflightSurvey?: Partial<PreflightSurveyConfig>;
  reviewGate?: ReviewGateConfigInput;
  /** @deprecated Use ci.doctor instead. Kept for backward compatibility. */
  ciDoctor?: Partial<CIDoctorConfig>;
  /** CI doctor config nested under ci (preferred) */
  ci?: { doctor?: Partial<CIDoctorConfig>; [key: string]: unknown };
}

/** ralphci.json `reviewGate` object (chunkSidecar fields may be partial) */
export type ReviewGateConfigInput = Partial<
  Omit<ReviewGateConfig, "chunkSidecar">
> & {
  chunkSidecar?: Partial<ChunkSidecarGateConfig>;
};

export type ConfigSource = "working-directory" | "root-directory" | "default";

export interface ConfigResult {
  config: RalConfig;
  source: ConfigSource;
  path?: string;
}

export const DEFAULT_BUILD_AGENT_CONFIG: BuildAgentConfig = {
  timeoutMinutes: 30,
  verbose: true,
};

export const DEFAULT_PREFLIGHT_SURVEY_CONFIG: PreflightSurveyConfig = {
  enabled: false,
};

export const DEFAULT_CHUNK_SIDECAR_GATE_CONFIG: ChunkSidecarGateConfig = {
  enabled: false,
  syncMode: "chunk-cli",
  syncTimeoutSeconds: 180,
  remoteValidateTimeoutSeconds: 300,
  strictCli: false,
  skipSync: false,
};

export const DEFAULT_REVIEW_GATE_CONFIG: ReviewGateConfig = {
  enabled: true,
  innerLoop: "local+sidecar",
  testTimeoutSeconds: 60,
  formatFixEnabled: true,
  lintFixEnabled: true,
  testsEnabled: true,
  chunkSidecar: { ...DEFAULT_CHUNK_SIDECAR_GATE_CONFIG },
};

export const DEFAULT_CI_DOCTOR_CONFIG: CIDoctorConfig = {
  enabled: true,
  maxLogLength: 0, // 0 = unlimited — CI Doctor gets the full untruncated logs
  logMode: "full",
  maxInvocationsPerFailureFingerprint: 1,
};

/**
 * Resolve a partial BuildAgentConfig into a full one with defaults.
 */
export function resolveBuildAgentConfig(
  partial?: Partial<BuildAgentConfig>,
): BuildAgentConfig {
  return {
    ...DEFAULT_BUILD_AGENT_CONFIG,
    ...partial,
  };
}

export function resolvePreflightSurveyConfig(
  partial?: Partial<PreflightSurveyConfig>,
): PreflightSurveyConfig {
  return {
    ...DEFAULT_PREFLIGHT_SURVEY_CONFIG,
    ...partial,
  };
}

/**
 * Resolve a partial ReviewGateConfig into a full one with defaults.
 */
export function resolveReviewGateConfig(
  partial?: ReviewGateConfigInput,
): ReviewGateConfig {
  const chunkPartial = partial?.chunkSidecar;
  const chunkSidecar: ChunkSidecarGateConfig = {
    ...DEFAULT_CHUNK_SIDECAR_GATE_CONFIG,
    ...chunkPartial,
  };
  if (
    chunkSidecar.syncMode !== "tar-ssh" &&
    chunkSidecar.syncMode !== "chunk-cli"
  ) {
    throw new CommandError(
      `Invalid reviewGate.chunkSidecar.syncMode: ${JSON.stringify(chunkSidecar.syncMode)}. Use "tar-ssh" or "chunk-cli".`,
    );
  }
  const innerLoop = partial?.innerLoop ?? DEFAULT_REVIEW_GATE_CONFIG.innerLoop;
  if (innerLoop !== "local+sidecar" && innerLoop !== "sidecar-only") {
    throw new CommandError(
      `Invalid reviewGate.innerLoop: ${JSON.stringify(innerLoop)}. Use "local+sidecar" or "sidecar-only".`,
    );
  }
  const merged: ReviewGateConfig = {
    ...DEFAULT_REVIEW_GATE_CONFIG,
    ...partial,
    innerLoop,
    chunkSidecar,
  };
  if (innerLoop === "sidecar-only") {
    merged.lintFixEnabled = false;
    merged.testsEnabled = false;
  }
  return merged;
}

/**
 * Resolve a partial CIDoctorConfig into a full one with defaults.
 */
export function resolveCIDoctorConfig(
  partial?: Partial<CIDoctorConfig>,
): CIDoctorConfig {
  const merged: CIDoctorConfig = {
    ...DEFAULT_CI_DOCTOR_CONFIG,
    ...partial,
  };
  if (merged.logMode !== "full" && merged.logMode !== "failure-report") {
    throw new CommandError(
      `Invalid CI Doctor config: logMode must be "full" or "failure-report", got ${JSON.stringify(merged.logMode)}`,
    );
  }
  if (
    typeof merged.maxInvocationsPerFailureFingerprint !== "number" ||
    merged.maxInvocationsPerFailureFingerprint < 1 ||
    !Number.isInteger(merged.maxInvocationsPerFailureFingerprint)
  ) {
    throw new CommandError(
      "Invalid CI Doctor config: maxInvocationsPerFailureFingerprint must be an integer >= 1",
    );
  }
  return merged;
}

const DEFAULT_CONFIG: RalConfig = {
  runner: "claude",
  taskSelection: "first-incomplete",
};

export async function loadConfig(
  workingDirectory: string,
  rootDirectory?: string,
): Promise<ConfigResult> {
  const workingConfigPath = path.join(workingDirectory, "ralphci.json");

  try {
    const content = await readFile(workingConfigPath, "utf-8");
    const config = JSON.parse(content);

    // Validate config structure
    if (!config || typeof config !== "object") {
      throw new CommandError("Invalid ralphci.json: config must be an object");
    }

    if (
      config.runner &&
      config.runner !== "claude" &&
      config.runner !== "cursor"
    ) {
      throw new CommandError(
        `Invalid ralphci.json: runner must be "claude" or "cursor", got "${config.runner}"`,
      );
    }

    if (config.model !== undefined && typeof config.model !== "string") {
      throw new CommandError("Invalid ralphci.json: model must be a string");
    }

    if (
      config.taskSelection !== undefined &&
      config.taskSelection !== "first-incomplete" &&
      config.taskSelection !== "smart"
    ) {
      throw new CommandError(
        `Invalid ralphci.json: taskSelection must be "first-incomplete" or "smart", got "${config.taskSelection}"`,
      );
    }

    console.log(`Using config from ${workingConfigPath}`);

    // Resolve CI Doctor config: prefer ci.doctor, fall back to top-level ciDoctor
    const doctorConfig = config.ci?.doctor ?? config.ciDoctor;

    return {
      config: {
        runner: config.runner || DEFAULT_CONFIG.runner,
        model: config.model,
        taskSelection: config.taskSelection || DEFAULT_CONFIG.taskSelection,
        buildAgent: config.buildAgent,
        reviewGate: config.reviewGate,
        ciDoctor: doctorConfig,
        ci: config.ci,
      },
      source: "working-directory",
      path: workingConfigPath,
    };
  } catch (error) {
    // If file doesn't exist and rootDirectory is provided, try root directory
    if (
      error instanceof Error &&
      "code" in error &&
      error.code === "ENOENT" &&
      rootDirectory
    ) {
      const rootConfigPath = path.join(rootDirectory, "ralphci.json");

      try {
        const content = await readFile(rootConfigPath, "utf-8");
        const config = JSON.parse(content);

        // Validate config structure
        if (!config || typeof config !== "object") {
          throw new CommandError(
            "Invalid ralphci.json: config must be an object",
          );
        }

        if (
          config.runner &&
          config.runner !== "claude" &&
          config.runner !== "cursor"
        ) {
          throw new CommandError(
            `Invalid ralphci.json: runner must be "claude" or "cursor", got "${config.runner}"`,
          );
        }

        if (config.model !== undefined && typeof config.model !== "string") {
          throw new CommandError(
            "Invalid ralphci.json: model must be a string",
          );
        }

        if (
          config.taskSelection !== undefined &&
          config.taskSelection !== "first-incomplete" &&
          config.taskSelection !== "smart"
        ) {
          throw new CommandError(
            `Invalid ralphci.json: taskSelection must be "first-incomplete" or "smart", got "${config.taskSelection}"`,
          );
        }

        console.log(
          `Config not found in working directory, using root config from ${rootConfigPath}`,
        );

        // Resolve CI Doctor config: prefer ci.doctor, fall back to top-level ciDoctor
        const rootDoctorConfig = config.ci?.doctor ?? config.ciDoctor;

        return {
          config: {
            runner: config.runner || DEFAULT_CONFIG.runner,
            model: config.model,
            taskSelection: config.taskSelection || DEFAULT_CONFIG.taskSelection,
            buildAgent: config.buildAgent,
            reviewGate: config.reviewGate,
            ciDoctor: rootDoctorConfig,
            ci: config.ci,
          },
          source: "root-directory",
          path: rootConfigPath,
        };
      } catch (rootError) {
        // If root directory config also doesn't exist, return default config
        if (
          rootError instanceof Error &&
          "code" in rootError &&
          rootError.code === "ENOENT"
        ) {
          console.log(
            "No ralphci.json found, using default config (runner: claude)",
          );

          return {
            config: DEFAULT_CONFIG,
            source: "default",
          };
        }

        // If it's already a CommandError, rethrow it
        if (rootError instanceof CommandError) {
          throw rootError;
        }

        // Handle JSON parse errors
        if (rootError instanceof SyntaxError) {
          throw new CommandError(`Invalid ralphci.json: ${rootError.message}`);
        }

        // Handle other errors
        throw rootError;
      }
    }

    // If file doesn't exist and no rootDirectory provided, return default config
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      console.log(
        "No ralphci.json found, using default config (runner: claude)",
      );

      return {
        config: DEFAULT_CONFIG,
        source: "default",
      };
    }

    // If it's already a CommandError, rethrow it
    if (error instanceof CommandError) {
      throw error;
    }

    // Handle JSON parse errors
    if (error instanceof SyntaxError) {
      throw new CommandError(`Invalid ralphci.json: ${error.message}`);
    }

    // Handle other errors
    throw error;
  }
}
