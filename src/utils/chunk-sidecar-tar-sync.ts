/**
 * Filesystem sync to a Chunk sidecar without `chunk sidecar sync` (which may
 * `git reset` to SHAs not yet on GitHub). Streams a gzipped tar of the local
 * tree over the same WebSocket + SSH tunnel Chunk uses, with stdin wired to
 * the remote `tar` (Chunk's `chunk sidecar ssh` CLI does not forward stdin to
 * `ExecOverSSH` — see CircleCI-Public/chunk-cli `internal/sidecar/sidecar.go`).
 */
import { spawn } from "child_process";
import { createHash, timingSafeEqual } from "crypto";
import { Buffer } from "node:buffer";
import * as nodeFs from "node:fs";
import type { Duplex } from "node:stream";
import { URL } from "node:url";
import { readFile, access } from "fs/promises";
import { constants as fsConstants } from "fs";
import path from "path";
import os from "os";
import { createRequire } from "node:module";
import { clearTimeout, setTimeout } from "timers";
import { Client } from "ssh2";
import type { ClientChannel } from "ssh2";
import WebSocket, { createWebSocketStream } from "ws";
import {
  CHUNK_AI_KNOWN_HOSTS_BASENAME,
  pruneE2bHostKeysFromChunkAiKnownHosts,
  resolveChunkSshIdentityPath,
} from "./chunk-ai-known-hosts.js";

const require = createRequire(import.meta.url);
const ssh2ParseKey = require("ssh2/lib/protocol/keyParser.js").parseKey as (
  data: string | Buffer,
) => { equals(other: unknown): boolean } | Error;

/** Paths excluded from the tarball (heavy or reproducible on the sidecar). */
export const CHUNK_SIDECAR_TAR_EXCLUDES: readonly string[] = [
  "node_modules",
  ".pnpm-store",
  "pnpm-store",
  ".git",
  ".chunk-node",
  "dist",
  "coverage",
  ".turbo",
  "test-results",
  ".next",
  "build",
  // macOS AppleDouble / copyfile metadata — not valid TS; breaks eslint "**/*.ts" on Linux
  "._*",
  ".DS_Store",
];

const CHUNK_SSH_USER = "user";

/**
 * Remote workdir must be a simple relative path (Chunk default is ./workspace/<repo>).
 */
export function isSafeChunkSidecarTarDest(remoteWorkdir: string): boolean {
  return /^[\w./-]+$/.test(remoteWorkdir) && !remoteWorkdir.includes("..");
}

export function buildTarArgs(localRoot: string): string[] {
  const args = ["-c", "-z", "-f", "-"];
  for (const ex of CHUNK_SIDECAR_TAR_EXCLUDES) {
    args.push("--exclude", ex);
  }
  args.push("-C", localRoot, ".");
  return args;
}

export interface ChunkSidecarTarSyncOptions {
  localRoot: string;
  remoteWorkdir: string;
  timeoutSeconds: number;
}

/** Chunk stores per-project state under ~/.local/share/chunk/<sha256(gitRoot)>/ */
export function chunkProjectDataDir(gitRootAbs: string): string {
  const dataHome =
    process.env.XDG_DATA_HOME ?? path.join(os.homedir(), ".local", "share");
  const sum = createHash("sha256")
    .update(path.resolve(path.normalize(gitRootAbs)))
    .digest("hex");
  return path.join(dataHome, "chunk", sum);
}

