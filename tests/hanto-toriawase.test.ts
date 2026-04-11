import { describe, expect, it } from "vitest";

import {
  maxMizuyaTurns,
  resolveMode,
  shouldUseMizuya,
} from "../src/hanto/toriawase.js";

// ── maxMizuyaTurns ─────────────────────────────────────

describe("maxMizuyaTurns", () => {
  it("returns 1 for quick mode", () => {
    expect(maxMizuyaTurns("quick")).toBe(1);
  });

  it("returns 2 for standard mode", () => {
    expect(maxMizuyaTurns("standard")).toBe(2);
  });

  it("returns 3 for deep mode", () => {
    expect(maxMizuyaTurns("deep")).toBe(3);
  });

  it("returns 2 for undefined (default)", () => {
    expect(maxMizuyaTurns(undefined)).toBe(2);
  });
});

// ── resolveMode ────────────────────────────────────────

describe("resolveMode", () => {
  it("cli flag wins over config and auto-resolve", () => {
    expect(
      resolveMode({
        brief: { task: "review", target: "staged" },
        configMode: "deep",
        cliMode: "quick",
      }),
    ).toBe("quick");
  });

  it("config mode wins when no cli flag", () => {
    expect(
      resolveMode({
        brief: { task: "review", target: "staged" },
        configMode: "deep",
      }),
    ).toBe("deep");
  });

  it("auto-resolves by task when no cli or config mode", () => {
    expect(
      resolveMode({ brief: { task: "ask", target: "question" } }),
    ).toBe("quick");

    expect(
      resolveMode({ brief: { task: "explain", target: "question" } }),
    ).toBe("quick");

    expect(
      resolveMode({ brief: { task: "review", target: "staged" } }),
    ).toBe("standard");

    expect(
      resolveMode({ brief: { task: "debug", target: "symptom" } }),
    ).toBe("standard");

    expect(
      resolveMode({ brief: { task: "fix", target: "symptom" } }),
    ).toBe("deep");
  });

  it("treats configMode 'auto' as auto-resolve", () => {
    expect(
      resolveMode({
        brief: { task: "fix", target: "symptom" },
        configMode: "auto",
      }),
    ).toBe("deep");
  });
});

// ── shouldUseMizuya ────────────────────────────────────

describe("shouldUseMizuya", () => {
  it("returns true for review", () => {
    expect(shouldUseMizuya("review")).toBe(true);
  });

  it("returns true for debug", () => {
    expect(shouldUseMizuya("debug")).toBe(true);
  });

  it("returns true for explain", () => {
    expect(shouldUseMizuya("explain")).toBe(true);
  });

  it("returns true for ask", () => {
    expect(shouldUseMizuya("ask")).toBe(true);
  });

  it("returns false for fix", () => {
    expect(shouldUseMizuya("fix")).toBe(false);
  });
});
