import { spawn } from "child_process";
import { readFile, writeFile, mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { setTimeout, clearTimeout, setInterval, clearInterval } from "timers";

export interface AgentUsage {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens: number;
}

export interface AgentResponse {
  result: string;
  usage: AgentUsage;
  total_cost_usd: number;
  duration_ms?: number;
  model?: string;
}

export interface RunClaudeOptions {
  promptPath?: string;
  promptContent?: string;
  workingDirectory: string;
  model?: string;
  /** Timeout in minutes for the agent process (default: 10) */
  timeoutMinutes?: number;
  /** Enable verbose turn-by-turn output from Claude CLI (default: true) */
  verbose?: boolean;
}

export interface AgentRunner {
  runClaude(options: RunClaudeOptions): Promise<AgentResponse>;
}

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

export class DefaultClaudeRunner implements AgentRunner {
  async runClaude(options: RunClaudeOptions): Promise<AgentResponse> {
    const {
      promptPath,
      promptContent: providedContent,
      workingDirectory,
      model,
      timeoutMinutes = 10,
      verbose = true,
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

    // NOTE: We do NOT transform @ file references here because Claude CLI
    // resolves them relative to the cwd, not the prompt file location.
    // transformFileReferences is only needed for the old -p flag approach.

    // Create temp directory and file for the prompt (do async work before Promise)
    const tempDir = await mkdtemp(join(tmpdir(), "ralphci-"));
    const tempFile = join(tempDir, "prompt.md");
    await writeFile(tempFile, promptContent, "utf-8");

    // Cleanup helper
    const cleanup = async () => {
      try {
        await rm(tempDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    };

    // Choose output format based on verbose setting:
    // - verbose=true  → stream-json + --verbose (real-time events, parse for activity + final result)
    // - verbose=false → json (single buffered JSON response, silent until done)
    const outputFormat = verbose ? "stream-json" : "json";

    return new Promise((resolve, reject) => {
      const args = [
        tempFile,
        "--output-format",
        outputFormat,
        "--dangerously-skip-permissions", // Allow file operations without prompts
        "--print", // Non-interactive mode
      ];

      // stream-json requires --verbose when used with --print
      if (verbose) {
        args.push("--verbose");
      }

      if (model) {
        args.push("--model", model);
      }

      const claude = spawn("claude", args, {
        cwd: workingDirectory, // Set working directory so @ references resolve correctly
        stdio: ["ignore", "pipe", "pipe"], // Changed from "inherit" to "ignore" for stdin
      });

      const TIMEOUT_MS = timeoutMinutes * 60 * 1000;
      const HEARTBEAT_INTERVAL_MS = verbose ? 60 * 1000 : 30 * 1000; // 1min (verbose) / 30s (quiet)
      const startTime = Date.now();

      const heartbeat = setInterval(() => {
        const elapsedMin = ((Date.now() - startTime) / 60000).toFixed(1);
        const alive = !claude.killed && claude.exitCode === null;
        if (alive) {
          process.stderr.write(
            `\n  ⏱️  Agent still working... ${elapsedMin}m elapsed\n`,
          );
        } else {
          process.stderr.write(
            `\n  ⚠️  Agent process appears dead after ${elapsedMin}m — waiting for exit handler\n`,
          );
        }
      }, HEARTBEAT_INTERVAL_MS);

      // Hard timeout to prevent indefinite hanging
      const timeout = setTimeout(() => {
        clearInterval(heartbeat);
        const elapsedMin = ((Date.now() - startTime) / 60000).toFixed(0);
        claude.kill();
        cleanup().then(() => {
          reject(
            new Error(
              `Claude CLI process timed out after ${elapsedMin} minutes`,
            ),
          );
        });
      }, TIMEOUT_MS);

      let stdout = "";
      let stderr = "";

      // For stream-json: accumulate result text and track activity
      let streamResultText = "";
      let streamUsage: AgentUsage = {
        input_tokens: 0,
        output_tokens: 0,
        cache_read_input_tokens: 0,
      };
      let streamCostUsd = 0;
      let streamModel: string | undefined;
      let lastToolName = "";
      let lineBuffer = "";

      /**
       * Parse a single stream-json line for real-time activity display.
       * Accumulates result text and usage from the event stream.
       */
      const parseStreamLine = (line: string) => {
        if (!line.trim()) return;
        try {
          const event = JSON.parse(line);

          // Opportunistically capture model from any event that carries it
          if (!streamModel && event.model) streamModel = event.model;

          // "result" type = final summary with usage/cost (Claude Code CLI wrapper)
          if (event.type === "result") {
            if (event.result) streamResultText = event.result;
            if (event.usage) {
              streamUsage = {
                input_tokens: event.usage.input_tokens || 0,
                output_tokens: event.usage.output_tokens || 0,
                cache_read_input_tokens:
                  event.usage.cache_read_input_tokens || 0,
              };
            }
            if (typeof event.total_cost_usd === "number")
              streamCostUsd = event.total_cost_usd;
            if (event.model) streamModel = event.model;
            return;
          }

          // "stream_event" type = real-time content/tool events
          if (event.type === "stream_event" && event.event) {
            const ev = event.event;

            // Text content being generated
            if (
              ev.type === "content_block_delta" &&
              ev.delta?.type === "text_delta"
            ) {
              streamResultText += ev.delta.text || "";
              return;
            }

            // Tool use started — show what the agent is doing
            if (
              ev.type === "content_block_start" &&
              ev.content_block?.type === "tool_use"
            ) {
              const toolName = ev.content_block.name || "unknown";
              if (toolName !== lastToolName) {
                lastToolName = toolName;
                const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
                process.stderr.write(`  🔧 [${elapsed}s] ${toolName}\n`);
              }
              return;
            }

            // Message delta with usage stats (near end of stream)
            if (ev.type === "message_delta" && ev.usage) {
              streamUsage.output_tokens =
                ev.usage.output_tokens || streamUsage.output_tokens;
              return;
            }

            // Message start with model info
            if (ev.type === "message_start" && ev.message) {
              if (ev.message.model) streamModel = ev.message.model;
              if (ev.message.usage) {
                streamUsage.input_tokens = ev.message.usage.input_tokens || 0;
                streamUsage.cache_read_input_tokens =
                  ev.message.usage.cache_read_input_tokens || 0;
              }
              return;
            }
          }

          // "assistant" type = complete message blocks (may contain text + model)
          if (event.type === "assistant") {
            if (event.message?.model) streamModel = event.message.model;
            if (event.message?.content) {
              for (const block of event.message.content) {
                if (block.type === "text" && block.text) {
                  // Only use if we haven't accumulated stream text
                  if (!streamResultText) streamResultText = block.text;
                }
              }
            }
            if (event.message?.usage) {
              streamUsage = {
                input_tokens:
                  event.message.usage.input_tokens || streamUsage.input_tokens,
                output_tokens:
                  event.message.usage.output_tokens ||
                  streamUsage.output_tokens,
                cache_read_input_tokens:
                  event.message.usage.cache_read_input_tokens ||
                  streamUsage.cache_read_input_tokens,
              };
            }
            return;
          }

          // "system" type = system info (may carry model)
          if (event.type === "system" && event.model) {
            streamModel = event.model;
            return;
          }
        } catch {
          // Not valid JSON — ignore (could be partial line or verbose text)
        }
      };

      claude.stdout.on("data", (data) => {
        const chunk = data.toString();
        stdout += chunk;

        // In stream-json mode, parse events line by line for real-time activity
        if (verbose) {
          lineBuffer += chunk;
          const lines = lineBuffer.split("\n");
          // Keep the last (potentially incomplete) line in the buffer
          lineBuffer = lines.pop() || "";
          for (const line of lines) {
            parseStreamLine(line);
          }
        }
      });

      claude.stderr.on("data", (data) => {
        const chunk = data.toString();
        stderr += chunk;
        // Stream stderr to console for visibility
        process.stderr.write(chunk);
      });

      claude.on("error", (error) => {
        clearTimeout(timeout);
        clearInterval(heartbeat);
        cleanup().then(() => {
          reject(new Error(`Failed to spawn Claude CLI: ${error.message}`));
        });
      });

      claude.on("close", (code) => {
        clearTimeout(timeout);
        clearInterval(heartbeat);

        // Process any remaining buffered line
        if (verbose && lineBuffer.trim()) {
          parseStreamLine(lineBuffer);
        }

        if (code !== 0 && !stdout) {
          cleanup().then(() => {
            reject(new Error(`Claude CLI exited with code ${code}: ${stderr}`));
          });
          return;
        }

        // ─── stream-json mode: build response from accumulated events ───
        if (verbose) {
          if (!streamResultText) {
            cleanup().then(() => {
              reject(
                new Error(
                  "Stream-JSON mode: no result text received from Claude CLI",
                ),
              );
            });
            return;
          }

          cleanup().then(() => {
            resolve({
              result: streamResultText,
              usage: streamUsage,
              total_cost_usd: streamCostUsd,
              model: streamModel,
            });
          });
          return;
        }

        // ─── json mode: parse single JSON response ───
        try {
          const response = JSON.parse(stdout);

          // Validate the response structure
          if (
            !response.result ||
            !response.usage ||
            typeof response.total_cost_usd !== "number"
          ) {
            cleanup().then(() => {
              reject(
                new Error(
                  `Invalid Claude CLI response format. Keys: ${Object.keys(response).join(", ")}`,
                ),
              );
            });
            return;
          }

          cleanup().then(() => {
            resolve({
              result: response.result,
              usage: {
                input_tokens: response.usage.input_tokens || 0,
                output_tokens: response.usage.output_tokens || 0,
                cache_read_input_tokens:
                  response.usage.cache_read_input_tokens || 0,
              },
              total_cost_usd: response.total_cost_usd,
              model: response.model || undefined,
            });
          });
        } catch (error) {
          cleanup().then(() => {
            if (error instanceof SyntaxError) {
              reject(new Error("Failed to parse Claude CLI response as JSON"));
            } else {
              reject(error);
            }
          });
        }
      });
    });
  }
}
