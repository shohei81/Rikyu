import { describe, expect, it } from "vitest";

import {
  collectChangeVerification,
  formatChangeVerification,
  type ChangeVerificationCommandRunner,
} from "../src/collaboration/change-verification.js";

describe("change verification", () => {
  it("collects diff summaries and suggests relevant test commands", async () => {
    const summary = await collectChangeVerification({
      cwd: "/repo",
      beforeSnapshot: {
        id: "rollback-1",
        cwd: "/repo",
        createdAt: "2026-04-10T00:00:00.000Z",
        diffSummary: "src/app.ts | 1 +",
      },
      runner: runner({
        "git diff --stat": " src/app.ts | 2 +-\n tests/app.test.ts | 1 +\n",
        "git diff --name-only": "src/app.ts\ntests/app.test.ts\n",
      }),
    });

    expect(summary).toEqual({
      suggestedCommands: ["npm test", "npm run build"],
      impact: ["runtime source", "test surface"],
      changedFiles: ["src/app.ts", "tests/app.test.ts"],
      beforeDiffSummary: "src/app.ts | 1 +",
      afterDiffSummary: "src/app.ts | 2 +-\n tests/app.test.ts | 1 +",
    });
  });

  it("formats a user-facing verification summary", () => {
    const output = formatChangeVerification({
      suggestedCommands: ["npm test"],
      impact: ["runtime source"],
      changedFiles: ["src/app.ts"],
      beforeDiffSummary: "src/app.ts | 1 +",
      afterDiffSummary: "src/app.ts | 2 +-",
    });

    expect(output).toContain("Change verification:");
    expect(output).toContain("Suggested tests: npm test");
    expect(output).toContain("Before apply diff: src/app.ts | 1 +");
    expect(output).toContain("After apply diff: src/app.ts | 2 +-");
  });
});

function runner(outputs: Record<string, string>): ChangeVerificationCommandRunner {
  return async (command, args) => {
    const key = `${command} ${args.join(" ")}`;
    const stdout = outputs[key];
    if (stdout === undefined) throw new Error(`${key} failed`);
    return { stdout, stderr: "" };
  };
}
