import { describe, expect, it, vi } from "vitest";

import { Hanto } from "../src/hanto/orchestrator.js";
import type { ChajiRequest } from "../src/hanto/orchestrator.js";
import type { Agent, AgentResult } from "../src/agent/types.js";
import { ProviderError } from "../src/agent/types.js";
import type { MizuyaResponse } from "../src/mizuya/schema.js";
import type { TeishuResponse } from "../src/teishu/schema.js";

// ── Canned responses ───────────────────────────────────

const mizuyaResponse: MizuyaResponse = {
  requestId: "req-1",
  findings: [
    {
      ruleId: "null-check",
      level: "warning",
      message: "Missing null handling",
      location: { file: "src/foo.ts", startLine: 10 },
      evidence: ["value may be undefined"],
      confidence: "high",
    },
  ],
  summary: "One potential null-pointer issue found.",
  doubts: ["Could be intentional"],
  contextUsed: ["src/foo.ts"],
};

const teishuResponse: TeishuResponse = {
  output: "You should add a null check on line 10.",
  needsMoreFromMizuya: false,
};

const teishuFollowUpResponse: TeishuResponse = {
  output: "Need more info about callers.",
  needsMoreFromMizuya: true,
  followUpQuestion: "Which functions call foo()?",
};

const teishuFinalResponse: TeishuResponse = {
  output: "After checking callers, the null check is necessary.",
  needsMoreFromMizuya: false,
};

// ── Helpers ────────────────────────────────────────────

function makeMizuyaAgent(
  impl?: () => Promise<AgentResult<MizuyaResponse>>,
): Agent<MizuyaResponse> {
  return {
    name: "mizuya",
    provider: "codex",
    run: vi.fn().mockImplementation(
      impl ??
        (() =>
          Promise.resolve({
            output: JSON.stringify(mizuyaResponse),
            parsed: mizuyaResponse,
            provider: "codex" as const,
            durationMs: 100,
            tokenUsage: { input: 500, output: 200 },
          })),
    ),
  };
}

function makeTeishuAgent(
  impl?: () => Promise<AgentResult<TeishuResponse>>,
): Agent<TeishuResponse> {
  return {
    name: "teishu",
    provider: "claude",
    run: vi.fn().mockImplementation(
      impl ??
        (() =>
          Promise.resolve({
            output: teishuResponse.output,
            parsed: teishuResponse,
            provider: "claude" as const,
            durationMs: 200,
            tokenUsage: { input: 1000, output: 500 },
          })),
    ),
  };
}

