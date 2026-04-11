import { describe, expect, it } from "vitest";

import { parseMizuyaOutput } from "../src/mizuya/agent.js";

const validResponse = {
  requestId: "req-1",
  findings: [
    {
      ruleId: "null-check",
      level: "warning",
      message: "Missing null handling",
      evidence: ["value can be undefined"],
      confidence: "high",
    },
  ],
  summary: "One warning found.",
  doubts: [],
  contextUsed: ["src/example.ts"],
};

describe("parseMizuyaOutput", () => {
  it("extracts JSON from text with leading/trailing noise", () => {
    const stdout = `Here is my analysis:\n${JSON.stringify(validResponse)}\nDone.`;
    const result = parseMizuyaOutput(stdout);
    expect(result).toEqual(validResponse);
  });

  it("handles JSON with braces inside string values", () => {
    const response = {
      ...validResponse,
      summary: 'Found pattern like if (x) { y } in code',
    };
    const stdout = `prefix ${JSON.stringify(response)} suffix`;
    const result = parseMizuyaOutput(stdout);
    expect(result.summary).toBe('Found pattern like if (x) { y } in code');
  });

  it("throws on no JSON object found", () => {
    expect(() => parseMizuyaOutput("no json here at all")).toThrow(
      "No JSON object found",
    );
  });

  it("throws on invalid schema", () => {
    const bad = JSON.stringify({ foo: "bar" });
    expect(() => parseMizuyaOutput(bad)).toThrow();
  });
});
