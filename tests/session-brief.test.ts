import { describe, expect, it } from "vitest";

import {
  buildSessionBriefClassificationPrompt,
  classifySessionBrief,
  classifySessionBriefWithClaude,
  shouldUseMizuyaForTask,
} from "../src/session/brief.js";

describe("classifySessionBrief", () => {
  it("classifies review requests", () => {
    expect(classifySessionBrief("review this diff")).toMatchObject({
      task: "review",
      target: "working-tree",
    });
  });

  it("classifies debug requests", () => {
    expect(classifySessionBrief("debug this error")).toMatchObject({
      task: "debug",
      target: "symptom",
    });
  });

  it("classifies fix requests", () => {
    expect(classifySessionBrief("fix this")).toMatchObject({
      task: "fix",
      desiredOutcome: "fix-plan",
    });
  });
});

describe("shouldUseMizuyaForTask", () => {
  it("routes review, debug, and explain through mizuya", () => {
    expect(shouldUseMizuyaForTask("review")).toBe(true);
    expect(shouldUseMizuyaForTask("debug")).toBe(true);
    expect(shouldUseMizuyaForTask("explain")).toBe(true);
  });

  it("does not route fix or conversation through mizuya", () => {
    expect(shouldUseMizuyaForTask("fix")).toBe(false);
    expect(shouldUseMizuyaForTask("conversation")).toBe(false);
  });
});

describe("classifySessionBriefWithClaude", () => {
  it("builds a small classification prompt and parses JSON output", async () => {
    let prompt = "";
    const brief = await classifySessionBriefWithClaude("please review", async (input) => {
      prompt = input;
      return '{"task":"review","target":"working-tree","intent":"please review","desiredOutcome":"review"}';
    });

    expect(prompt).toContain("Classify the user utterance");
    expect(brief).toEqual({
      task: "review",
      target: "working-tree",
      intent: "please review",
      desiredOutcome: "review",
    });
  });

  it("exposes the classification prompt builder", () => {
    expect(buildSessionBriefClassificationPrompt("hello")).toContain("<user-utterance>hello</user-utterance>");
  });
});
