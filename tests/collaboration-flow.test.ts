import { describe, expect, it } from "vitest";

import { runCollaborationFlow, type MizuyaRunner, type TeishuRunner } from "../src/collaboration/flow.js";
import { ProviderError, type ProviderResult } from "../src/providers/types.js";
import type { MizuyaResponse } from "../src/mizuya/schema.js";
import type { TeishuResponse } from "../src/teishu/schema.js";
import type { SessionBrief } from "../src/session/types.js";

const brief: SessionBrief = {
  task: "review",
  target: "working-tree",
};

const mizuyaResponse: MizuyaResponse = {
  requestId: "req-1",
  findings: [
    {
      ruleId: "bug",
      level: "warning",
      message: "A warning",
      evidence: ["diff"],
      confidence: "high",
    },
  ],
  summary: "Mizuya summary",
  doubts: [],
  contextUsed: ["diff"],
};

const teishuResponse: TeishuResponse = {
  output: "Unified review",
  needsMoreFromMizuya: false,
};

describe("runCollaborationFlow", () => {
  it("runs mizuya first and passes its response to teishu", async () => {
    const calls: string[] = [];
    let teishuPrompt = "";
    const mizuyaRunner: MizuyaRunner = async () => {
      calls.push("mizuya");
      return providerResult("codex", mizuyaResponse);
    };
    const teishuRunner: TeishuRunner = async (prompt) => {
      calls.push("teishu");
      teishuPrompt = prompt;
      return providerResult("claude", teishuResponse);
    };

    const result = await runCollaborationFlow({
      requestId: "req-1",
      userRequest: "Review this",
      brief,
      mizuyaRunner,
      teishuRunner,
    });

    expect(calls).toEqual(["mizuya", "teishu"]);
    expect(teishuPrompt).toContain('"summary": "Mizuya summary"');
    expect(result).toMatchObject({
      requestId: "req-1",
      output: "Unified review",
      mizuyaResponse,
      degraded: false,
      stderr: [],
    });
  });

  it("continues in degraded mode when mizuya fails", async () => {
    let teishuPrompt = "";
    const stderr: string[] = [];
    const mizuyaRunner: MizuyaRunner = async () => {
      throw new ProviderError("codex", "ENOENT", "missing", { stderr: "codex missing" });
    };
    const teishuRunner: TeishuRunner = async (prompt) => {
      teishuPrompt = prompt;
      return providerResult("claude", {
        output: "Degraded answer",
        needsMoreFromMizuya: false,
      });
    };

    const result = await runCollaborationFlow({
      requestId: "req-2",
      userRequest: "Review this",
      brief,
      mizuyaRunner,
      teishuRunner,
      degradedStderrLogger: (line) => stderr.push(line),
    });

    expect(teishuPrompt).toContain("Continue in degraded mode");
    expect(result).toMatchObject({
      requestId: "req-2",
      output: "Degraded answer",
      degraded: true,
      degradedReason: "codex:ENOENT",
      stderr: ["codex missing"],
    });
    expect(result.mizuyaResponse).toBeUndefined();
    expect(stderr).toEqual(["codex missing"]);
  });

  it("surfaces teishu failures because no final output can be produced", async () => {
    const mizuyaRunner: MizuyaRunner = async () => providerResult("codex", mizuyaResponse);
    const teishuRunner: TeishuRunner = async () => {
      throw new ProviderError("claude", "EXIT_CODE", "failed", { stderr: "claude failed" });
    };

    await expect(
      runCollaborationFlow({
        requestId: "req-3",
        userRequest: "Review this",
        brief,
        mizuyaRunner,
        teishuRunner,
      }),
    ).rejects.toMatchObject({
      provider: "claude",
      code: "EXIT_CODE",
    });
  });

  it("can skip mizuya for tasks that should go directly to teishu", async () => {
    let mizuyaCalled = false;
    let teishuPrompt = "";
    const mizuyaRunner: MizuyaRunner = async () => {
      mizuyaCalled = true;
      return providerResult("codex", mizuyaResponse);
    };
    const teishuRunner: TeishuRunner = async (prompt) => {
      teishuPrompt = prompt;
      return providerResult("claude", teishuResponse);
    };

    const result = await runCollaborationFlow({
      requestId: "req-skip",
      userRequest: "Plan a fix",
      brief: { task: "fix", target: "question", desiredOutcome: "fix-plan" },
      skipMizuya: true,
      mizuyaRunner,
      teishuRunner,
    });

    expect(mizuyaCalled).toBe(false);
    expect(teishuPrompt).toContain("No mizuya response was requested");
    expect(result).toMatchObject({ degraded: false, output: "Unified review" });
  });

  it("throws when injected runners do not return parsed data", async () => {
    const mizuyaRunner: MizuyaRunner = async () => ({
      provider: "codex",
      stdout: "{}",
      stderr: "",
      exitCode: 0,
      signal: null,
      durationMs: 1,
    });
    const teishuRunner: TeishuRunner = async () => providerResult("claude", teishuResponse);

    await expect(
      runCollaborationFlow({
        requestId: "req-4",
        userRequest: "Review this",
        brief,
        mizuyaRunner,
        teishuRunner,
        degradedStderrLogger: () => undefined,
      }),
    ).resolves.toMatchObject({
      degraded: true,
      degradedReason: "codex runner returned no parsed result",
    });
  });
});

function providerResult<T>(
  provider: ProviderResult<T>["provider"],
  parsed: T,
): ProviderResult<T> {
  return {
    provider,
    stdout: JSON.stringify(parsed),
    stderr: "",
    exitCode: 0,
    signal: null,
    durationMs: 1,
    parsed,
  };
}
