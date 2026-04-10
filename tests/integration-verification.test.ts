import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { handleAskCommand } from "../src/cli/ask.js";
import { handleReviewCommand } from "../src/cli/review.js";
import { handleReplInput, type ReplState } from "../src/cli/repl.js";
import { loadSessionSnapshot, saveSessionSnapshot } from "../src/session/store.js";
import type { RikyuConfig } from "../src/config/schema.js";
import type { CommandIo } from "../src/cli/common.js";

const execFileAsync = promisify(execFile);

let dir: string;
let binDir: string;
let repoDir: string;

const config: RikyuConfig = {
  mode: "quick",
  verbose: false,
  json: false,
  progress: false,
  policyProfile: "balanced",
};

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "rikyu-integration-test-"));
  binDir = join(dir, "bin");
  repoDir = join(dir, "repo");
  await execFileAsync("mkdir", ["-p", binDir, repoDir]);
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("integration verification with mock CLI", () => {
  it("runs rikyu ask end-to-end through mock codex and claude", async () => {
    await writeMockCli("codex", mizuyaScript("ask-summary"));
    await writeMockCli("claude", teishuScript("ask-output"));
    const stdout: string[] = [];

    await handleAskCommand({
      question: "What is Rikyu?",
      deps: deps({ stdout: (text) => stdout.push(text) }),
    });

    expect(stdout).toEqual(["ask-output\n"]);
  });

  it("runs rikyu review end-to-end through mock CLI and real git context", async () => {
    await writeMockCli("codex", mizuyaScript("review-summary"));
    await writeMockCli("claude", teishuScript("review-output"));
    await createGitRepoWithWorkingTreeChange();
    const stdout: string[] = [];

    await handleReviewCommand({
      deps: deps({ stdout: (text) => stdout.push(text) }),
    });

    expect(stdout).toEqual(["review-output\n"]);
  });

  it("runs an interactive slash ask flow with mock CLI", async () => {
    await writeMockCli("codex", mizuyaScript("repl-summary"));
    await writeMockCli("claude", teishuScript("repl-output"));
    const stdout: string[] = [];
    const state: ReplState = { sessionId: "session-repl", exit: false };

    await handleReplInput({
      line: "/ask explain this",
      state,
      deps: deps({ stdout: (text) => stdout.push(text), sessionId: state.sessionId }),
    });

    expect(stdout).toEqual(["repl-output\n"]);
    await expect(loadSessionSnapshot("session-repl", { cwd: repoDir })).resolves.toMatchObject({
      sessionId: "session-repl",
      brief: { task: "ask", target: "question" },
    });
  });

  it("continues in degraded mode when mizuya mock fails", async () => {
    await writeMockCli("codex", `console.error("codex unavailable"); process.exit(1);`);
    await writeMockCli("claude", teishuScript("degraded-output"));
    const stdout: string[] = [];
    const stderr: string[] = [];

    const result = await handleAskCommand({
      question: "What now?",
      deps: deps({
        stdout: (text) => stdout.push(text),
        stderr: (text) => stderr.push(text),
      }),
    });

    expect(stdout).toEqual(["degraded-output\n"]);
    expect(result.degraded).toBe(true);
    expect(stderr.join("")).toContain("codex unavailable");
  });

  it("resumes a saved session snapshot", async () => {
    await saveSessionSnapshot(
      {
        sessionId: "saved-session",
        brief: { task: "review", target: "working-tree" },
      },
      { cwd: repoDir },
    );
    const stdout: string[] = [];
    const state: ReplState = { sessionId: "new-session", exit: false };

    await handleReplInput({
      line: "/resume saved-session",
      state,
      deps: deps({ stdout: (text) => stdout.push(text) }),
    });

    expect(state.sessionId).toBe("saved-session");
    expect(stdout).toEqual(["Resumed saved-session (review).\n"]);
  });

  it("keeps quick ask/review under the Phase 0 performance budget", async () => {
    await writeMockCli("codex", mizuyaScript("fast-summary"));
    await writeMockCli("claude", teishuScript("fast-output"));
    await createGitRepoWithWorkingTreeChange();
    const startedAt = Date.now();

    await handleAskCommand({ question: "Fast?", deps: deps() });
    await handleReviewCommand({ deps: deps() });

    expect(Date.now() - startedAt).toBeLessThan(12_000);
  });
});

function deps(options: {
  stdout?: (text: string) => void;
  stderr?: (text: string) => void;
  sessionId?: string;
} = {}) {
  return {
    cwd: repoDir,
    env: {
      ...process.env,
      PATH: `${binDir}:${process.env.PATH ?? ""}`,
    },
    io: {
      stdout: options.stdout ?? (() => undefined),
      stderr: options.stderr ?? (() => undefined),
    } satisfies CommandIo,
    loadConfig: async () => config,
    sessionId: options.sessionId,
    createRequestId: () => "req-integration",
  };
}

async function writeMockCli(name: "codex" | "claude", body: string): Promise<void> {
  const path = join(binDir, name);
  await writeFile(path, `#!/usr/bin/env node\n${body}\n`, "utf8");
  await chmod(path, 0o755);
}

function mizuyaScript(summary: string): string {
  return `console.log(JSON.stringify({
  requestId: "req-integration",
  findings: [],
  summary: ${JSON.stringify(summary)},
  doubts: [],
  contextUsed: ["mock-cli"]
}));`;
}

function teishuScript(output: string): string {
  return `if (process.argv.includes("--bare")) {
  console.error("--bare should not be passed to Claude in prompt mode");
  process.exit(1);
}
console.log(JSON.stringify({
  output: ${JSON.stringify(output)},
  needsMoreFromMizuya: false
}));`;
}

async function createGitRepoWithWorkingTreeChange(): Promise<void> {
  await execFileAsync("git", ["init"], { cwd: repoDir });
  await writeFile(join(repoDir, "app.ts"), "export const value = 1;\n", "utf8");
  await execFileAsync("git", ["add", "app.ts"], { cwd: repoDir });
  await execFileAsync(
    "git",
    ["-c", "user.email=test@example.com", "-c", "user.name=Rikyu Test", "commit", "-m", "init"],
    { cwd: repoDir },
  );
  await writeFile(join(repoDir, "app.ts"), "export const value = 2;\n", "utf8");
}
