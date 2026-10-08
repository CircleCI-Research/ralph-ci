import path from "path";
import type { ValidationManifest } from "./validation-manifest.js";
import { formatManifestCompact } from "./validation-manifest.js";

/**
 * Build a one-turn Preflight Survey prompt for the Build Agent.
 * Agent should @-read gate configs/scripts on demand and write preflight.md.
 */
export function buildPreflightSurveyPrompt(
  workingDirectory: string,
  packageRoot: string,
  manifest: ValidationManifest,
  options: { pushMode: "per-task" | "epilogue"; pushStrategyLabel: string },
): string {
  const { pushMode, pushStrategyLabel } = options;
  const relRoot = path.relative(workingDirectory, packageRoot) || ".";
  const relWd = path.relative(packageRoot, workingDirectory) || ".";

  return `# Preflight Survey (one turn before task 1)

You are the **Build Agent** doing a **read-only survey** of validation gates for this run.
Do **not** implement Snake tasks yet. Do **not** signal \`<promise>success</promise>\`.

## Your job

1. Read the Validation Manifest below (gate names + pointers only).
2. **Selectively** \`@\`-read configs/scripts you need — do not dump entire files into chat.
   - Start with \`${relRoot}/.chunk/config.json\` and \`${relRoot}/.circleci/config.yml\` if helpful.
   - Read outer gate scripts only when you need specifics (paths in manifest table).
3. Write **\`preflight.md\`** in this working directory (\`${relWd}\`) with:
   - Inner gates that will apply once \`src/\` has files
   - Outer CI jobs that will run on push (thick workflow)
   - What you infer each gate checks (cite script paths, not guesses)
   - Push mode notes for this arm

## Push mode

- **Strategy:** ${pushStrategyLabel}
- **Mode:** ${pushMode}
${
  pushMode === "epilogue"
    ? "- Outer CI does **not** run until all tasks pass Review Gate locally (epilogue unlock).\n"
    : "- Each Review Gate–green task may **push** and trigger thick outer CI.\n"
}

## Output

When your survey is complete, write \`preflight.md\` and signal:

\`<promise>preflight-complete</promise>\`

Keep the survey concise and token-efficient.

---

${formatManifestCompact(manifest)}
`;
}

export function isPreflightCompleteSignal(result: string): boolean {
  return result.includes("<promise>preflight-complete</promise>");
}
