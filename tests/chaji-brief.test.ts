import { describe, it, expect } from "vitest";
import { classifyBrief } from "../src/chaji/brief.js";
import type { SessionBrief } from "../src/chaji/types.js";

describe("classifyBrief", () => {
  describe("task classification", () => {
    it('"review my changes" -> task=review, target=working-tree', () => {
      const brief = classifyBrief("review my changes");
      expect(brief.task).toBe("review");
      expect(brief.target).toBe("working-tree");
    });

    it('"debug this error" -> task=debug, target=symptom', () => {
      const brief = classifyBrief("debug this error");
      expect(brief.task).toBe("debug");
      expect(brief.target).toBe("symptom");
    });

    it('"explain what this does" -> task=explain, target=question', () => {
      const brief = classifyBrief("explain what this does");
      expect(brief.task).toBe("explain");
      expect(brief.target).toBe("question");
    });

    it('"fix the issue" -> task=fix, target=working-tree, desiredOutcome=fix-plan', () => {
      const brief = classifyBrief("fix the issue");
      expect(brief.task).toBe("fix");
      expect(brief.target).toBe("working-tree");
      expect(brief.desiredOutcome).toBe("fix-plan");
    });

    it('"fix the bug" matches debug first (pattern priority)', () => {
      // "bug" appears in the debug pattern which is checked before fix
      const brief = classifyBrief("fix the bug");
      expect(brief.task).toBe("debug");
    });

    it('"hello world" -> task=ask (default fallback)', () => {
      const brief = classifyBrief("hello world");
      expect(brief.task).toBe("ask");
    });
  });

  describe("Japanese input", () => {
    it('pure Japanese "レビューして" falls back to ask (\\b limitation)', () => {
      // \b word boundaries do not work with Japanese characters since
      // they are all \W — this is a known limitation of the current patterns.
      const brief = classifyBrief("レビューして");
      expect(brief.task).toBe("ask");
    });

    it('pure Japanese "バグがある" falls back to ask (\\b limitation)', () => {
      const brief = classifyBrief("バグがある");
      expect(brief.task).toBe("ask");
    });

    it('mixed English keyword still matches: "please review して"', () => {
      const brief = classifyBrief("please review して");
      expect(brief.task).toBe("review");
    });
  });

  describe("follow-up detection", () => {
    it('"that is wrong" with previous review brief inherits task/target', () => {
      const previous: SessionBrief = {
        task: "review",
        target: "working-tree",
        intent: "review my changes",
        desiredOutcome: "review",
      };
      const brief = classifyBrief("that is wrong", previous);
      expect(brief.task).toBe("review");
      expect(brief.target).toBe("working-tree");
      expect(brief.intent).toBe("that is wrong");
    });
  });

  describe("flags and modifiers", () => {
    it('"fix --apply" -> desiredOutcome=apply', () => {
      const brief = classifyBrief("fix --apply");
      expect(brief.desiredOutcome).toBe("apply");
    });

    it('"--staged" in input -> target=staged', () => {
      const brief = classifyBrief("review --staged");
      expect(brief.target).toBe("staged");
    });
  });
});
