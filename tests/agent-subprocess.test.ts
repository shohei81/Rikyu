import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";

import { describe, expect, it } from "vitest";

import { runSubprocess, estimateTokens } from "../src/agent/subprocess.js";
import { ProviderError } from "../src/agent/types.js";

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

describe("runSubprocess", () => {
  it("buffers chunked stdout and stderr", async () => {
    const child = new FakeChild();
    const promise = runSubprocess(
      "codex",
      { command: "codex", args: ["exec"] },
      { spawnImpl: () => child as never },
    );

    child.stdout.write("hel");
    child.stdout.write("lo");
    child.stderr.write("wa");
    child.stderr.write("rn");
    child.emit("close", 0, null);

    const result = await promise;
    expect(result).toMatchObject({
      stdout: "hello",
      stderr: "warn",
      exitCode: 0,
    });
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("maps ENOENT spawn error to ProviderError with code ENOENT", async () => {
    const child = new FakeChild();
    const promise = runSubprocess(
      "claude",
      { command: "claude", args: [] },
      { spawnImpl: () => child as never },
    );

    const error = Object.assign(new Error("spawn claude ENOENT"), {
      code: "ENOENT",
    });
    child.emit("error", error);

    await expect(promise).rejects.toThrow(ProviderError);
    await expect(promise).rejects.toMatchObject({
      provider: "claude",
      code: "ENOENT",
    });
  });

  it("rejects non-zero exit with EXIT_CODE", async () => {
    const child = new FakeChild();
    const promise = runSubprocess(
      "codex",
      { command: "codex", args: ["exec"] },
      { spawnImpl: () => child as never },
    );

    child.stdout.write("partial output");
    child.stderr.write("some error");
    child.emit("close", 1, null);

    await expect(promise).rejects.toThrow(ProviderError);
    await expect(promise).rejects.toMatchObject({
      provider: "codex",
      code: "EXIT_CODE",
      stdout: "partial output",
      stderr: "some error",
    });
  });

  it("rejects signal termination with SIGNAL", async () => {
    const child = new FakeChild();
    const promise = runSubprocess(
      "claude",
      { command: "claude", args: ["-p", "hi"] },
      { spawnImpl: () => child as never },
    );

    child.emit("close", null, "SIGKILL");

    await expect(promise).rejects.toThrow(ProviderError);
    await expect(promise).rejects.toMatchObject({
      provider: "claude",
      code: "SIGNAL",
      signal: "SIGKILL",
    });
  });

  it("kills child with SIGTERM on timeout and rejects with TIMEOUT", async () => {
    const child = new FakeChild();
    const promise = runSubprocess(
      "codex",
      { command: "codex", args: ["exec"] },
      { spawnImpl: () => child as never, timeoutMs: 50 },
    );

    // Do not emit close — let the timeout fire
    await expect(promise).rejects.toThrow(ProviderError);
    await expect(promise).rejects.toMatchObject({
      provider: "codex",
      code: "TIMEOUT",
    });
    expect(child.killedWith).toBe("SIGTERM");
  });

  it("rejects early with TOKEN_OVERFLOW when input exceeds maxTokens", async () => {
    // estimateTokens("x".repeat(100)) = ceil(100/4) = 25
    // maxTokens = 10 → should overflow before spawning
    const promise = runSubprocess(
      "claude",
      { command: "claude", args: ["x".repeat(100)] },
      {
        maxTokens: 10,
        spawnImpl: () => {
          throw new Error("should not spawn");
        },
      },
    );

    await expect(promise).rejects.toThrow(ProviderError);
    await expect(promise).rejects.toMatchObject({
      provider: "claude",
      code: "TOKEN_OVERFLOW",
    });
  });
});

describe("estimateTokens", () => {
  it("returns ceil(length / 4)", () => {
    expect(estimateTokens("")).toBe(0);
    expect(estimateTokens("a")).toBe(1);
    expect(estimateTokens("ab")).toBe(1);
    expect(estimateTokens("abc")).toBe(1);
    expect(estimateTokens("abcd")).toBe(1);
    expect(estimateTokens("abcde")).toBe(2);
    expect(estimateTokens("x".repeat(100))).toBe(25);
    expect(estimateTokens("x".repeat(101))).toBe(26);
  });
});