function findGitRoot(startDir: string): string {
  let dir = path.resolve(startDir);
  for (;;) {
    if (nodeFs.existsSync(path.join(dir, ".git"))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      return path.resolve(startDir);
    }
    dir = parent;
  }
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await access(p, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function loadActiveSidecarId(
  localRoot: string,
): Promise<{ id: string } | { error: string }> {
  const gitRoot = findGitRoot(localRoot);
  const sidecarPath = path.join(chunkProjectDataDir(gitRoot), "sidecar.json");
  if (!(await pathExists(sidecarPath))) {
    return {
      error: `No active sidecar state at ${sidecarPath}. Run \`chunk sidecar use <id>\` (or create a sidecar), then retry.`,
    };
  }
  try {
    const raw = await readFile(sidecarPath, "utf-8");
    const j = JSON.parse(raw) as { sidecar_id?: string };
    if (!j.sidecar_id || typeof j.sidecar_id !== "string") {
      return {
        error: `Invalid sidecar.json (missing sidecar_id): ${sidecarPath}`,
      };
    }
    return { id: j.sidecar_id };
  } catch (e) {
    return {
      error: `Could not read sidecar id: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

/**
 * Parse tunnel URL from CircleCI sidecar `ssh/add-key` JSON.
 * v3 (current): `{ data: { attributes: { url } } }`
 * Legacy flat body (defensive): `{ url }`
 */
export function parseSidecarAddKeyTunnelUrl(
  text: string,
): { url: string } | { error: string } {
  let j: unknown;
  try {
    j = JSON.parse(text) as unknown;
  } catch {
    return { error: `add-key response not JSON: ${text.slice(0, 400)}` };
  }
  if (!j || typeof j !== "object") {
    return { error: `add-key response missing url: ${text.slice(0, 400)}` };
  }
  const root = j as {
    url?: unknown;
    data?: { attributes?: { url?: unknown } };
  };
  const nested = root.data?.attributes?.url;
  if (typeof nested === "string" && nested.trim()) {
    return { url: nested.trim() };
  }
  if (typeof root.url === "string" && root.url.trim()) {
    return { url: root.url.trim() };
  }
  return { error: `add-key response missing url: ${text.slice(0, 400)}` };
}

async function fetchSidecarTunnelWsUrl(
  circleToken: string,
  sidecarId: string,
  publicKey: string,
): Promise<{ url: string } | { error: string }> {
  const base =
    process.env.CIRCLECI_BASE_URL?.replace(/\/$/, "") ?? "https://circleci.com";
  // Sidecar HTTP moved off api/v2 (returns 410 Gone); Chunk CLI ≥0.7.x uses v3.
  const url = `${base}/api/v3/sidecar/instances/${encodeURIComponent(sidecarId)}/ssh/add-key`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Circle-Token": circleToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ public_key: publicKey.trim() }),
    });
    const text = await res.text();
    if (!res.ok) {
      const hint =
        res.status === 410
          ? " (sidecar v2 API removed — use /api/v3 and upgrade `chunk`; or recreate a live sidecar)"
          : "";
      return {
        error: `CircleCI add-key failed (${res.status})${hint}: ${text.slice(0, 800)}`,
      };
    }
    return parseSidecarAddKeyTunnelUrl(text);
  } catch (e) {
    return {
      error: `CircleCI add-key request failed: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

function toWebSocketUrl(raw: string): { wsUrl: string; host: string } {
  let u = raw.trim();
  if (!u.includes("://")) {
    u = `ws://${u}`;
  }
  const parsed = new URL(u);
  if (parsed.protocol === "http:") parsed.protocol = "ws:";
  else if (parsed.protocol === "https:") parsed.protocol = "wss:";
  if (!parsed.pathname.endsWith("/ssh/tunnel")) {
    parsed.pathname = `${parsed.pathname.replace(/\/$/, "")}/ssh/tunnel`;
  }
  return { wsUrl: parsed.toString(), host: parsed.hostname };
}

function hostKeyFingerprintHex(key: Buffer): string {
  return createHash("sha256").update(key).digest("hex");
}

function hostsEqualDns(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

/**
 * First column of known_hosts may be `host`, `h1,h2`, or `[host]:port`.
 */
export function knownHostsFirstColumnMatchesHost(
  firstCol: string,
  host: string,
): boolean {
  for (const raw of firstCol.split(",")) {
    const p = raw.trim();
    if (hostsEqualDns(p, host)) return true;
    if (p.startsWith("[") && p.includes("]:")) {
      const inner = p.slice(1, p.indexOf("]"));
      if (hostsEqualDns(inner, host)) return true;
    }
  }
  return false;
}

/** Result of checking one non-empty known_hosts line against (host, serverKey). */
export type KnownHostLineVerifyResult = "match" | "mismatch" | "skip";

/**
 * Match OpenSSH `known_hosts` (`host ssh-ed25519 AAAA…`) or RalphCI's compact
 * `host <64-hex-sha256-of-wire-key>` lines. Chunk CLI / `ssh` write OpenSSH
 * format; older RalphCI wrote hex-only — both must verify.
 */
export function verifyKnownHostLine(
  line: string,
  host: string,
  serverKey: Buffer,
): KnownHostLineVerifyResult {
  const t = line.trim();
  if (!t || t.startsWith("#")) return "skip";
  if (t.startsWith("@")) return "skip";
  if (t.startsWith("|")) return "skip";
  const parts = t.split(/\s+/);
  if (parts.length < 2) return "skip";
  if (!knownHostsFirstColumnMatchesHost(parts[0], host)) return "skip";
  if (parts.length >= 3 && parts[1].startsWith("ssh-")) {
    const b64 = parts[2];
    if (!/^[A-Za-z0-9+/]+=*$/.test(b64)) return "skip";
    let blob: Buffer;
    try {
      blob = Buffer.from(b64, "base64");
    } catch {
      return "skip";
    }
    const lineKeyStr = `${parts[1]} ${b64}`;
    const parsedLine = ssh2ParseKey(lineKeyStr);
    const parsedSrv = ssh2ParseKey(serverKey);
    if (!(parsedLine instanceof Error) && !(parsedSrv instanceof Error)) {
      return parsedLine.equals(parsedSrv) ? "match" : "mismatch";
    }
    if (blob.length !== serverKey.length) return "mismatch";
    return timingSafeEqual(blob, serverKey) ? "match" : "mismatch";
  }
  if (/^[0-9a-f]{64}$/i.test(parts[1])) {
    const fp = hostKeyFingerprintHex(serverKey);
    return parts[1].toLowerCase() === fp ? "match" : "mismatch";
  }
  return "skip";
}

async function openWsStream(wsUrl: string): Promise<Duplex> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl, {
      rejectUnauthorized: false,
    });
    ws.once("error", reject);
    ws.once("open", () => {
      const duplex = createWebSocketStream(ws);
      resolve(duplex);
    });
  });
}

/**
 * Shell executed on the sidecar: replace the workdir tree from tarball stdin.
 * Preserves **`${remoteWorkdir}/.chunk-node`** across wipes so Linux Node
 * bootstrap from **`scripts/chunk-remote-env.sh`** is not repeated on every
 * tar-ssh (Review Gate was much slower than a warm **`chunk validate --remote`**
 * in your terminal).
 */
export function buildTarSshRemoteExtractShell(remoteWorkdir: string): string {
  const rw = JSON.stringify(remoteWorkdir);
  return (
    `set -eu; RW=${rw}; ` +
    'STASH_DIR="$(dirname "$RW")/.ralphci-chunk-node-stash-$(basename "$RW")"; ' +
    'if [ -d "$RW/.chunk-node" ]; then rm -rf "$STASH_DIR"; mv "$RW/.chunk-node" "$STASH_DIR"; fi; ' +
    'rm -rf "$RW"; mkdir -p "$RW"; ' +
    'tar xzf - -C "$RW"; ' +
    'if [ -d "$STASH_DIR" ]; then rm -rf "$RW/.chunk-node"; mv "$STASH_DIR" "$RW/.chunk-node"; fi'
  );
}

/**
 * Stream `tar czf -` over Chunk's SSH tunnel (WebSocket + ssh2) into remote tar.
 */
export async function runChunkSidecarTarStreamSync(
  options: ChunkSidecarTarSyncOptions,
): Promise<{ pass: boolean; timedOut: boolean; error: string | null }> {
  const { localRoot, remoteWorkdir, timeoutSeconds } = options;

  if (process.platform === "win32") {
    return {
      pass: false,
      timedOut: false,
      error:
        'chunkSidecar.syncMode "tar-ssh" is not supported on Windows. Use WSL, set syncMode to "chunk-cli", or disable Chunk.',
    };
  }

  if (!isSafeChunkSidecarTarDest(remoteWorkdir)) {
    return {
      pass: false,
      timedOut: false,
      error: `Invalid remoteWorkdir for tar-ssh sync (use only letters, digits, /, ., _, -): ${remoteWorkdir}`,
    };
  }

  const token = process.env.CIRCLE_TOKEN?.trim();
  if (!token) {
    return {
      pass: false,
      timedOut: false,
      error:
        "tar-ssh requires CIRCLE_TOKEN in the environment (same as Chunk / CircleCI API). Export your personal API token, then retry.",
    };
  }

  const identityFile = resolveChunkSshIdentityPath();
  const pubPath = `${identityFile}.pub`;
  const knownHostsPath = path.join(
    path.dirname(identityFile),
    CHUNK_AI_KNOWN_HOSTS_BASENAME,
  );

  try {
    await access(identityFile, fsConstants.R_OK);
    await access(pubPath, fsConstants.R_OK);
  } catch {
    return {
      pass: false,
      timedOut: false,
      error: `SSH key not found for tar-ssh. Expected private key at ${identityFile} and public key at ${pubPath} (or set CHUNK_IDENTITY_FILE).`,
    };
  }

  pruneE2bHostKeysFromChunkAiKnownHosts();

  const sidecar = await loadActiveSidecarId(localRoot);
  if ("error" in sidecar) {
    return { pass: false, timedOut: false, error: sidecar.error };
  }

  let publicKey: string;
  try {
    publicKey = await readFile(pubPath, "utf-8");
  } catch (e) {
    return {
      pass: false,
      timedOut: false,
      error: `Could not read public key: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  const tunnel = await fetchSidecarTunnelWsUrl(token, sidecar.id, publicKey);
  if ("error" in tunnel) {
    return { pass: false, timedOut: false, error: tunnel.error };
  }

  const { wsUrl, host } = toWebSocketUrl(tunnel.url);
  let privateKey: Buffer;
  try {
    privateKey = await readFile(identityFile);
  } catch (e) {
    return {
      pass: false,
      timedOut: false,
      error: `Could not read private key: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  return new Promise((resolve) => {
    let settled = false;
    let stderr = "";
    let remoteOut = "";

    const timer = setTimeout(() => {
      killAll();
      settle({
        pass: false,
        timedOut: true,
        error: [
          `Chunk tar-ssh sync timed out after ${timeoutSeconds}s.`,
          "Large trees or slow uplinks need a higher `reviewGate.chunkSidecar.syncTimeoutSeconds` in ralphci.json.",
          "",
          "--- Output (tail) ---",
          (stderr + "\n" + remoteOut)
            .trim()
            .split("\n")
            .slice(-60)
            .join("\n") || "(no output captured)",
        ].join("\n"),
      });
    }, timeoutSeconds * 1000);

    function settle(result: {
      pass: boolean;
      timedOut: boolean;
      error: string | null;
    }) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    }

    const conn = new Client();
    let stream: ClientChannel | undefined;
    let tarChild: ReturnType<typeof spawn> | undefined;
    let sock: Duplex | undefined;
    let localTarCode: number | null = null;
    let remoteExitCode: number | null = null;

    function killAll() {
      try {
        tarChild?.kill("SIGKILL");
      } catch {
        /* ignore */
      }
      try {
        stream?.destroy();
      } catch {
        /* ignore */
      }
      try {
        conn.end();
      } catch {
        /* ignore */
      }
      try {
        (sock as { destroy?: () => void } | undefined)?.destroy?.();
      } catch {
        /* ignore */
      }
    }

    /** Both processes finished successfully (order-independent). */
    function trySettleBothSucceeded() {
      if (settled) return;
      if (localTarCode === null || remoteExitCode === null) return;
      if (localTarCode !== 0 || remoteExitCode !== 0) return;
      try {
        conn.end();
      } catch {
        /* ignore */
      }
      settle({ pass: true, timedOut: false, error: null });
    }

    let sshHostVerifyHint: string | null = null;

    void (async () => {
      try {
        sock = await openWsStream(wsUrl);
      } catch (e) {
        settle({
          pass: false,
          timedOut: false,
          error: `WebSocket to sidecar failed: ${e instanceof Error ? e.message : String(e)}`,
        });
        return;
      }

      conn.on("error", (err) => {
        if (settled) return;
        killAll();
        let detail = err.message;
        if (
          detail.includes("verification failed") &&
          sshHostVerifyHint !== null
        ) {
          detail = `${detail}. ${sshHostVerifyHint}`;
        }
        settle({
          pass: false,
          timedOut: false,
          error: `SSH connection error: ${detail}`,
        });
      });

      conn.connect({
        sock,
        host,
        username: CHUNK_SSH_USER,
        privateKey,
        strictVendor: false,
        readyTimeout: Math.min(timeoutSeconds * 1000, 120_000),
        hostVerifier: (key: Buffer, verify: (valid: boolean) => void) => {
          try {
            const fp = hostKeyFingerprintHex(key);
            if (!nodeFs.existsSync(knownHostsPath)) {
              nodeFs.mkdirSync(path.dirname(knownHostsPath), {
                recursive: true,
                mode: 0o700,
              });
              nodeFs.writeFileSync(knownHostsPath, `${host} ${fp}\n`, {
                mode: 0o600,
              });
              verify(true);
              return;
            }
            const contents = nodeFs.readFileSync(knownHostsPath, "utf-8");
            for (const line of contents.split("\n")) {
              const r = verifyKnownHostLine(line, host, key);
              if (r === "match") {
                verify(true);
                return;
              }
              if (r === "mismatch") {
                sshHostVerifyHint = `Remove or update the entry for host "${host}" in ${knownHostsPath} (sidecar host key no longer matches — common after a new sidecar or tunnel rotation), then retry.`;
                verify(false);
                return;
              }
            }
            nodeFs.appendFileSync(knownHostsPath, `${host} ${fp}\n`, {
              mode: 0o600,
            });
            verify(true);
          } catch {
            verify(false);
          }
        },
      });

      conn.on("ready", () => {
        const cmd = `sh -lc ${JSON.stringify(buildTarSshRemoteExtractShell(remoteWorkdir))}`;
        conn.exec(cmd, (err, ch) => {
          if (err || !ch) {
            killAll();
            settle({
              pass: false,
              timedOut: false,
              error: `SSH exec failed: ${err?.message ?? "no channel"}`,
            });
            return;
          }
          stream = ch;
          ch.stderr.on("data", (d: Buffer) => {
            stderr += d.toString();
          });
          ch.stdout.on("data", (d: Buffer) => {
            remoteOut += d.toString();
          });

          const tarArgs = buildTarArgs(localRoot);
          tarChild = spawn("tar", tarArgs, {
            stdio: ["ignore", "pipe", "pipe"],
            // macOS BSD tar synthesizes AppleDouble `._*` entries from extended
            // attributes during archive creation; `--exclude '._*'` cannot filter
            // synthesized entries, so they reach the Linux sidecar and break
            // vitest/esbuild ("Unexpected \x00" parsing the resource fork).
            env: { ...process.env, COPYFILE_DISABLE: "1" },
          });
          tarChild.stderr?.on("data", (d) => {
            stderr += d.toString();
          });

          tarChild.on("error", (e) => {
            if (settled) return;
            killAll();
            settle({
              pass: false,
              timedOut: false,
              error: `Local tar failed to start: ${e.message}`,
            });
          });

          tarChild.stdout?.on("error", (e) => {
            if (settled) return;
            killAll();
            settle({
              pass: false,
              timedOut: false,
              error: `tar stdout: ${e instanceof Error ? e.message : String(e)}`,
            });
          });

          ch.on("error", (e: Error) => {
            if (settled) return;
            killAll();
            settle({
              pass: false,
              timedOut: false,
              error: `Remote stream error: ${e.message}`,
            });
          });

          const onRemoteExecEnd = (
            code: number | null | undefined,
            signal: string | null | undefined,
            source: "exit" | "close",
          ) => {
            if (settled) return;
            if (remoteExitCode !== null) return;
            if (source === "close" && typeof code !== "number" && !signal) {
              return;
            }
            remoteExitCode = code ?? (signal ? -1 : 0);
            if (remoteExitCode !== 0) {
              killAll();
              const tail = (stderr + "\n" + remoteOut)
                .trim()
                .split("\n")
                .slice(-80)
                .join("\n");
              settle({
                pass: false,
                timedOut: false,
                error: `Chunk tar-ssh sync failed (exit ${remoteExitCode}):\n${tail}`,
              });
              return;
            }
            trySettleBothSucceeded();
          };

          ch.on("exit", (code: number | null, signal?: string | null) => {
            onRemoteExecEnd(code, signal, "exit");
          });
          ch.on("close", (code: number | null, signal?: string | null) => {
            onRemoteExecEnd(code, signal, "close");
          });

          if (!tarChild.stdout) {
            killAll();
            settle({
              pass: false,
              timedOut: false,
              error: "tar did not expose stdout",
            });
            return;
          }

          tarChild.stdout.pipe(ch);
          tarChild.on("close", (code) => {
            if (settled) return;
            localTarCode = code ?? -1;
            if (localTarCode !== 0) {
              killAll();
              const tail = stderr.split("\n").slice(-40).join("\n");
              settle({
                pass: false,
                timedOut: false,
                error: `Local tar failed (exit ${localTarCode}):\n${tail}`,
              });
              return;
            }
            ch.end();
            trySettleBothSucceeded();
          });
        });
      });
    })();
  });
}
