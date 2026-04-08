import { spawn } from "child_process";
import { readFile } from "fs/promises";
import { AgentRunner, AgentResponse, RunClaudeOptions } from "./claude-runner";

/**
 * Transform @ file references to include working directory path.
 * Only transforms if working directory is not current directory.
 */
export function transformFileReferences(
  content: string,
  workingDirectory: string,
): string {
  if (workingDirectory !== "." && workingDirectory !== "./") {
    // Normalize working directory by removing trailing slashes
    const normalizedDir = workingDirectory.replace(/\/+$/, "");
    // Replace @filename.md and @filename.json with @workingDirectory/filename.md and @workingDirectory/filename.json
    return content.replace(/@(\S+\.(?:md|json))/g, `@${normalizedDir}/$1`);
  }
  return content;
}

export class CursorRunner implements AgentRunner {
  private model: string;

  constructor(model: string = "composer-1") {
    this.model = model;
  }

  async runClaude(options: RunClaudeOptions): Promise<AgentResponse> {
    const {
      promptPath,
      promptContent: providedContent,
      workingDirectory,
    } = options;

    // Exactly one of promptPath or promptContent must be provided
    if ((promptPath && providedContent) || (!promptPath && !providedContent)) {
      throw new Error(
        "Exactly one of promptPath or promptContent must be provided",
      );
    }

    // Get the prompt content either from file or directly
    let promptContent: string;
    if (promptPath) {
      promptContent = await readFile(promptPath, "utf-8");
    } else {
      promptContent = providedContent!;
    }

    // Transform @ file references to include working directory
    promptContent = transformFileReferences(promptContent, workingDirectory);

    return new Promise((resolve, reject) => {
      const agent = spawn(
        "agent",
        [
          "-p",
          "--force",
          "--output-format",
          "json",
          "--model",
          this.model,
          promptContent,
        ],
        {
          stdio: ["inherit", "pipe", "pipe"],
        },
      );

      let stdout = "";
      let stderr = "";

      agent.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      agent.stderr.on("data", (data) => {
        const chunk = data.toString();
        stderr += chunk;
        // Stream stderr to console for visibility
        process.stderr.write(chunk);
      });

      agent.on("error", (error) => {
        reject(new Error(`Failed to spawn Cursor agent CLI: ${error.message}`));
      });

      agent.on("close", (code) => {
        if (code !== 0 && !stdout) {
          reject(
            new Error(`Cursor agent CLI exited with code ${code}: ${stderr}`),
          );
          return;
        }

        try {
          const response = JSON.parse(stdout);

          // Check for errors using is_error and subtype fields
          if (response.is_error === true) {
            const errorMsg = response.result || "Unknown error";
            const errorType = response.subtype || "error";
            reject(
              new Error(`Cursor agent CLI error (${errorType}): ${errorMsg}`),
            );
            return;
          }

          // Validate the response structure
          if (!response.result) {
            reject(new Error("Invalid Cursor agent CLI response format"));
            return;
          }

          resolve({
            result: response.result,
            // Cursor doesn't provide token usage or cost info, set to 0
            usage: {
              input_tokens: 0,
              output_tokens: 0,
              cache_read_input_tokens: 0,
            },
            total_cost_usd: 0,
            duration_ms: response.duration_ms,
          });
        } catch (error) {
          if (error instanceof SyntaxError) {
            reject(
              new Error("Failed to parse Cursor agent CLI response as JSON"),
            );
          } else {
            reject(error);
          }
        }
      });
    });
  }
}
