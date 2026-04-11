import { describe, it, expect } from "vitest";
import { collectContext, type CommandRunner } from "../src/chaji/context.js";
import type { SessionBrief } from "../src/chaji/types.js";

function makeBrief(overrides: Partial<SessionBrief> = {}): SessionBrief {
  return {
    task: "review",
    target: "working-tree",
    ...overrides,
  };
}

/**
 * Creates a mock CommandRunner that returns predefined responses
 * keyed by the full command string (e.g. "git diff HEAD").
 */
function mockRunner(
  responses: Record<string, string>,
): CommandRunner {
  return async (cmd: string, args: string[]) => {
    const key = [cmd, ...args].join(" ");
    if (key in responses) return responses[key];
    throw new Error(`unexpected command: ${key}`);
  };
}

describe("collectContext", () => {
  describe("working-tree target", () => {
    it("calls git diff HEAD and returns a block with label 'Working tree diff'", async () => {
      const runner = mockRunner({
        "git rev-parse --show-toplevel": "/repo\n",
        "git rev-parse --short HEAD": "abc1234\n",
        "git diff HEAD": "diff --git a/foo.ts\n+added line\n",
        "git log --oneline -10": "abc1234 initial commit\n",
      });

      const ctx = await collectContext(makeBrief(), {
        cwd: "/repo",
        runner,
      });

      expect(ctx.gitRoot).toBe("/repo");
      expect(ctx.head).toBe("abc1234");
      const diffBlock = ctx.blocks.find((b) => b.label === "Working tree diff");
      expect(diffBlock).toBeDefined();
      expect(diffBlock!.content).toContain("+added line");
    });
  });

  describe("staged target", () => {
    it("calls git diff --staged", async () => {
      const runner = mockRunner({
        "git rev-parse --show-toplevel": "/repo\n",
        "git rev-parse --short HEAD": "abc1234\n",
        "git diff --staged": "diff --staged content\n",
      });

      const ctx = await collectContext(
        makeBrief({ task: "ask", target: "staged" }),
        { cwd: "/repo", runner },
      );

      const staged = ctx.blocks.find((b) => b.label === "Staged diff");
      expect(staged).toBeDefined();
      expect(staged!.content).toContain("diff --staged content");
    });
  });

  describe("file target", () => {
    it("reads the file content into a context block", async () => {
      const runner = mockRunner({
        "git rev-parse --show-toplevel": "/repo\n",
        "git rev-parse --short HEAD": "abc1234\n",
      });

      // Write a temp file for the test
      const { mkdtemp, writeFile, rm } = await import("node:fs/promises");
      const { join } = await import("node:path");
      const { tmpdir } = await import("node:os");
      const tmpDir = await mkdtemp(join(tmpdir(), "rikyu-test-"));
      const filePath = join(tmpDir, "sample.ts");
      await writeFile(filePath, "const x = 42;", "utf8");

      try {
        const ctx = await collectContext(
          makeBrief({ task: "explain", target: "file" }),
          { cwd: "/repo", target: filePath, runner },
        );

        const fileBlock = ctx.blocks.find((b) =>
          b.label.startsWith("File:"),
        );
        expect(fileBlock).toBeDefined();
        expect(fileBlock!.content).toBe("const x = 42;");
      } finally {
        await rm(tmpDir, { recursive: true });
      }
    });
  });

  describe("recent commits", () => {
    it("includes recent commits block for review tasks", async () => {
      const runner = mockRunner({
        "git rev-parse --show-toplevel": "/repo\n",
        "git rev-parse --short HEAD": "abc1234\n",
        "git diff HEAD": "some diff\n",
        "git log --oneline -10": "abc1234 first\ndef5678 second\n",
      });

      const ctx = await collectContext(makeBrief({ task: "review" }), {
        cwd: "/repo",
        runner,
      });

      const commits = ctx.blocks.find((b) => b.label === "Recent commits");
      expect(commits).toBeDefined();
      expect(commits!.content).toContain("abc1234 first");
    });

    it("includes recent commits block for debug tasks", async () => {
      const runner = mockRunner({
        "git rev-parse --show-toplevel": "/repo\n",
        "git rev-parse --short HEAD": "abc1234\n",
        "git log --oneline -10": "abc1234 first\n",
      });

      const ctx = await collectContext(
        makeBrief({ task: "debug", target: "symptom" }),
        { cwd: "/repo", runner },
      );

      const commits = ctx.blocks.find((b) => b.label === "Recent commits");
      expect(commits).toBeDefined();
    });
  });

  describe("non-git repo", () => {
    it("handles gracefully with no blocks and no gitRoot", async () => {
      const runner: CommandRunner = async () => {
        throw new Error("not a git repo");
      };

      const ctx = await collectContext(makeBrief(), {
        cwd: "/not-a-repo",
        runner,
      });

      expect(ctx.gitRoot).toBeUndefined();
      expect(ctx.head).toBeUndefined();
      expect(ctx.blocks).toEqual([]);
    });
  });

  describe("empty diff", () => {
    it("produces no context blocks when diff is empty", async () => {
      const runner = mockRunner({
        "git rev-parse --show-toplevel": "/repo\n",
        "git rev-parse --short HEAD": "abc1234\n",
        "git diff HEAD": "",
        "git log --oneline -10": "abc1234 first\n",
      });

      const ctx = await collectContext(makeBrief(), {
        cwd: "/repo",
        runner,
      });

      const diffBlock = ctx.blocks.find((b) => b.label === "Working tree diff");
      expect(diffBlock).toBeUndefined();
    });
  });
});
