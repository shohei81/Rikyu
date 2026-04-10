import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { collectStatus, type StatusCommandRunner } from "../src/status/checks.js";
import { formatStatusReport } from "../src/status/format.js";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "rikyu-status-test-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("collectStatus", () => {
  it("reports all providers and valid config when checks pass", async () => {
    const projectConfigPath = join(dir, ".rikyu", "config.json");
    await mkdir(dirname(projectConfigPath), { recursive: true });
    await writeFile(projectConfigPath, JSON.stringify({ mode: "quick" }), "utf8");
    const runner = createRunner({
      "which claude": { stdout: "/usr/local/bin/claude\n" },
      "which codex": { stdout: "/usr/local/bin/codex\n" },
      "claude --version": { stdout: "claude 1.0.0\n" },
      "codex --version": { stdout: "codex 2.0.0\n" },
      "claude auth status": { stdout: "authenticated\n" },
      "codex auth status": { stdout: "authenticated\n" },
    });

    const report = await collectStatus({
      runner,
      globalConfigPath: join(dir, "missing.json"),
      projectConfigPath,
    });

    expect(report.providers).toEqual([
      {
        name: "claude",
        executable: "claude",
        exists: "ok",
        path: "/usr/local/bin/claude",
        version: { state: "ok", value: "claude 1.0.0" },
        auth: { state: "ok" },
      },
      {
        name: "codex",
        executable: "codex",
        exists: "ok",
        path: "/usr/local/bin/codex",
        version: { state: "ok", value: "codex 2.0.0" },
        auth: { state: "ok" },
      },
    ]);
    expect(report.config).toMatchObject({
      state: "valid",
      config: { mode: "quick", verbose: false, json: false, progress: true },
    });
  });

  it("reports missing providers", async () => {
    const runner = createRunner({});

    const report = await collectStatus({
      runner,
      globalConfigPath: join(dir, "missing-global.json"),
      projectConfigPath: join(dir, "missing-project.json"),
    });

    expect(report.providers).toEqual([
      {
        name: "claude",
        executable: "claude",
        exists: "missing",
        version: { state: "skipped", message: "CLI not found" },
        auth: { state: "skipped", message: "CLI not found" },
      },
      {
        name: "codex",
        executable: "codex",
        exists: "missing",
        version: { state: "skipped", message: "CLI not found" },
        auth: { state: "skipped", message: "CLI not found" },
      },
    ]);
  });

  it("reports auth failures without hiding version success", async () => {
    const runner = createRunner({
      "which claude": { stdout: "/usr/local/bin/claude\n" },
      "which codex": { stdout: "/usr/local/bin/codex\n" },
      "claude --version": { stdout: "claude 1.0.0\n" },
      "codex --version": { stdout: "codex 2.0.0\n" },
      "claude auth status": { error: commandError("not authenticated") },
      "codex auth status": { stdout: "authenticated\n" },
    });

    const report = await collectStatus({
      runner,
      globalConfigPath: join(dir, "missing-global.json"),
      projectConfigPath: join(dir, "missing-project.json"),
    });

    expect(report.providers[0]?.version).toEqual({ state: "ok", value: "claude 1.0.0" });
    expect(report.providers[0]?.auth).toEqual({
      state: "failed",
      message: "not authenticated",
    });
  });

  it("reports unsupported auth status commands as unknown", async () => {
    const runner = createRunner({
      "which claude": { stdout: "/usr/local/bin/claude\n" },
      "which codex": { stdout: "/usr/local/bin/codex\n" },
      "claude --version": { stdout: "claude 1.0.0\n" },
      "codex --version": { stdout: "codex 2.0.0\n" },
      "claude auth status": { stdout: "authenticated\n" },
      "codex auth status": { error: commandError("error: unrecognized subcommand 'status'") },
    });

    const report = await collectStatus({
      runner,
      globalConfigPath: join(dir, "missing-global.json"),
      projectConfigPath: join(dir, "missing-project.json"),
    });

    expect(report.providers[1]?.auth).toEqual({
      state: "unknown",
      message: "auth status command is not supported by this CLI",
    });
  });

  it("reports invalid config", async () => {
    const projectConfigPath = join(dir, "config.json");
    await writeFile(projectConfigPath, JSON.stringify({ mode: "slow" }), "utf8");
    const runner = createRunner({});

    const report = await collectStatus({
      runner,
      globalConfigPath: join(dir, "missing-global.json"),
      projectConfigPath,
    });

    expect(report.config).toMatchObject({
      state: "invalid",
      message: `INVALID_CONFIG: ${projectConfigPath}`,
    });
  });
});

describe("formatStatusReport", () => {
  it("renders provider and config status", async () => {
    const report = await collectStatus({
      runner: createRunner({}),
      globalConfigPath: join(dir, "missing-global.json"),
      projectConfigPath: join(dir, "missing-project.json"),
    });

    expect(formatStatusReport(report)).toContain("Rikyu status\nclaude: missing");
    expect(formatStatusReport(report)).toContain("config: valid");
  });
});

function createRunner(
  responses: Record<string, { stdout?: string; stderr?: string; error?: Error }>,
): StatusCommandRunner {
  return async (command, args) => {
    const key = `${command} ${args.join(" ")}`;
    const response = responses[key];
    if (!response) throw commandError(`${key} failed`);
    if (response.error) throw response.error;
    return {
      stdout: response.stdout ?? "",
      stderr: response.stderr ?? "",
    };
  };
}

function commandError(stderr: string): Error & { stderr: string; stdout: string } {
  return Object.assign(new Error(stderr), { stderr, stdout: "" });
}
