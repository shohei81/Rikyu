import { describe, expect, it } from "vitest";

import { MizuyaResponseSchema, MizuyaFindingSchema } from "../src/mizuya/schema.js";

const fullFinding = {
  ruleId: "null-check",
  level: "warning",
  message: "Missing null handling",
  location: { file: "src/example.ts", startLine: 12 },
  evidence: ["value can be undefined"],
  inference: "This can throw at runtime.",
  suggestedAction: "Add a guard.",
  confidence: "high",
};

const baseResponse = {
  requestId: "req-1",
  findings: [fullFinding],
  summary: "One warning found.",
  doubts: [],
  contextUsed: ["src/example.ts"],
};

describe("MizuyaResponseSchema", () => {
  it("accepts a valid response with full finding", () => {
    const parsed = MizuyaResponseSchema.parse(baseResponse);
    expect(parsed).toEqual(baseResponse);
  });

  it("accepts empty findings array", () => {
    const input = {
      ...baseResponse,
      findings: [],
      summary: "No issues found.",
    };
    const parsed = MizuyaResponseSchema.parse(input);
    expect(parsed.findings).toEqual([]);
  });

  it("rejects missing required fields", () => {
    // Missing requestId
    expect(() =>
      MizuyaResponseSchema.parse({
        findings: [],
        summary: "ok",
        doubts: [],
        contextUsed: [],
      }),
    ).toThrow();

    // Missing summary
    expect(() =>
      MizuyaResponseSchema.parse({
        requestId: "req-1",
        findings: [],
        doubts: [],
        contextUsed: [],
      }),
    ).toThrow();

    // Missing findings
    expect(() =>
      MizuyaResponseSchema.parse({
        requestId: "req-1",
        summary: "ok",
        doubts: [],
        contextUsed: [],
      }),
    ).toThrow();
  });

  it("rejects invalid level values", () => {
    const badFinding = { ...fullFinding, level: "critical" };
    expect(() =>
      MizuyaResponseSchema.parse({
        ...baseResponse,
        findings: [badFinding],
      }),
    ).toThrow();
  });
});

describe("MizuyaFindingSchema", () => {
  it("accepts finding without optional fields", () => {
    const minimal = {
      ruleId: "test-rule",
      level: "note",
      message: "Something to note",
      evidence: [],
      confidence: "low",
    };
    const parsed = MizuyaFindingSchema.parse(minimal);
    expect(parsed.location).toBeUndefined();
    expect(parsed.inference).toBeUndefined();
    expect(parsed.suggestedAction).toBeUndefined();
  });

  it("rejects invalid confidence values", () => {
    expect(() =>
      MizuyaFindingSchema.parse({
        ruleId: "test-rule",
        level: "error",
        message: "bad",
        evidence: [],
        confidence: "very-high",
      }),
    ).toThrow();
  });
});
