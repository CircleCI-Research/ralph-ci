import { createHash } from "node:crypto";
import type { CIStatus } from "./circleci-api.js";

/**
 * Stable digest of CircleCI failure logs + failed job identity so the
 * orchestrator can avoid re-invoking CI Doctor on an unchanged failure signature
 * until a push resets the counter (see CIQueryCache).
 */
export function computeCIFailureFingerprint(
  failureLogs: string | null | undefined,
  failedJobs: CIStatus["failedJobs"] | undefined,
): string {
  const jobs = (failedJobs ?? [])
    .map((j) => `${j.name}#${j.jobNumber}`)
    .sort()
    .join("|");
  const body = (failureLogs ?? "").replace(/\r\n/g, "\n").trim();
  const raw = `${jobs}\n${body}`;
  return createHash("sha256").update(raw, "utf8").digest("hex");
}

export function buildCIDoctorFingerprintSkipNotice(
  fingerprintShort: string,
): string {
  return `## CI Doctor skipped (unchanged failure signature)

CircleCI is still red with the same failure digest as a **previous CI Doctor run** in this session (\`${fingerprintShort}\`…).

The orchestrator will **not** call CI Doctor again for this signature until after a **git push** (which resets the counter). Use the logs below, fix the issue locally, run \`pnpm test:run\` / Review Gate, then signal \`<promise>ci-fix-attempted</promise>\` when you have a real CI fix to push, or \`<promise>needs-human</promise>\` if you are blocked.

---
`;
}
