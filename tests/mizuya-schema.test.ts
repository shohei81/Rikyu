import { describe, expect, it } from "vitest";

import { mizuyaResponseSchema } from "../src/mizuya/schema.js";

const baseResponse = {
  requestId: "req-1",
  findings: [
    {
      ruleId: "null-check",
      level: "warning",
      message: "Missing null handling",
      location: { file: "src/example.ts", startLine: 12 },
      evidence: ["value can be undefined"],
      inference: "This can throw at runtime.",
      suggestedAction: "Add a guard.",
      confidence: "high",
    },
  ],
  summary: "One warning found.",
  doubts: [],
  contextUsed: ["src/example.ts"],
};

describe("mizuyaResponseSchema", () => {
  it("accepts a valid response", () => {
    expect(mizuyaResponseSchema.parse(baseResponse)).toEqual(baseResponse);
  });

  it("accepts empty findings for ask and explain tasks", () => {
    const parsed = mizuyaResponseSchema.parse({
      ...baseResponse,
      findings: [],
      summary: "The code initializes the CLI.",
    });

    expect(parsed.findings).toEqual([]);
  });

  it("rejects unknown top-level fields", () => {
    expect(() =>
      mizuyaResponseSchema.parse({
        ...baseResponse,
        extra: true,
      }),
    ).toThrow();
  });

  it("rejects missing required finding fields", () => {
    const findingWithoutEvidence: Partial<(typeof baseResponse.findings)[number]> = {
      ...baseResponse.findings[0],
    };
    delete findingWithoutEvidence.evidence;

    expect(() =>
      mizuyaResponseSchema.parse({
        ...baseResponse,
        findings: [findingWithoutEvidence],
      }),
    ).toThrow();
  });

  it("rejects invalid levels", () => {
    expect(() =>
      mizuyaResponseSchema.parse({
        ...baseResponse,
        findings: [{ ...baseResponse.findings[0], level: "info" }],
      }),
    ).toThrow();
  });
});
