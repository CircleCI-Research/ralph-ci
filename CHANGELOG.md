# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] - 2026-10-08

### Added

- **`ci.doctor.maxInvocationsPerFailureFingerprint`** (default **1**): after this many CI Doctor runs for the same stable failure digest (failed job names + logs), RalphCI **skips** further doctor invocations until the next **git push** and defers to the Build Agent with CI logs in the prompt.
- **`scripts/try-chunk-tar-ssh-sync.ts`:** run the Review Gate **tar-ssh** workspace upload step alone (no full `ralphci run` experiment); `pnpm exec tsx scripts/try-chunk-tar-ssh-sync.ts` from the repo root (optional package-root path argument). Documented in [docs/CHUNK_SIDECARS.md](docs/CHUNK_SIDECARS.md).
- **`ralphci check-chunk --upgrade-chunk`:** runs **`brew upgrade CircleCI-Public/circleci/chunk`** (when Homebrew is available) then **`chunk upgrade`** so installs track the latest Chunk CLI release ([Chunk CLI README](https://github.com/CircleCI-Public/chunk-cli)).

### Changed

- **Build Agent + Review Gate:** when the Review Gate is enabled, it runs after **`<promise>success</promise>`** and **`<promise>ci-fix-attempted</promise>`** regardless of auto-push. The orchestrator **always creates a local git commit** when there are changes (subject `feat: …` or `fix(ci): …`, body merges `<commit-description>` with a Review Gate footer). **`git push`** runs only when the gate passes and `git.autoPush` + `git.pushOnLocalSuccess` allow it. **`<promise>COMPLETE</promise>`** finalize: same pattern (local `chore: finalize` commit if the gate fails; push only after a passing gate). All-task completion (`exitSuccess`) requires a **passing** Review Gate on that success path.
- **CI Doctor git history:** each CI Doctor attempt that signals `<promise>ci-fix-attempted</promise>` is committed **locally** immediately after the Review Gate runs on that attempt (pass or fail), so history lists every try. **`git push`** runs only when the gate passes and auto-push is enabled. Subjects: **`fix(ci):`** for CircleCI pipeline doctor runs, **`fix(ci-sidecar):`** for Chunk-only doctor runs. Commit bodies merge optional `<commit-description>` from the agent with a short orchestrator footer (Review Gate outcome; pipeline runs also list failing job names when known).
- **`.chunk/config.json`:** remote validate now runs **`pnpm build`** (TypeScript compile) after **`pnpm test:run`**, matching the CircleCI **`build`** job so the inner loop catches build failures before push.
- **Default `reviewGate.chunkSidecar.remoteValidateTimeoutSeconds`:** **300** (was **120**) so `chunk validate --remote` can finish after sidecar bootstrap / install / gates; raise further in `ralphci.json` if needed.
- **Default `reviewGate.chunkSidecar.syncMode`:** **`chunk-cli`** (`chunk sidecar sync` + `chunk validate --remote`, matching [Chunk CLI](https://github.com/CircleCI-Public/chunk-cli) docs) instead of **`tar-ssh`**. Set **`tar-ssh`** when you need a gzipped tar uploaded over the CircleCI sidecar **WebSocket + SSH** tunnel for unpushed/dirty trees without `origin` refs (not supported on native Windows; does not pipe stdin through `chunk sidecar ssh` — see [docs/CHUNK_SIDECARS.md](docs/CHUNK_SIDECARS.md)).
- **Public CI:** `.circleci/config.yml` runs `lint`, `pnpm test:run`, and `build`. `.chunk/config.json` runs install, lint, test, and build. Study-only CircleCI jobs are not part of this tree.

### Removed

- **Legacy marker gates** (`require-snake-md`, `require-legal-disclaimer-md`) are not part of this repo's Chunk or CircleCI config.

### Fixed

- **Chunk sidecar / CI Doctor:** Review Gate `chunk` subprocesses now **pipe and tee** stdout/stderr (bounded capture) and append the **tail of that output** to `chunkRemoteError` instead of telling the model to "scroll up" — inherited stdio was only visible in the human terminal, not in the static doctor prompt.
- **`tar-ssh` + Chunk validate slow / timing out vs terminal:** the remote extract step now **stashes and restores `.chunk-node`** (Linux Node cache used by **`scripts/chunk-remote-env.sh`**) across **`rm -rf` + `tar`**, so Review Gate does not cold-bootstrap Node on **every** upload. A warm **`chunk validate --remote`** in your shell was never doing that each time.
- **Chunk remote install / `ssh exec: wait: remote command exited without exit status or exit signal`:** `scripts/chunk-remote-env.sh` no longer **`exec`**’s into `pnpm` on Linux so the sidecar shell stays the SSH session leader and can emit a normal **`exit-status`**. `.chunk/config.json` **`pnpm install`** adds **`--child-concurrency 2`** to lower peak memory on small sidecars (OOM often drops the channel without an exit record).
- **Chunk / E2B `host key mismatch`:** before Review Gate `chunk` subprocesses and before **`tar-ssh`**, RalphCI removes **`*.e2b.app`** lines from **`chunk_ai_known_hosts`** (same file Chunk CLI uses) so recycled sidecars can re-TOFU without manual **`ssh-keygen -R`**. Run **`ralphci check-chunk`** to refresh that file for standalone **`chunk validate --remote`** too.
- **`tar-ssh` / `ws` (ESM):** use named **`createWebSocketStream`** from **`ws`** instead of **`WebSocket.createWebSocketStream`** (not present on the ESM default export), so the tunnel stream opens under `tsx` / `"type": "module"`.
- **`tar-ssh` / `known_hosts`:** accept **OpenSSH** entries (`host ssh-ed25519 AAAA…`) written by Chunk CLI / **`ssh`**, not only RalphCI’s compact **`host <64-hex>`** lines — fixes false **`Host denied (verification failed)`** when **`chunk_ai_known_hosts`** already contained a standard host key line. Compare keys with ssh2’s **`parseKey`** + **`equals`**, match hostnames **case-insensitively**, and surface a clearer error when a stored key no longer matches the tunnel host.
- **`tar-ssh`:** treat ssh2 **`close`** like **`exit`** when the remote **`exit-status`** is delayed or missing, so the upload step does not hang until the wall-clock timeout. Timeout error text suggests raising **`syncTimeoutSeconds`**.

### Documentation

- README **Chunk sidecars** section: expanded setup (SSH key, `--org-id`, smoke test, **`ralphci check-chunk --upgrade-chunk`**), troubleshooting table (workdir, pnpm/bootstrap, SSH EOF, `validate --list`), and pointers to `scripts/chunk-remote-env.sh` / `.chunk-node/`. `.chunk/config.json` runs install, lint, test, and build.
- [docs/CHUNK_SIDECARS.md](docs/CHUNK_SIDECARS.md): default **`chunk-cli`** sync matches [Chunk CLI](https://github.com/CircleCI-Public/chunk-cli) docs; optional **`tar-ssh`** (WebSocket + `ssh2` workspace upload, `CIRCLE_TOKEN`, `sidecar.json` path, env vars); quick test via **`scripts/try-chunk-tar-ssh-sync.ts`**; repaired **tar-ssh** troubleshooting table; “Lessons learned” for remote workdir, minimal sidecar toolchains, Corepack vs npm global pnpm, SSH lifecycle, headless `--list`, and non-interactive sidecar create.
- AGENTS.md: cross-link to `docs/CHUNK_SIDECARS.md` for Chunk operations.

## [1.1.0] - 2026-05-07

### Added

- **Chunk sidecar integration (optional):** When `reviewGate.chunkSidecar.enabled` is set in `ralphci.json`, the Review Gate runs `chunk sidecar sync` and `chunk validate --remote` after local format/lint/tests pass, for CI-parity microbuilds. Background: CircleCI CTO **Rob Zuber**, [_Introducing Chunk sidecars: Inner loop validation that keeps up with your agents_](https://circleci.com/blog/chunk-sidecars/). Configurable timeouts, optional `validateTarget`, `skipSync`, and `strictCli` ([Chunk CLI](https://github.com/CircleCI-Public/chunk-cli)). See also `docs/CHUNK_SIDECARS.md`.
- **`ralphci check-chunk`:** Verifies Chunk CLI, `chunk auth status`, `chunk validate --list`, and `chunk sidecar current`. On macOS/Linux, installs Chunk via Homebrew automatically when the binary is missing (disable with `--no-brew-install`).
- Shared **`chunk-cli`** helpers for version detection used by the Review Gate and `check-chunk`.
- Tests and README documentation for the above.

### Changed

- README corrections (e.g. Key Files: `tasks.json` vs plan content).

[1.2.0]: https://github.com/CircleCI-Research/ralph-ci/releases
[1.1.0]: https://github.com/CircleCI-Research/ralph-ci/releases
