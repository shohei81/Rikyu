import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";

import { describe, expect, it } from "vitest";

import { parseProviderJsonResult, runProviderCommand } from "../src/providers/subprocess.js";
import { ProviderError } from "../src/providers/types.js";

class FakeChild extends EventEmitter {
  stdout = new PassThrough();
  stderr = new PassThrough();
  stdin = new PassThrough();
  killedWith: NodeJS.Signals | undefined;

  kill(signal: NodeJS.Signals) {
    this.killedWith = signal;
    return true;
  }
}

describe("runProviderCommand", () => {
  it("buffers chunked stdout and stderr", async () => {
    const child = new FakeChild();
    const promise = runProviderCommand(
      "codex",
      { command: "codex", args: ["exec"] },
      { spawnImpl: () => child as never },
    );

    child.stdout.write("hel");
    child.stdout.write("lo");
    child.stderr.write("warn");
    child.emit("close", 0, null);

    await expect(promise).resolves.toMatchObject({
      provider: "codex",
      stdout: "hello",
      stderr: "warn",
      exitCode: 0,
    });
  });

  it("maps ENOENT start failures", async () => {
    const child = new FakeChild();
    const promise = runProviderCommand(
      "claude",
      { command: "claude", args: [] },
      { spawnImpl: () => child as never },
    );
    const error = Object.assign(new Error("missing"), { code: "ENOENT" });

    child.emit("error", error);

    await expect(promise).rejects.toMatchObject({
      provider: "claude",
      code: "ENOENT",
    });
  });

  it("rejects non-zero exits with captured output", async () => {
    const child = new FakeChild();
    const promise = runProviderCommand(
      "codex",
      { command: "codex", args: [] },
      { spawnImpl: () => child as never },
    );

    child.stdout.write("partial");
    child.stderr.write("bad");
    child.emit("close", 2, null);

    await expect(promise).rejects.toMatchObject({
      code: "EXIT_CODE",
      exitCode: 2,
      stdout: "partial",
      stderr: "bad",
    });
  });

  it("rejects signal exits", async () => {
    const child = new FakeChild();
    const promise = runProviderCommand(
      "codex",
      { command: "codex", args: [] },
      { spawnImpl: () => child as never },
    );

    child.emit("close", null, "SIGTERM");

    await expect(promise).rejects.toMatchObject({
      code: "SIGNAL",
      signal: "SIGTERM",
    });
  });

  it("times out and terminates the child", async () => {
    const child = new FakeChild();
    const promise = runProviderCommand(
      "codex",
      { command: "codex", args: [] },
      { spawnImpl: () => child as never, timeoutMs: 1 },
    );

    await expect(promise).rejects.toBeInstanceOf(ProviderError);
    expect(child.killedWith).toBe("SIGTERM");
  });
});

describe("parseProviderJsonResult", () => {
  it("parses stdout JSON into the provider result", () => {
    const result = parseProviderJsonResult("codex", {
      provider: "codex",
      stdout: '{"ok":true}',
      stderr: "",
      exitCode: 0,
      signal: null,
      durationMs: 1,
    });

    expect(result.parsed).toEqual({ ok: true });
  });

  it("wraps invalid JSON in ProviderError", () => {
    expect(() =>
      parseProviderJsonResult("claude", {
        provider: "claude",
        stdout: "not json",
        stderr: "",
        exitCode: 0,
        signal: null,
        durationMs: 1,
      }),
    ).toThrow(ProviderError);
  });
});
