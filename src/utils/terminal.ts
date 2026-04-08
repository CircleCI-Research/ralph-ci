/**
 * Minimal terminal UI: colors, separators, full prompt display, and loading spinner.
 * Uses ANSI escape codes; safe when stdout is not a TTY (codes are harmless).
 */

const RESET = "\u001b[0m";
const DIM = "\u001b[2m";
const BOLD = "\u001b[1m";

// Tasteful palette (orange = Claude Code / 256-color 208)
const CYAN = "\u001b[36m";
const GREEN = "\u001b[32m";
const YELLOW = "\u001b[33m";
const RED = "\u001b[31m";
const MAGENTA = "\u001b[35m";
const BLUE = "\u001b[34m";
const ORANGE = "\u001b[38;5;208m";

export const c = {
  dim: (s: string) => `${DIM}${s}${RESET}`,
  bold: (s: string) => `${BOLD}${s}${RESET}`,
  cyan: (s: string) => `${CYAN}${s}${RESET}`,
  green: (s: string) => `${GREEN}${s}${RESET}`,
  yellow: (s: string) => `${YELLOW}${s}${RESET}`,
  red: (s: string) => `${RED}${s}${RESET}`,
  magenta: (s: string) => `${MAGENTA}${s}${RESET}`,
  blue: (s: string) => `${BLUE}${s}${RESET}`,
  orange: (s: string) => `${ORANGE}${s}${RESET}`,
};

/** Single horizontal rule for subtle separation */
const RULE_CHAR = "─";
const RULE_LENGTH = 60;

/**
 * Print a clear separator between iterations.
 */
export function printIterationSeparator(
  iteration: number,
  max: string | number,
  model?: string,
): void {
  const line = RULE_CHAR.repeat(RULE_LENGTH);
  const modelSuffix = model ? `  │  ${model}` : "";
  process.stdout.write("\n");
  process.stdout.write(c.cyan(`  ${line}\n`));
  process.stdout.write(
    c.cyan(`  ⟳ Iteration ${iteration}/${max}`) + c.dim(modelSuffix) + "\n",
  );
  process.stdout.write(c.cyan(`  ${line}\n\n`));
}

const PROMPT_BOX_WIDTH = 70;

/**
 * Print the full prompt in an orange box (Claude Code style).
 */
export function printFullPrompt(promptContent: string): void {
  const lines = promptContent.split("\n");

  const header = "Prompt";
  const topMiddle = "─ " + header + " ";
  const topDashes = Math.max(0, PROMPT_BOX_WIDTH - 2 - topMiddle.length);
  const top = "╭" + topMiddle + "─".repeat(topDashes) + "╮";
  const bottom = "╰" + "─".repeat(PROMPT_BOX_WIDTH - 2) + "╯";

  process.stdout.write("\n");
  process.stdout.write(c.orange(top) + "\n");
  process.stdout.write(c.orange("│") + "\n");

  for (const line of lines) {
    process.stdout.write(c.orange("│ ") + c.dim(line) + "\n");
  }

  process.stdout.write(c.orange("│") + "\n");
  process.stdout.write(c.orange(bottom) + "\n\n");
}

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const SPINNER_INTERVAL_MS = 80;

/**
 * Run an async task while showing a minimal spinner and message.
 * Clears the spinner line and prints a single result line when done.
 */
export async function withSpinner<T>(
  message: string,
  task: () => Promise<T>,
  doneMessage?: string,
): Promise<T> {
  let frameIndex = 0;
  const write = () => {
    const frame = SPINNER_FRAMES[frameIndex % SPINNER_FRAMES.length];
    frameIndex += 1;
    process.stdout.write(`\r  ${frame} ${c.cyan(message)}`);
  };

  write();
  const id = globalThis.setInterval(write, SPINNER_INTERVAL_MS);

  try {
    const result = await task();
    globalThis.clearInterval(id);
    process.stdout.write("\r" + " ".repeat(80) + "\r");
    if (doneMessage !== undefined) {
      process.stdout.write(c.green("  ✓ ") + c.dim(doneMessage) + "\n");
    }
    return result;
  } catch (err) {
    globalThis.clearInterval(id);
    process.stdout.write("\r" + " ".repeat(80) + "\r");
    throw err;
  }
}
