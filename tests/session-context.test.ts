import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { collectSessionContext, type ContextCommandRunner } from "../src/session/context.js";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "rikyu-session-context-test-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("collectSessionContext", () => {
  it("collects working tree diff and git metadata", async () => {
    const runner = createRunner({
      "git rev-parse --show-toplevel": "/repo\n",
      "git rev-parse --short HEAD": "abc123\n",
      "git diff HEAD": "diff --git a/a.ts b/a.ts\n",
    });

    const context = await collectSessionContext({ cwd: dir, runner });

    expect(context).toEqual({
      cwd: dir,
      gitRoot: "/repo",
      head: "abc123",
      blocks: [{ label: "git-diff:working-tree", content: "diff --git a/a.ts b/a.ts\n" }],
    });
  });

  it("collects staged diff", async () => {
    const runner = createRunner({
      "git rev-parse --show-toplevel": "/repo\n",
      "git rev-parse --short HEAD": "abc123\n",
      "git diff --staged": "staged diff\n",
    });

    const context = await collectSessionContext({ cwd: dir, target: "staged", runner });

    expect(context.blocks).toEqual([{ label: "git-diff:staged", content: "staged diff\n" }]);
  });

  it("collects file content", async () => {
    const file = join(dir, "example.ts");
    await writeFile(file, "const answer = 42;\n", "utf8");
    const runner = createRunner({});

    const context = await collectSessionContext({
      cwd: dir,
      target: "file",
      path: file,
      runner,
    });

    expect(context.blocks).toEqual([{ label: `file:${file}`, content: "const answer = 42;\n" }]);
  });

  it("reads relative file paths from cwd", async () => {
    const file = join(dir, "relative.ts");
    await writeFile(file, "export const value = true;\n", "utf8");
    const runner = createRunner({});

    const context = await collectSessionContext({
      cwd: dir,
      target: "file",
      path: "relative.ts",
      runner,
    });

    expect(context.blocks).toEqual([
      { label: "file:relative.ts", content: "export const value = true;\n" },
    ]);
  });
});

function createRunner(outputs: Record<string, string>): ContextCommandRunner {
  return async (command, args) => {
    const key = `${command} ${args.join(" ")}`;
    const stdout = outputs[key];
    if (stdout === undefined) throw new Error(`${key} failed`);
    return { stdout, stderr: "" };
  };
}