function baseRequest(overrides?: Partial<ChajiRequest>): ChajiRequest {
  return {
    id: "req-1",
    brief: { task: "review", target: "staged" },
    userRequest: "Review this code",
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────

describe("Hanto.conduct", () => {
  it("happy path: mizuya finds issues, teishu synthesizes", async () => {
    const mizuya = makeMizuyaAgent();
    const teishu = makeTeishuAgent();
    const hanto = new Hanto(mizuya, teishu);

    const result = await hanto.conduct(baseRequest());

    expect(mizuya.run).toHaveBeenCalledOnce();
    expect(teishu.run).toHaveBeenCalledOnce();
    expect(result.id).toBe("req-1");
    expect(result.output).toBe("You should add a null check on line 10.");
    expect(result.teishu).toEqual(teishuResponse);
    expect(result.mizuya).toEqual(mizuyaResponse);
    expect(result.degraded).toBe(false);
    expect(result.degradedReason).toBeUndefined();
  });

  it("degraded mode: mizuya throws ProviderError, teishu continues", async () => {
    const mizuya = makeMizuyaAgent(() =>
      Promise.reject(
        new ProviderError("codex", "EXIT_CODE", "codex crashed", {
          stderr: "segfault\ncore dumped",
        }),
      ),
    );
    const teishu = makeTeishuAgent();
    const hanto = new Hanto(mizuya, teishu);

    const result = await hanto.conduct(baseRequest());

    expect(mizuya.run).toHaveBeenCalledOnce();
    expect(teishu.run).toHaveBeenCalledOnce();
    expect(result.degraded).toBe(true);
    expect(result.degradedReason).toBe("codex:EXIT_CODE");
    expect(result.mizuya).toBeUndefined();
    expect(result.output).toBe(teishuResponse.output);
  });

  it("skipMizuya: only teishu runs", async () => {
    const mizuya = makeMizuyaAgent();
    const teishu = makeTeishuAgent();
    const hanto = new Hanto(mizuya, teishu);

    const result = await hanto.conduct(baseRequest({ skipMizuya: true }));

    expect(mizuya.run).not.toHaveBeenCalled();
    expect(teishu.run).toHaveBeenCalledOnce();
    expect(result.degraded).toBe(false);
    expect(result.mizuya).toBeUndefined();
  });

  it("reuse mizuya: uses provided mizuyaResult without calling mizuya", async () => {
    const mizuya = makeMizuyaAgent();
    const teishu = makeTeishuAgent();
    const hanto = new Hanto(mizuya, teishu);

    const result = await hanto.conduct(
      baseRequest({ mizuyaResult: mizuyaResponse }),
    );

    expect(mizuya.run).not.toHaveBeenCalled();
    expect(teishu.run).toHaveBeenCalledOnce();
    expect(result.mizuya).toEqual(mizuyaResponse);
    expect(result.degraded).toBe(false);
  });

  it("follow-up: teishu requests more from mizuya, loops back", async () => {
    const secondMizuyaResponse: MizuyaResponse = {
      ...mizuyaResponse,
      requestId: "req-1-followup-1",
      summary: "Callers traced: bar() and baz().",
    };

    let mizuyaCallCount = 0;
    const mizuya = makeMizuyaAgent(() => {
      mizuyaCallCount++;
      const resp =
        mizuyaCallCount === 1 ? mizuyaResponse : secondMizuyaResponse;
      return Promise.resolve({
        output: JSON.stringify(resp),
        parsed: resp,
        provider: "codex" as const,
        durationMs: 100,
        tokenUsage: { input: 500, output: 200 },
      });
    });

    let teishuCallCount = 0;
    const teishu = makeTeishuAgent(() => {
      teishuCallCount++;
      const resp =
        teishuCallCount === 1 ? teishuFollowUpResponse : teishuFinalResponse;
      return Promise.resolve({
        output: resp.output,
        parsed: resp,
        provider: "claude" as const,
        durationMs: 200,
        tokenUsage: { input: 1000, output: 500 },
      });
    });

    const hanto = new Hanto(mizuya, teishu);
    const result = await hanto.conduct(baseRequest());

    // mizuya: initial + follow-up = 2 calls
    expect(mizuya.run).toHaveBeenCalledTimes(2);
    // teishu: initial (asks follow-up) + final = 2 calls
    expect(teishu.run).toHaveBeenCalledTimes(2);
    expect(result.output).toBe(teishuFinalResponse.output);
    expect(result.degraded).toBe(false);
  });

  it("quick mode: max 1 mizuya turn, no follow-up even if requested", async () => {
    const mizuya = makeMizuyaAgent();
    const teishu = makeTeishuAgent(() =>
      Promise.resolve({
        output: teishuFollowUpResponse.output,
        parsed: teishuFollowUpResponse,
        provider: "claude" as const,
        durationMs: 200,
      }),
    );
    const hanto = new Hanto(mizuya, teishu);

    const result = await hanto.conduct(baseRequest({ mode: "quick" }));

    // mizuya called once (initial), not again for follow-up
    expect(mizuya.run).toHaveBeenCalledTimes(1);
    // teishu called once (no loop because max turns reached)
    expect(teishu.run).toHaveBeenCalledTimes(1);
    expect(result.output).toBe(teishuFollowUpResponse.output);
  });

  it("deep mode: allows up to 3 mizuya turns", async () => {
    let mizuyaCallCount = 0;
    const mizuya = makeMizuyaAgent(() => {
      mizuyaCallCount++;
      const resp = {
        ...mizuyaResponse,
        requestId: `req-1-turn-${mizuyaCallCount}`,
      };
      return Promise.resolve({
        output: JSON.stringify(resp),
        parsed: resp,
        provider: "codex" as const,
        durationMs: 50,
        tokenUsage: { input: 300, output: 100 },
      });
    });

    let teishuCallCount = 0;
    const teishu = makeTeishuAgent(() => {
      teishuCallCount++;
      // Keep requesting follow-ups for first 3 calls, resolve on 4th
      const resp: TeishuResponse =
        teishuCallCount < 4
          ? {
              output: `Need more, round ${teishuCallCount}`,
              needsMoreFromMizuya: true,
              followUpQuestion: `Follow-up question ${teishuCallCount}`,
            }
          : {
              output: "All done after deep analysis.",
              needsMoreFromMizuya: false,
            };
      return Promise.resolve({
        output: resp.output,
        parsed: resp,
        provider: "claude" as const,
        durationMs: 100,
      });
    });

    const hanto = new Hanto(mizuya, teishu);
    const result = await hanto.conduct(baseRequest({ mode: "deep" }));

    // deep mode maxTurns=3: initial(1) + follow-up(2) = 3 mizuya calls
    expect(mizuya.run).toHaveBeenCalledTimes(3);
    // teishu: initial + 2 follow-up loops + no more = 3 calls
    // (after 3rd mizuya turn, loop re-runs teishu; but mizuyaTurns=3 = maxTurns,
    //  so the while condition stops after that teishu call)
    expect(teishu.run).toHaveBeenCalledTimes(3);
    expect(result.degraded).toBe(false);
  });

  it("pre-fetched failure: mizuyaFailure triggers degraded mode without calling mizuya", async () => {
    const mizuya = makeMizuyaAgent();
    const teishu = makeTeishuAgent();
    const hanto = new Hanto(mizuya, teishu);

    const failure = new ProviderError("codex", "TIMEOUT", "timed out");
    const result = await hanto.conduct(
      baseRequest({ mizuyaFailure: failure }),
    );

    expect(mizuya.run).not.toHaveBeenCalled();
    expect(teishu.run).toHaveBeenCalledOnce();
    expect(result.degraded).toBe(true);
    expect(result.degradedReason).toBe("codex:TIMEOUT");
    expect(result.mizuya).toBeUndefined();
  });

  it("phases are recorded with names and durations", async () => {
    const mizuya = makeMizuyaAgent();
    const teishu = makeTeishuAgent();
    const hanto = new Hanto(mizuya, teishu);

    const result = await hanto.conduct(baseRequest());

    expect(result.phases.length).toBeGreaterThanOrEqual(2);

    const shoza = result.phases.find((p) => p.name === "shoza");
    expect(shoza).toBeDefined();
    expect(shoza!.durationMs).toBeGreaterThanOrEqual(0);
    expect(shoza!.provider).toBe("codex");

    const goza = result.phases.find((p) => p.name === "goza");
    expect(goza).toBeDefined();
    expect(goza!.durationMs).toBeGreaterThanOrEqual(0);
    expect(goza!.provider).toBe("claude");
  });
});
