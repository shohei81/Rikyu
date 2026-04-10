import { describe, expect, it } from "vitest";

import { renderTextOutput, writeTextOutput } from "../src/output/text.js";
import { createProgressReporter, progressMessageForStage } from "../src/output/streaming.js";
import type { CollaborationResult } from "../src/collaboration/flow.js";

describe("renderTextOutput", () => {
  it("returns Claude output with a trailing newline", () => {
    expect(renderTextOutput({ output: "Final answer" })).toBe("Final answer\n");
  });

  it("does not add a duplicate trailing newline", () => {
    expect(renderTextOutput({ output: "Final answer\n" })).toBe("Final answer\n");
  });

  it("accepts a collaboration result", () => {
    const result: CollaborationResult = {
      requestId: "req-1",
      output: "Unified answer",
      teishuResponse: {
        output: "Unified answer",
        needsMoreFromMizuya: false,
      },
      degraded: false,
      stderr: [],
    };

    expect(renderTextOutput(result)).toBe("Unified answer\n");
  });
});

describe("writeTextOutput", () => {
  it("writes rendered text through the injected writer", () => {
    const chunks: string[] = [];

    writeTextOutput({ output: "Answer" }, (text) => chunks.push(text));

    expect(chunks).toEqual(["Answer\n"]);
  });
});

describe("createProgressReporter", () => {
  it("writes short progress messages", () => {
    const chunks: string[] = [];
    const reporter = createProgressReporter({ writer: (text) => chunks.push(text) });

    reporter.stage("reading");
    reporter.stage("mizuya");
    reporter.stage("teishu");
    reporter.stage("done");

    expect(chunks).toEqual(["Reading...\n", "Consulting mizuya...\n", "Preparing response...\n"]);
  });

  it("does not write when disabled", () => {
    const chunks: string[] = [];
    const reporter = createProgressReporter({
      enabled: false,
      writer: (text) => chunks.push(text),
    });

    reporter.stage("reading");

    expect(chunks).toEqual([]);
  });

  it("exposes stage messages for callers that manage their own rendering", () => {
    expect(progressMessageForStage("reading")).toBe("Reading...");
    expect(progressMessageForStage("done")).toBeUndefined();
  });
});
