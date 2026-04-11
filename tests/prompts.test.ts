import { describe, expect, it } from "vitest";

import { buildMizuyaPrompt } from "../src/mizuya/agent.js";
import { buildTeishuPrompt } from "../src/teishu/agent.js";
import type { MizuyaResponse } from "../src/mizuya/schema.js";

// ── buildMizuyaPrompt ──────────────────────────────────

describe("buildMizuyaPrompt", () => {
  it("includes requestId, task, and user request", () => {
    const prompt = buildMizuyaPrompt({
      requestId: "req-42",
      userRequest: "Check for null pointer bugs",
      brief: { task: "review", target: "staged" },
    });

    expect(prompt).toContain("req-42");
    expect(prompt).toContain("review");
    expect(prompt).toContain("Check for null pointer bugs");
  });

  it("includes context blocks when provided", () => {
    const prompt = buildMizuyaPrompt({
      requestId: "req-43",
      userRequest: "Explain this code",
      brief: { task: "explain", target: "file" },
      context: [
        { label: "Main source", content: "function foo() { return 1; }" },
        { label: "Test file", content: "describe('foo', () => {})" },
      ],
    });

    expect(prompt).toContain("Main source");
    expect(prompt).toContain("function foo() { return 1; }");
    expect(prompt).toContain("Test file");
    expect(prompt).toContain("describe('foo', () => {})");
  });

  it("contains task-specific hints for review", () => {
    const prompt = buildMizuyaPrompt({
      requestId: "req-1",
      userRequest: "Review",
      brief: { task: "review", target: "staged" },
    });

    expect(prompt).toContain("bugs");
    expect(prompt).toContain("regressions");
  });

  it("contains task-specific hints for debug", () => {
    const prompt = buildMizuyaPrompt({
      requestId: "req-1",
      userRequest: "Debug",
      brief: { task: "debug", target: "symptom" },
    });

    expect(prompt).toContain("symptom");
    expect(prompt).toContain("hypotheses");
  });

  it("contains task-specific hints for ask", () => {
    const prompt = buildMizuyaPrompt({
      requestId: "req-1",
      userRequest: "How does X work?",
      brief: { task: "ask", target: "question" },
    });

    expect(prompt).toContain("answer");
    expect(prompt).toContain("summary");
  });

  it("contains task-specific hints for explain", () => {
    const prompt = buildMizuyaPrompt({
      requestId: "req-1",
      userRequest: "Explain auth flow",
      brief: { task: "explain", target: "question" },
    });

    expect(prompt).toContain("explanation");
    expect(prompt).toContain("summary");
  });

  it("contains task-specific hints for fix", () => {
    const prompt = buildMizuyaPrompt({
      requestId: "req-1",
      userRequest: "Fix the login bug",
      brief: { task: "fix", target: "symptom" },
    });

    expect(prompt).toContain("fix plan");
  });

  it("includes intent when provided in brief", () => {
    const prompt = buildMizuyaPrompt({
      requestId: "req-1",
      userRequest: "Review",
      brief: { task: "review", target: "staged", intent: "Focus on security" },
    });

    expect(prompt).toContain("Focus on security");
  });
});

// ── buildTeishuPrompt ──────────────────────────────────

describe("buildTeishuPrompt", () => {
  it("includes wakei-seijaku constraints", () => {
    const prompt = buildTeishuPrompt({
      userRequest: "Review my code",
      brief: { task: "review", target: "staged" },
    });

    // Check that the four principles are referenced via constraint IDs
    expect(prompt).toContain("wa-");
    expect(prompt).toContain("kei-");
    expect(prompt).toContain("sei-");
    expect(prompt).toContain("jaku-");
  });

  it("includes mizuya response data when provided", () => {
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
      summary: "One warning found.",
      doubts: ["Could be intentional"],
      contextUsed: ["src/foo.ts"],
    };

    const prompt = buildTeishuPrompt({
      userRequest: "Review my code",
      brief: { task: "review", target: "staged" },
      mizuyaResponse,
    });

    expect(prompt).toContain("Mizuya Preparation");
    expect(prompt).toContain("One warning found.");
    expect(prompt).toContain("null-check");
    expect(prompt).toContain("Could be intentional");
  });

  it("notes when mizuya was unavailable", () => {
    const prompt = buildTeishuPrompt({
      userRequest: "Review my code",
      brief: { task: "review", target: "staged" },
      // mizuyaResponse not provided, mizuyaSkipped not set
    });

    expect(prompt).toContain("unavailable");
  });

  it("does not note unavailability when mizuya was skipped", () => {
    const prompt = buildTeishuPrompt({
      userRequest: "Fix the bug",
      brief: { task: "fix", target: "symptom" },
      mizuyaSkipped: true,
    });

    // When mizuya is explicitly skipped, the "unavailable" note should not appear
    expect(prompt).not.toContain("unavailable");
  });

  it("contains trust boundary constraints", () => {
    const prompt = buildTeishuPrompt({
      userRequest: "Review my code",
      brief: { task: "review", target: "staged" },
    });

    expect(prompt).toContain("trust-");
    expect(prompt).toContain("raw data");
    expect(prompt).toContain("evaluate");
  });

  it("includes follow-up context when provided", () => {
    const prompt = buildTeishuPrompt({
      userRequest: "Review my code",
      brief: { task: "review", target: "staged" },
      followUpQuestion: "Which functions call foo()?",
    });

    expect(prompt).toContain("Follow-up Context");
    expect(prompt).toContain("Which functions call foo()?");
  });
});
