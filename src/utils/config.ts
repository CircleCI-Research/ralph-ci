import { readFile } from "fs/promises";
import path from "path";
import { CommandError } from "./errors.js";

export interface ReviewGateConfig {
  /** Whether the review gate is enabled (default: true) */
  enabled: boolean;
  /** Timeout in seconds for test:run before killing (default: 60) */
  testTimeoutSeconds: number;
  /** Whether to run format:fix (Prettier) before commits (default: true) */
  formatFixEnabled: boolean;
  /** Whether to run lint:fix (ESLint) before commits (default: true) */
  lintFixEnabled: boolean;
  /** Whether to run tests as part of the gate (default: true) */
  testsEnabled: boolean;
}

export interface BuildAgentConfig {
  /** Timeout in minutes for the Build Agent process (default: 10) */
  timeoutMinutes: number;
  /** Enable verbose turn-by-turn output from Claude CLI (default: true) */
  verbose: boolean;
}

export interface CIDoctorConfig {
  /** Whether the CI Doctor agent is enabled (default: true when CI is enabled) */
  enabled: boolean;
  /** Maximum log length to pass to CI Doctor (0 = unlimited) (default: 0) */
  maxLogLength: number;
  /** Model override for CI Doctor agent (default: uses main runner model) */
  model?: string;
}

export interface RalConfig {
  runner: "claude" | "cursor";
  model?: string;
  taskSelection?: "first-incomplete" | "smart";
  buildAgent?: Partial<BuildAgentConfig>;
  reviewGate?: Partial<ReviewGateConfig>;
  /** @deprecated Use ci.doctor instead. Kept for backward compatibility. */
  ciDoctor?: Partial<CIDoctorConfig>;
  /** CI doctor config nested under ci (preferred) */
  ci?: { doctor?: Partial<CIDoctorConfig>; [key: string]: unknown };
}

export type ConfigSource = "working-directory" | "root-directory" | "default";

export interface ConfigResult {
  config: RalConfig;
  source: ConfigSource;
  path?: string;
}

export const DEFAULT_BUILD_AGENT_CONFIG: BuildAgentConfig = {
  timeoutMinutes: 10,
  verbose: true,
};

export const DEFAULT_REVIEW_GATE_CONFIG: ReviewGateConfig = {
  enabled: true,
  testTimeoutSeconds: 60,
  formatFixEnabled: true,
  lintFixEnabled: true,
  testsEnabled: true,
};

export const DEFAULT_CI_DOCTOR_CONFIG: CIDoctorConfig = {
  enabled: true,
  maxLogLength: 0, // 0 = unlimited — CI Doctor gets the full untruncated logs
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

/**
 * Resolve a partial ReviewGateConfig into a full one with defaults.
 */
export function resolveReviewGateConfig(
  partial?: Partial<ReviewGateConfig>,
): ReviewGateConfig {
  return {
    ...DEFAULT_REVIEW_GATE_CONFIG,
    ...partial,
  };
}

/**
 * Resolve a partial CIDoctorConfig into a full one with defaults.
 */
export function resolveCIDoctorConfig(
  partial?: Partial<CIDoctorConfig>,
): CIDoctorConfig {
  return {
    ...DEFAULT_CI_DOCTOR_CONFIG,
    ...partial,
  };
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
