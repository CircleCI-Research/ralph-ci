import { describe, it, expect, vi, afterEach } from "vitest";
import { EventEmitter } from "events";
import { startPreventSleep } from "./prevent-sleep.js";

describe("startPreventSleep", () => {
  const originalPlatform = process.platform;

  afterEach(() => {
    Object.defineProperty(process, "platform", { value: originalPlatform });
  });

  it("returns null on non-macOS platforms", () => {
    Object.defineProperty(process, "platform", { value: "linux" });
    const spawnFn = vi.fn();
    expect(startPreventSleep(4242, spawnFn)).toBeNull();
    expect(spawnFn).not.toHaveBeenCalled();
  });

  it("spawns caffeinate -dims -w <pid> on macOS", () => {
    Object.defineProperty(process, "platform", { value: "darwin" });

    const fakeProc = Object.assign(new EventEmitter(), {
      exitCode: null as number | null,
      killed: false,
      kill: vi.fn(function (this: { killed: boolean }) {
        this.killed = true;
      }),
    });

    const spawnFn = vi.fn(() => fakeProc);
    const handle = startPreventSleep(4242, spawnFn);

    expect(handle).not.toBeNull();
    expect(spawnFn).toHaveBeenCalledWith(
      "caffeinate",
      ["-dims", "-w", "4242"],
      { stdio: "ignore" },
    );
  });

  it("stop() kills the caffeinate child", () => {
    Object.defineProperty(process, "platform", { value: "darwin" });

    const fakeProc = Object.assign(new EventEmitter(), {
      exitCode: null as number | null,
      killed: false,
      kill: vi.fn(function (this: { killed: boolean }) {
        this.killed = true;
      }),
    });

    const handle = startPreventSleep(1, () => fakeProc);
    handle!.stop();

    expect(fakeProc.kill).toHaveBeenCalledWith("SIGTERM");
  });

  it("returns null when spawn throws", () => {
    Object.defineProperty(process, "platform", { value: "darwin" });
    const spawnFn = vi.fn(() => {
      throw new Error("spawn failed");
    });

    expect(startPreventSleep(1, spawnFn)).toBeNull();
  });
});
