# Chunk sidecars + RalphCI

**Start here:** CircleCI CTO **Rob Zuber** explains why inner-loop validation matters for AI-assisted development and how Chunk sidecars restore balance between local work and CI — [_Introducing Chunk sidecars: Inner loop validation that keeps up with your agents_](https://circleci.com/blog/chunk-sidecars/).

## What RalphCI adds

RalphCI is agent-agnostic orchestration: Build Agent, CI Doctor, and a deterministic **Review Gate**. This integration wires **optional** [Chunk](https://github.com/CircleCI-Public/chunk-cli) **remote microbuilds** into that gate:

1. Local steps run first (`format:fix`, `lint:fix`, `test:run` — same as before).
2. If `reviewGate.chunkSidecar.enabled` is true in `ralphci.json`, the CLI copies the project to the sidecar the **same way the [Chunk CLI README](https://github.com/CircleCI-Public/chunk-cli) describes** by default — **`chunk sidecar sync`** — then runs **`chunk validate --remote`** before push, using the same remote **`--workdir`** (default `./workspace/<repo-folder-name>`).

**Optional `syncMode: tar-ssh`:** RalphCI uploads a **gzipped tar** of your working tree to `remoteWorkdir` over the **same WebSocket + SSH tunnel** Chunk uses for sidecars, so **`chunk validate --remote`** can see **unpushed commits or a dirty tree** without `chunk sidecar sync` / `origin`. RalphCI does **not** pipe the tarball through **`chunk sidecar ssh`** — that CLI path does not forward stdin to the remote `exec` session in current Chunk CLI, so `tar xzf -` on the sidecar would see an immediate EOF. Implementation details, env vars, and troubleshooting: [tar-ssh workspace upload (WebSocket + SSH)](#tar-ssh-workspace-upload-websocket--ssh) below. **`tar-ssh`** is not supported on native Windows — use WSL, **`chunk-cli`**, or disable Chunk for that environment.

That gives **CI-parity feedback** (e.g. Linux, cloud environment) **before** your full pipeline runs on the branch. It does **not** replace CircleCI after push.

**Commands in this repo:** `.chunk/config.json` runs **install**, then **`pnpm lint`**, **`pnpm test:run`**, and **`pnpm build`** via **`scripts/chunk-remote-env.sh`** (same commands as the CircleCI `lint`, `test`, and `build` jobs).

## Commands and config

| Piece                                       | Role                                                                                                                                               |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ralphci check-chunk`                       | Verify Chunk CLI, auth, validations list (best-effort), active sidecar; optional Homebrew install of Chunk                                         |
| `reviewGate.chunkSidecar` in `ralphci.json` | Enable timeouts, `syncMode` (default **`chunk-cli`**; optional **`tar-ssh`**), `strictCli`, `skipSync`, `validateTarget`, optional `remoteWorkdir` |

See the main [README](../README.md#optional-circleci-chunk-sidecars) and [CHANGELOG](../CHANGELOG.md).

## tar-ssh workspace upload (WebSocket + SSH)

When `reviewGate.chunkSidecar.syncMode` is **`tar-ssh`**, RalphCI’s Review Gate runs **`src/utils/chunk-sidecar-tar-sync.ts`**: local **`tar czf -`** (with excludes) is streamed into an SSH **`exec`** channel over the sidecar tunnel, where the remote shell runs **`tar xzf -`** into **`remoteWorkdir`**. After the tree is present, RalphCI still invokes **`chunk validate --remote`** the same as in **`chunk-cli`** mode (Chunk CLI on `PATH`; workdir aligned with `remoteWorkdir`).

**Quick test (upload only, no `chunk validate`):** from the repo root, with **`CIRCLE_TOKEN`** and an active sidecar set up as in the prerequisites below:

```bash
pnpm exec tsx scripts/try-chunk-tar-ssh-sync.ts
```

Optional first argument: package root directory (default: current working directory). Exit code **0** means the tarball was extracted on the sidecar successfully.

### Why not use chunk sidecar ssh for the tarball

The Chunk CLI’s non-interactive **`chunk sidecar ssh … -- command`** path wires **no stdin** into the Go helper that runs the remote command (stdin is passed as **`nil`** into the SSH exec helper). Anything you pipe into the **`chunk`** process locally therefore **never reaches** the remote `tar` reading from **`-`**. Symptom: **`gzip: stdin: unexpected end of file`**, **`tar: Child returned status 1`**, and on the sender **`EPIPE`** / **`write EPIPE`** when the remote side closes early. Fixing that requires a **Chunk CLI change** (forward a readable stdin into the SSH session when not using a TTY) or an alternate transport. RalphCI uses the alternate below.

### What RalphCI does (high level)

1. **Git root** — Walks upward from the package root (Review Gate cwd) until it finds **`.git`**, same idea Chunk uses for per-project state.
2. **Active sidecar id** — Reads **`sidecar.json`** under Chunk’s per-project data directory: **`$XDG_DATA_HOME/chunk/<digest>/sidecar.json`** (default **`~/.local/share/chunk/<digest>/...`**). **`<digest>`** is the **hex-encoded SHA-256** (64 lowercase hex chars) of the **UTF-8 bytes** of **`path.resolve(path.normalize(gitRoot))`**, matching Chunk’s layout. The JSON field is **`sidecar_id`** (must exist after **`chunk sidecar use <id>`**).
3. **Register a one-shot tunnel key** — **`POST {CIRCLECI_BASE_URL}/api/v3/sidecar/instances/{sidecar_id}/ssh/add-key`** with header **`Circle-Token: $CIRCLE_TOKEN`** and body **`{ "public_key": "<contents of chunk_ai.pub>" }`**. The response includes a tunnel **`url`** under **`data.attributes.url`** (HTTPS host; RalphCI upgrades it to **`wss://…/ssh/tunnel`**). **Do not use `/api/v2/…`** — that path returns **410 Gone**.
4. **Open the tunnel** — Connect with the **`ws`** package (`rejectUnauthorized: false` on TLS, matching Chunk’s tunnel client behavior). Host key trust uses **`~/.ssh/chunk_ai_known_hosts`** next to the identity file (TOFU append on first connect; then fingerprint must match), same pattern as Chunk.
5. **SSH exec + tar** — **`ssh2`** connects over the WebSocket stream (`sock`), authenticates with **`~/.ssh/chunk_ai`** (or **`CHUNK_IDENTITY_FILE`** / **`RALPHCI_CHUNK_IDENTITY_FILE`**), **`exec`**’s a small **`sh -lc`** script that **replaces** **`remoteWorkdir`** from tarball stdin. Before **`rm -rf`**, it **stashes** **`${remoteWorkdir}/.chunk-node`** (if present) beside the workspace and restores it after **`tar xzf`** so the next **`chunk validate --remote`** does not re-download the Linux Node tarball every Review Gate (your terminal run is usually “warm”; **`tar-ssh` used to be cold every time**).

Validate still runs via your local **`chunk`** binary (`chunk validate --remote --workdir …`); only the **workspace copy** step avoids **`chunk sidecar sync`**.

### Prerequisites (tar-ssh)

| Requirement          | Notes                                                                                                                                                                                                      |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`CIRCLE_TOKEN`**   | Personal API token in the environment (same as other CircleCI HTTP calls). **`tar-ssh` fails fast** if it is missing.                                                                                      |
| **SSH key pair**     | Default private key **`~/.ssh/chunk_ai`** and **`~/.ssh/chunk_ai.pub`**. Override with **`CHUNK_IDENTITY_FILE`** or **`RALPHCI_CHUNK_IDENTITY_FILE`** (path to private key; public key is **`$KEY.pub`**). |
| **Known hosts file** | **`$(dirname "$identity")/chunk_ai_known_hosts`** — created/updated on first successful connect (TOFU).                                                                                                    |
| **Active sidecar**   | Chunk state **`sidecar.json`** must exist for the repo’s git root (run **`chunk sidecar use <id>`** after create/select).                                                                                  |
| **Chunk CLI**        | Still required for **`chunk validate --remote`** after upload. **`ralphci check-chunk`** remains the best preflight.                                                                                       |

### Environment variables

| Variable                                                      | Role                                                                      |
| ------------------------------------------------------------- | ------------------------------------------------------------------------- |
| **`CIRCLE_TOKEN`**                                            | Required for **`add-key`**.                                               |
| **`CIRCLECI_BASE_URL`**                                       | Optional. Default **`https://circleci.com`**. Trailing slash is stripped. |
| **`XDG_DATA_HOME`**                                           | Optional. Defaults to **`~/.local/share`** when unset (Chunk-compatible). |
| **`CHUNK_IDENTITY_FILE`** / **`RALPHCI_CHUNK_IDENTITY_FILE`** | Optional. Path to SSH private key (public key path is **`$KEY.pub`**).    |

### Dependencies (RalphCI tool repo)

Workspace upload uses runtime dependencies **`ssh2`** and **`ws`** (see **`package.json`**). **`chunk validate --remote`** does not use them.

### Upstream alternative

If **`chunk sidecar ssh`** gains **stdin forwarding** into the remote **`exec`** session for non-interactive use, RalphCI could optionally switch back to “pipe tar into Chunk” for simplicity. Until then, **`tar-ssh`** uses the tunnel described above.

### Troubleshooting (tar-ssh)

| Symptom                                                                                      | Likely cause                                                                                                                       | What to do                                                                                                                                                                                                                                                                                                                                                     |
| -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Review Gate says **`CIRCLE_TOKEN`** / **`add-key` failed**                                   | Missing or invalid token, wrong base URL, or sidecar id                                                                            | Export **`CIRCLE_TOKEN`**, confirm sidecar id with **`chunk sidecar current`**, set **`CIRCLECI_BASE_URL`** if you use a custom Circle host.                                                                                                                                                                                                                   |
| **`add-key failed (410)`** / **`Internal server error`** on sidecar HTTP                     | Client still calling removed **`/api/v2/sidecar/…`** (or very old **`chunk`**)                                                     | RalphCI **`tar-ssh`** must use **`/api/v3/…`**. Upgrade **`chunk`** (`brew upgrade chunk`). Recreate/select a live sidecar if the instance itself is gone.                                                                                                                                                                                                     |
| **`No active sidecar state`** / missing **`sidecar.json`**                                   | Chunk project state not initialized for this git root                                                                              | **`chunk sidecar use <id>`** from the repo; confirm **`~/.local/share/chunk/<hash>/`** exists.                                                                                                                                                                                                                                                                 |
| **`SSH key not found`**                                                                      | Default or overridden identity missing                                                                                             | Create **`~/.ssh/chunk_ai`** + **`.pub`**, or set **`CHUNK_IDENTITY_FILE`**.                                                                                                                                                                                                                                                                                   |
| **`gzip: stdin: unexpected end of file`** when piping into **`chunk sidecar ssh`** manually  | Chunk does not forward piped stdin to remote exec                                                                                  | Use **`tar-ssh`** in RalphCI (this doc) or **`chunk-cli`** sync; do not rely on piping **`stdin`** into **`chunk sidecar ssh … 'tar xzf -'`** until Chunk supports it.                                                                                                                                                                                         |
| **`Host denied (verification failed)`**                                                      | Stale host key, or OpenSSH **`known_hosts`** lines were not recognized (fixed in current RalphCI)                                  | RalphCI accepts **OpenSSH** lines (`host ssh-ed25519 AAAA…` from Chunk/`ssh`) and compact **`host <64-hex>`**. If the tunnel host key really changed, remove that hostname’s line in **`~/.ssh/chunk_ai_known_hosts`** (or delete the file) and retry TOFU.                                                                                                    |
| **`host key mismatch` / `ssh: handshake failed`** for **`*.e2b.app`** (Chunk CLI or tar-ssh) | E2B sidecar VMs recycle; SSH host keys change while names can repeat                                                               | RalphCI **prunes stale `.e2b.app` lines** from **`chunk_ai_known_hosts`** before Review Gate Chunk steps and before **`tar-ssh`**. Run **`ralphci check-chunk`** once to refresh the same file for manual **`chunk validate --remote`**. Otherwise delete those lines (or use **`ssh-keygen -R 'host' -f ~/.ssh/chunk_ai_known_hosts`**).                      |
| **`Chunk tar-ssh sync timed out`** / Review Gate **filesystem sync** hits the limit          | Upload + remote **`tar xzf`** exceeds **`syncTimeoutSeconds`**                                                                     | Raise **`reviewGate.chunkSidecar.syncTimeoutSeconds`** in `ralphci.json` (default **180**). Large repos or slow uplinks may need more.                                                                                                                                                                                                                         |
| **`Chunk validate --remote TIMED OUT`**                                                      | Cold sidecar, Node/pnpm bootstrap, or slow microbuild gates exceed **`remoteValidateTimeoutSeconds`**                              | **`tar-ssh`** used to wipe **`.chunk-node`** on every upload (full Node bootstrap + **`pnpm install`** each gate); RalphCI now **reuses** **`.chunk-node`** on the sidecar between uploads. Raise **`remoteValidateTimeoutSeconds`** only if you still exceed the budget. **Lint**/**test** in **`.chunk/config.json`** can each use up to **300s** on the VM. |
| **`remote … exited without exit status or exit signal`** (Chunk CLI)                         | SSH channel closed before **`exit-status`** (OOM during **`pnpm install`**, flaky tunnel, or **`exec`** replacing the login shell) | Retry **`chunk validate --remote`** or a fresh sidecar. **`scripts/chunk-remote-env.sh`** avoids **`exec`** on Linux so the shell stays the session leader; **`pnpm install`** uses **`--child-concurrency 2`** in **`.chunk/config.json`** to cut peak RAM on small VMs.                                                                                      |
| **`WebSocket` / `SSH connection error`**                                                     | Network, recycled VM, or bad tunnel URL                                                                                            | New sidecar + **`chunk sidecar add-ssh-key`** + retry; see SSH lifecycle notes below.                                                                                                                                                                                                                                                                          |

## Consumer setup (your app repo)

Chunk project setup (`chunk init`, sidecar create/use) lives in **your** repository — not committed into the `ralph-ci` tool repo by default. See the README section **Optional: CircleCI Chunk sidecars** for the numbered checklist (SSH key, sidecar, `ralphci.json`).

## Lessons learned (operations)

These issues showed up while wiring Chunk for **this** repo (`ralph-ci`); other monorepos may hit the same patterns.

### 1. Remote `--workdir` must match where the tree is uploaded

- **`chunk validate --remote`** defaults to working directory **`./workspace`** on the sidecar.
- With **`syncMode: chunk-cli`** (default), Chunk’s **`chunk sidecar sync`** places the project under that path (idiomatic per Chunk docs).
- With **`syncMode: tar-ssh`**, RalphCI extracts the tarball to **`remoteWorkdir`** (same default path).

If validate runs in the wrong directory, the install step can fail with `cd: can't cd to ./workspace`.

**Fix:** Always pass the same path to sync and validate, e.g. `./workspace/$(basename "$PWD")` from the package root, or rely on **RalphCI** (the Review Gate resolves and passes `--workdir` by default; override with `reviewGate.chunkSidecar.remoteWorkdir` if needed).

### 2. Sidecars often have no `pnpm` / `npm` / `corepack` on `PATH`

Minimal VM images may not include a Node package manager. **Corepack** `pnpm prepare` failed in our environment with a **signature verification** error, so bootstrapping via **Node tarball + `npm install -g pnpm`** was more reliable.

**This repository:** `scripts/chunk-remote-env.sh` (Linux only; macOS passthrough) downloads **Node 20.18.1** under **`.chunk-node/`**, installs **pnpm@9.15.6** globally with npm, then `exec`’s your command. `.chunk/config.json` prefixes `install`, `lint`, and `test` with that script. **`.chunk-node/`** is gitignored.

Other projects can copy the pattern or use `chunk sidecar setup` / custom images if Chunk supports them.

### 3. SSH key and sidecar lifecycle

- Chunk defaults to **`~/.ssh/chunk_ai`** (override with **`--identity-file`** on Chunk subcommands).
- After **`chunk sidecar create`**, run **`chunk sidecar add-ssh-key --public-key-file ~/.ssh/chunk_ai.pub`** again for the **new** active sidecar.
- **`ssh: handshake failed` / `EOF`** usually means the **old sidecar endpoint** was recycled. **Create a new sidecar**, re-add the key, **`chunk sidecar sync`**, then **`chunk validate --remote`**.

### 4. `chunk validate --list` in headless environments

`chunk validate --list` may **hang or return no output** when run from automation without a TTY. **`ralphci check-chunk`** uses a timeout for this step; a clean list is **not** required for readiness. Prefer **`chunk sidecar current`** plus a real **`chunk validate --remote --workdir …`** smoke test.

### 6. `sh: cannot open scripts/…` after `git push` (sidecar never picked up new files)

`chunk sidecar sync` may print **“No local changes relative to remote base”** and still leave an **older tree** on the VM, so new scripts never appear while `scripts/chunk-remote-env.sh` (already present) keeps working.

**Fix:** Remove the remote workdir and sync again, e.g. `chunk sidecar ssh -- rm -rf workspace/ralph-ci` (adjust path to match your `--workdir`; use `pwd` / `ls` over SSH if unsure), then `chunk sidecar sync --workdir "./workspace/$(basename "$PWD")"` and re-run **`chunk validate --remote`**.

**This repository:** install, lint, test, and build all go through `scripts/chunk-remote-env.sh`. If a sync prints “No local changes” and the remote tree looks stale, remove the remote workdir and sync again (see above).

## References

- [Introducing Chunk sidecars](https://circleci.com/blog/chunk-sidecars/) — Rob Zuber (CircleCI blog)
- [Chunk CLI](https://github.com/CircleCI-Public/chunk-cli)
