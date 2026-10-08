/**
 * One-shot test of Review Gate tar-ssh workspace upload (no full experiment).
 *
 * Usage (from repo root):
 *   pnpm exec tsx scripts/try-chunk-tar-ssh-sync.ts
 *   pnpm exec tsx scripts/try-chunk-tar-ssh-sync.ts /path/to/package-root
 *
 * Requires: CIRCLE_TOKEN, active Chunk sidecar (chunk sidecar use …),
 * ~/.ssh/chunk_ai (+ .pub). Does not run chunk validate --remote.
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { runChunkSidecarTarStreamSync } from "../src/utils/chunk-sidecar-tar-sync.js";
import { resolveChunkRemoteWorkdir } from "../src/utils/review-gate.js";

function findPackageRoot(workingDirectory: string): string {
  let dir = path.resolve(workingDirectory);
  const root = path.parse(dir).root;
  while (dir !== root) {
    if (existsSync(path.join(dir, "package.json"))) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  return workingDirectory;
}

const wd = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const localRoot = findPackageRoot(wd);
const remoteWorkdir = resolveChunkRemoteWorkdir(wd);

console.log("localRoot:", localRoot);
console.log("remoteWorkdir:", remoteWorkdir);
console.log("Running tar-ssh sync (Review Gate upload step only)…\n");

const r = await runChunkSidecarTarStreamSync({
  localRoot,
  remoteWorkdir,
  timeoutSeconds: 180,
});

console.log(JSON.stringify(r, null, 2));
process.exit(r.pass ? 0 : 1);
