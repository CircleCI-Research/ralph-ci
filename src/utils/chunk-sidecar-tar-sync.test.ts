import { describe, it, expect } from "vitest";
import {
  buildTarArgs,
  buildTarSshRemoteExtractShell,
  chunkProjectDataDir,
  CHUNK_SIDECAR_TAR_EXCLUDES,
  isSafeChunkSidecarTarDest,
  knownHostsFirstColumnMatchesHost,
  parseSidecarAddKeyTunnelUrl,
  verifyKnownHostLine,
} from "./chunk-sidecar-tar-sync.js";
import { createHash } from "crypto";
import { Buffer } from "node:buffer";
import os from "os";
import path from "path";

describe("isSafeChunkSidecarTarDest", () => {
  it("accepts typical Chunk workdir paths", () => {
    expect(isSafeChunkSidecarTarDest("./workspace/ralph-ci")).toBe(true);
    expect(isSafeChunkSidecarTarDest("workspace/foo-bar")).toBe(true);
  });

  it("rejects path traversal", () => {
    expect(isSafeChunkSidecarTarDest("../workspace/foo")).toBe(false);
    expect(isSafeChunkSidecarTarDest("./workspace/../x")).toBe(false);
  });

  it("rejects empty and odd characters", () => {
    expect(isSafeChunkSidecarTarDest("")).toBe(false);
    expect(isSafeChunkSidecarTarDest("./workspace foo")).toBe(false);
  });
});

describe("chunkProjectDataDir", () => {
  it("matches Chunk's sha256(hex(abs(normalize(gitRoot))))) layout under XDG_DATA_HOME", () => {
    const prev = process.env.XDG_DATA_HOME;
    process.env.XDG_DATA_HOME = "/xdg-data";
    const gitRoot = path.resolve("/tmp/example-repo");
    const sum = createHash("sha256")
      .update(path.resolve(path.normalize(gitRoot)))
      .digest("hex");
    expect(chunkProjectDataDir(gitRoot)).toBe(
      path.join("/xdg-data", "chunk", sum),
    );
    if (prev === undefined) {
      delete process.env.XDG_DATA_HOME;
    } else {
      process.env.XDG_DATA_HOME = prev;
    }
  });

  it("defaults XDG data home to ~/.local/share when unset", () => {
    const prev = process.env.XDG_DATA_HOME;
    delete process.env.XDG_DATA_HOME;
    const gitRoot = "/projects/foo";
    const sum = createHash("sha256")
      .update(path.resolve(path.normalize(gitRoot)))
      .digest("hex");
    expect(chunkProjectDataDir(gitRoot)).toBe(
      path.join(os.homedir(), ".local", "share", "chunk", sum),
    );
    if (prev === undefined) {
      delete process.env.XDG_DATA_HOME;
    } else {
      process.env.XDG_DATA_HOME = prev;
    }
  });
});

describe("buildTarSshRemoteExtractShell", () => {
  it("preserves .chunk-node across wipe + tar extract", () => {
    const s = buildTarSshRemoteExtractShell("./workspace/ralph-ci");
    expect(s).toContain('RW="./workspace/ralph-ci"');
    expect(s).toContain("STASH_DIR=");
    expect(s).toContain(".ralphci-chunk-node-stash-");
    expect(s).toContain(".chunk-node");
    expect(s).toContain("tar xzf -");
  });
});

describe("knownHostsFirstColumnMatchesHost", () => {
  it("matches plain host and [host]:port forms", () => {
    expect(
      knownHostsFirstColumnMatchesHost(
        "tunnel.example.com",
        "tunnel.example.com",
      ),
    ).toBe(true);
    expect(
      knownHostsFirstColumnMatchesHost(
        "[tunnel.example.com]:443",
        "tunnel.example.com",
      ),
    ).toBe(true);
    expect(
      knownHostsFirstColumnMatchesHost("other.com", "tunnel.example.com"),
    ).toBe(false);
  });

  it("matches when host is one of a comma-separated list", () => {
    expect(knownHostsFirstColumnMatchesHost("a.com,b.com", "b.com")).toBe(true);
  });

  it("matches hostnames case-insensitively", () => {
    expect(
      knownHostsFirstColumnMatchesHost(
        "Tunnel.EXAMPLE.com",
        "tunnel.example.com",
      ),
    ).toBe(true);
  });
});

describe("verifyKnownHostLine", () => {
  it("accepts RalphCI compact hex fingerprint lines", () => {
    const serverKey = Buffer.from("wire-bytes");
    const fp = createHash("sha256").update(serverKey).digest("hex");
    expect(
      verifyKnownHostLine(`sidecar.host ${fp}`, "sidecar.host", serverKey),
    ).toBe("match");
    expect(
      verifyKnownHostLine(
        `sidecar.host ${"a".repeat(64)}`,
        "sidecar.host",
        serverKey,
      ),
    ).toBe("mismatch");
  });

  it("accepts OpenSSH host key lines (same wire blob as serverKey)", () => {
    const serverKey = Buffer.from("openssh-wire-blob-test");
    const line = `tunnel.example.com ssh-test ${serverKey.toString("base64")}`;
    expect(verifyKnownHostLine(line, "tunnel.example.com", serverKey)).toBe(
      "match",
    );
    expect(
      verifyKnownHostLine(line, "tunnel.example.com", Buffer.from("other")),
    ).toBe("mismatch");
  });

  it("skips unrelated hosts and markers", () => {
    const k = Buffer.from("x");
    expect(
      verifyKnownHostLine("# tunnel.example.com", "tunnel.example.com", k),
    ).toBe("skip");
    expect(verifyKnownHostLine("|1|hashed", "tunnel.example.com", k)).toBe(
      "skip",
    );
    expect(verifyKnownHostLine("@revoked h ssh-rsa AAA", "h", k)).toBe("skip");
    expect(
      verifyKnownHostLine("other.host ssh-x AAAA", "tunnel.example.com", k),
    ).toBe("skip");
  });
});

describe("buildTarArgs", () => {
  it("includes gzip archive to stdout and package excludes", () => {
    const args = buildTarArgs("/repo/root");
    expect(args.slice(0, 4)).toEqual(["-c", "-z", "-f", "-"]);
    expect(args).toContain("-C");
    expect(args).toContain("/repo/root");
    expect(args[args.length - 1]).toBe(".");
    for (const ex of CHUNK_SIDECAR_TAR_EXCLUDES) {
      const i = args.indexOf(ex);
      expect(i).toBeGreaterThan(-1);
      expect(args[i - 1]).toBe("--exclude");
    }
  });
});

describe("parseSidecarAddKeyTunnelUrl", () => {
  it("reads v3 data.attributes.url", () => {
    const r = parseSidecarAddKeyTunnelUrl(
      JSON.stringify({
        data: {
          id: "abc",
          attributes: { url: "https://host.e2b.app" },
        },
      }),
    );
    expect(r).toEqual({ url: "https://host.e2b.app" });
  });

  it("accepts legacy flat url for defense in depth", () => {
    expect(
      parseSidecarAddKeyTunnelUrl('{"url":"https://old.example"}'),
    ).toEqual({ url: "https://old.example" });
  });

  it("errors when url is missing", () => {
    const r = parseSidecarAddKeyTunnelUrl('{"data":{"attributes":{}}}');
    expect("error" in r).toBe(true);
  });
});
