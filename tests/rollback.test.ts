import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  formatRollbackGuidance,
  recordRollbackSnapshot,
  type RollbackCommandRunner,
} from "../src/collaboration/rollback.js";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "rikyu-rollback-test-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("rollback guidance", () => {
  it("records pre-apply git state", async () => {
    const snapshot = await recordRollbackSnapshot({
      cwd: dir,
      id: "rollback-1",
      now: () => new Date("2026-04-10T00:00:00.000Z"),
      runner: runner({
        "git rev-parse --short HEAD": "abc123\n",
        "git status --short": " M src/app.ts\n",
        "git diff --stat": " src/app.ts | 2 +-\n",
      }),
    });

    expect(snapshot).toMatchObject({
      id: "rollback-1",
      cwd: dir,
      head: "abc123",
      statusShort: "M src/app.ts",
      diffSummary: "src/app.ts | 2 +-",
    });
    await expect(readFile(snapshot.path ?? "", "utf8")).resolves.toContain('"head": "abc123"');
  });

  it("formats stash and checkout recovery steps", () => {
    const guidance = formatRollbackGuidance({
      id: "rollback-1",
      cwd: "/repo",
      createdAt: "2026-04-10T00:00:00.000Z",
      path: "/repo/.rikyu/rollback/rollback-1.json",
      head: "abc123",
    });

    expect(guidance).toContain("git stash push -u -m \"rikyu rollback rollback-1\"");
    expect(guidance).toContain("git checkout -- .");
    expect(guidance).toContain("git checkout abc123");
  });
});

function runner(outputs: Record<string, string>): RollbackCommandRunner {
  return async (command, args) => {
    const key = `${command} ${args.join(" ")}`;
    const stdout = outputs[key];
    if (stdout === undefined) throw new Error(`${key} failed`);
    return { stdout, stderr: "" };
  };
}
