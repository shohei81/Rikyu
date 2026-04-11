import { describe, expect, it } from "vitest";

import { parseTeishuOutput } from "../src/teishu/agent.js";

const validResponse = {
  output: "Here is the answer.",
  needsMoreFromMizuya: false,
};

describe("parseTeishuOutput", () => {
  it("extracts JSON from text with noise", () => {
    const stdout = `Some preamble\n${JSON.stringify(validResponse)}\ntrailer`;
    const result = parseTeishuOutput(stdout);
    expect(result).toMatchObject(validResponse);
  });

  it("parses Claude envelope format and unwraps result", () => {
    const inner = { output: "hi", needsMoreFromMizuya: false };
    const envelope = {
      result: JSON.stringify(inner),
      session_id: "abc-123",
    };
    const stdout = JSON.stringify(envelope);
    const result = parseTeishuOutput(stdout);

    expect(result.output).toBe("hi");
    expect(result.needsMoreFromMizuya).toBe(false);
    expect(result.sessionId).toBe("abc-123");
  });

  it("falls back to plain text when no JSON is found", () => {
    const stdout = "This is a plain text response with no braces";
    const result = parseTeishuOutput(stdout);
    expect(result).toEqual({
      output: "This is a plain text response with no braces",
      needsMoreFromMizuya: false,
    });
  });

  it("falls back to plain text for JSON that does not match schema", () => {
    const stdout = JSON.stringify({ wrong: "shape" });
    const result = parseTeishuOutput(stdout);
    expect(result.output).toBe(stdout);
    expect(result.needsMoreFromMizuya).toBe(false);
  });

  it("falls back to plain text when response contains braces in prose", () => {
    const stdout = "Here is a tip: use {destructuring} for clarity.";
    const result = parseTeishuOutput(stdout);
    expect(result.output).toBe(stdout);
    expect(result.needsMoreFromMizuya).toBe(false);
  });

  it("strips markdown code fences and parses JSON inside", () => {
    const inner = { output: "Hello!", needsMoreFromMizuya: false, followUpQuestion: null };
    const stdout = "```json\n" + JSON.stringify(inner, null, 2) + "\n```";
    const result = parseTeishuOutput(stdout);
    expect(result.output).toBe("Hello!");
    expect(result.needsMoreFromMizuya).toBe(false);
  });

  it("accepts null for followUpQuestion", () => {
    const stdout = JSON.stringify({
      output: "Done.",
      needsMoreFromMizuya: false,
      followUpQuestion: null,
    });
    const result = parseTeishuOutput(stdout);
    expect(result.output).toBe("Done.");
    expect(result.followUpQuestion).toBeNull();
  });

  it("handles Claude envelope with markdown code fence inside result", () => {
    const inner = { output: "Review complete.", needsMoreFromMizuya: false };
    const envelope = {
      result: "```json\n" + JSON.stringify(inner) + "\n```",
      session_id: "s-42",
    };
    const result = parseTeishuOutput(JSON.stringify(envelope));
    expect(result.output).toBe("Review complete.");
    expect(result.sessionId).toBe("s-42");
  });
});
