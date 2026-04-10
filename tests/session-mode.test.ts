import { describe, expect, it } from "vitest";

import {
  autoSelectCollaborationMode,
  modeFromFlags,
  resolveCollaborationMode,
} from "../src/session/mode.js";

describe("autoSelectCollaborationMode", () => {
  it("selects quick for ask and explain", () => {
    expect(autoSelectCollaborationMode({ task: "ask", target: "question" })).toBe("quick");
    expect(autoSelectCollaborationMode({ task: "explain", target: "question" })).toBe("quick");
  });

  it("selects standard for review, debug, and fix plan", () => {
    expect(autoSelectCollaborationMode({ task: "review", target: "working-tree" })).toBe("standard");
    expect(autoSelectCollaborationMode({ task: "debug", target: "symptom" })).toBe("standard");
    expect(
      autoSelectCollaborationMode({
        task: "fix",
        target: "question",
        desiredOutcome: "fix-plan",
      }),
    ).toBe("standard");
  });

  it("selects deep for high urgency and patch/apply outcomes", () => {
    expect(
      autoSelectCollaborationMode({ task: "ask", target: "question", urgency: "high" }),
    ).toBe("deep");
    expect(
      autoSelectCollaborationMode({
        task: "fix",
        target: "question",
        desiredOutcome: "patch-proposal",
      }),
    ).toBe("deep");
    expect(
      autoSelectCollaborationMode({ task: "fix", target: "question", desiredOutcome: "apply" }),
    ).toBe("deep");
  });
});

describe("resolveCollaborationMode", () => {
  it("uses CLI mode before config and auto", () => {
    expect(
      resolveCollaborationMode({
        brief: { task: "ask", target: "question" },
        configMode: "standard",
        cliMode: "deep",
      }),
    ).toBe("deep");
  });

  it("uses config mode before auto selection", () => {
    expect(
      resolveCollaborationMode({
        brief: { task: "ask", target: "question" },
        configMode: "standard",
      }),
    ).toBe("standard");
  });

  it("falls back to auto selection", () => {
    expect(
      resolveCollaborationMode({
        brief: { task: "review", target: "working-tree" },
        configMode: "auto",
      }),
    ).toBe("standard");
  });
});

describe("modeFromFlags", () => {
  it("parses quick/deep flags with deep taking precedence", () => {
    expect(modeFromFlags({ quick: true })).toBe("quick");
    expect(modeFromFlags({ deep: true })).toBe("deep");
    expect(modeFromFlags({ quick: true, deep: true })).toBe("deep");
    expect(modeFromFlags({})).toBeUndefined();
  });
});
