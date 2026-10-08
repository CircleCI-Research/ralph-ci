import * as fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  pruneE2bHostKeysFromChunkAiKnownHosts,
  resolveChunkAiKnownHostsPath,
  resolveChunkSshIdentityPath,
} from "./chunk-ai-known-hosts.js";

describe("chunk-ai-known-hosts", () => {
  const prevIdentity = process.env.CHUNK_IDENTITY_FILE;
  const prevRalphIdentity = process.env.RALPHCI_CHUNK_IDENTITY_FILE;

  afterEach(() => {
    if (prevIdentity === undefined) {
      delete process.env.CHUNK_IDENTITY_FILE;
    } else {
      process.env.CHUNK_IDENTITY_FILE = prevIdentity;
    }
    if (prevRalphIdentity === undefined) {
      delete process.env.RALPHCI_CHUNK_IDENTITY_FILE;
    } else {
      process.env.RALPHCI_CHUNK_IDENTITY_FILE = prevRalphIdentity;
    }
  });

  it("resolveChunkSshIdentityPath prefers CHUNK_IDENTITY_FILE", () => {
    process.env.CHUNK_IDENTITY_FILE = "/tmp/a/chunk_ai";
    delete process.env.RALPHCI_CHUNK_IDENTITY_FILE;
    expect(resolveChunkSshIdentityPath()).toBe("/tmp/a/chunk_ai");
  });

  it("resolveChunkAiKnownHostsPath sits next to identity", () => {
    process.env.CHUNK_IDENTITY_FILE = "/home/me/.ssh/chunk_ai";
    delete process.env.RALPHCI_CHUNK_IDENTITY_FILE;
    expect(resolveChunkAiKnownHostsPath()).toBe(
      "/home/me/.ssh/chunk_ai_known_hosts",
    );
  });

  it("pruneE2bHostKeysFromChunkAiKnownHosts removes only .e2b.app lines", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ralph-chunk-kh-"));
    const identity = path.join(dir, "chunk_ai");
    fs.writeFileSync(identity, "dummy-key");
    const kn = path.join(dir, "chunk_ai_known_hosts");
    fs.writeFileSync(
      kn,
      [
        "stable.example.com ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIBODY",
        "8000-abc.e2b.app ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIE2B",
        "",
      ].join("\n"),
    );
    process.env.CHUNK_IDENTITY_FILE = identity;
    delete process.env.RALPHCI_CHUNK_IDENTITY_FILE;

    const r = pruneE2bHostKeysFromChunkAiKnownHosts();
    expect(r.error).toBeNull();
    expect(r.pruned).toBe(1);
    const after = fs.readFileSync(kn, "utf8");
    expect(after).toContain("stable.example.com");
    expect(after).not.toContain("e2b.app");

    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("pruneE2bHostKeysFromChunkAiKnownHosts is a no-op when file missing", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ralph-chunk-kh2-"));
    const identity = path.join(dir, "chunk_ai");
    fs.writeFileSync(identity, "dummy-key");
    process.env.CHUNK_IDENTITY_FILE = identity;
    delete process.env.RALPHCI_CHUNK_IDENTITY_FILE;

    const r = pruneE2bHostKeysFromChunkAiKnownHosts();
    expect(r.pruned).toBe(0);
    expect(r.error).toBeNull();

    fs.rmSync(dir, { recursive: true, force: true });
  });
});
