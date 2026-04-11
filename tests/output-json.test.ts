import { describe, expect, it } from "vitest";

import { formatJson } from "../src/output/json.js";
import type { ChajiResult } from "../src/hanto/orchestrator.js";
import type { MizuyaResponse } from "../src/mizuya/schema.js";

// ── Fixtures ───────────────────────────────────────────

const mizuyaResponse: MizuyaResponse = {
  requestId: "req-1",
  findings: [
    {
      ruleId: "null-check",
      level: "warning",
      message: "Missing null handling",
      evidence: ["value may be undefined"],
      confidence: "high",
    },
  ],
  summary: "One warning.",
  doubts: [],
  contextUsed: ["src/foo.ts"],
};

function makeResult(overrides?: Partial<ChajiResult>): ChajiResult {
  return {
    id: "req-1",
    output: "You should add a null check.",
    teishu: { output: "You should add a null check.", needsMoreFromMizuya: false },
    mizuya: mizuyaResponse,
    degraded: false,
    phases: [
      { name: "shoza", startMs: 0, durationMs: 120, provider: "codex" },
      { name: "goza", startMs: 120, durationMs: 250, provider: "claude" },
    ],
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────

describe("formatJson", () => {
  it("includes requestId, task, output, and degraded flag", () => {
    const json = JSON.parse(
      formatJson(makeResult(), {
        brief: { task: "review", target: "staged" },
      }),
    );

    expect(json.requestId).toBe("req-1");
    expect(json.task).toBe("review");
    expect(json.output).toBe("You should add a null check.");
    expect(json.degraded).toBe(false);
  });

  it("includes timing from shoza and goza phases", () => {
    const json = JSON.parse(
      formatJson(makeResult(), {
        brief: { task: "review", target: "staged" },
        totalMs: 500,
        classificationMs: 30,
      }),
    );

    expect(json.timing.totalMs).toBe(500);
    expect(json.timing.classificationMs).toBe(30);
    expect(json.timing.mizuyaMs).toBe(120);
    expect(json.timing.teishuMs).toBe(250);
  });

  it("omits mizuya when not present", () => {
    const result = makeResult({ mizuya: undefined });
    const json = JSON.parse(
      formatJson(result, {
        brief: { task: "review", target: "staged" },
      }),
    );

    expect(json.mizuya).toBeUndefined();
  });

  it("redacts secrets in output strings", () => {
    const result = makeResult({
      output: "Found key sk-abcdefghijklmnopqrstuv in config",
    });
    const json = JSON.parse(
      formatJson(result, {
        brief: { task: "review", target: "staged" },
      }),
    );

    expect(json.output).not.toContain("sk-abcdefghijklmnopqrstuv");
    expect(json.output).toContain("sk-abc");
    expect(json.output).toContain("*");
  });
});
