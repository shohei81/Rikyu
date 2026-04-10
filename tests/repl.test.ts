import { describe, expect, it } from "vitest";

import { handleReplInput, type ReplDeps, type ReplState } from "../src/cli/repl.js";
import type { CollaborationResult, RunCollaborationFlowInput } from "../src/collaboration/flow.js";
import type { RikyuConfig } from "../src/config/schema.js";
import type { SessionBrief } from "../src/session/brief.js";
import type { SessionSnapshot, SessionSnapshotInput } from "../src/session/store.js";
import type { RikyuStatusReport } from "../src/status/checks.js";

const config: RikyuConfig = {
  mode: "quick",
  verbose: false,
  json: false,
  progress: false,
};

describe("handleReplInput", () => {
  it("shows help and exits", async () => {
    const stdout: string[] = [];
    const state = replState();
    const deps = createDeps({ stdout: (text) => stdout.push(text) });

    await handleReplInput({ line: "/help", state, deps });
    await handleReplInput({ line: "/exit", state, deps });

    expect(stdout.join("")).toContain("/review [prompt]");
    expect(stdout).toContain("Bye.\n");
    expect(state.exit).toBe(true);
  });

  it("runs slash review without classification", async () => {
    const flowInputs: RunCollaborationFlowInput[] = [];
    let classified = false;
    const deps = createDeps({
      classifySessionBrief: () => {
        classified = true;
        return { task: "ask", target: "question" };
      },
      runFlow: async (input) => {
        flowInputs.push(input);
        return result("Reviewed");
      },
    });

    await handleReplInput({ line: "/review focus on errors", state: replState(), deps });

    expect(classified).toBe(false);
    expect(flowInputs[0]).toMatchObject({
      userRequest: "focus on errors",
      brief: { task: "review", target: "working-tree", mode: "quick" },
    });
  });

  it("runs slash ask", async () => {
    const flowInputs: RunCollaborationFlowInput[] = [];
    const deps = createDeps({
      runFlow: async (input) => {
        flowInputs.push(input);
        return result("Asked");
      },
    });

    await handleReplInput({ line: "/ask what is this?", state: replState(), deps });

    expect(flowInputs[0]).toMatchObject({
      userRequest: "what is this?",
      brief: { task: "ask", target: "question", mode: "quick" },
    });
  });

  it("runs slash debug and fix", async () => {
    const stdout: string[] = [];
    const flowInputs: RunCollaborationFlowInput[] = [];
    const deps = createDeps({
      stdout: (text) => stdout.push(text),
      runFlow: async (input) => {
        flowInputs.push(input);
        return result("Debug output");
      },
    });

    await handleReplInput({ line: "/debug crash", state: replState(), deps });
    await handleReplInput({ line: "/fix bug", state: replState(), deps });

    expect(flowInputs[0]?.brief.task).toBe("debug");
    expect(flowInputs[0]?.userRequest).toBe("crash");
    expect(flowInputs[1]?.brief.task).toBe("fix");
    expect(flowInputs[1]?.skipMizuya).toBe(true);
    expect(stdout).toEqual(["Debug output\n", "Debug output\n"]);
  });

  it("requires a prompt for slash debug", async () => {
    const stderr: string[] = [];
    const deps = createDeps({ stderr: (text) => stderr.push(text) });

    await handleReplInput({ line: "/debug", state: replState(), deps });

    expect(stderr).toEqual(["/debug requires a prompt.\n"]);
  });

  it("shows sessions and resumes a saved session", async () => {
    const stdout: string[] = [];
    const state = replState();
    const snapshot = sessionSnapshot("session-2", { task: "review", target: "working-tree" });
    const deps = createDeps({
      stdout: (text) => stdout.push(text),
      listSessionSnapshots: async () => [snapshot],
      loadSessionSnapshot: async () => snapshot,
    });

    await handleReplInput({ line: "/sessions", state, deps });
    await handleReplInput({ line: "/resume", state, deps });

    expect(stdout.join("")).toContain("session-2\treview");
    expect(stdout).toContain("Resumed session-2 (review).\n");
    expect(state.sessionId).toBe("session-2");
  });

  it("shows status", async () => {
    const stdout: string[] = [];
    const deps = createDeps({
      stdout: (text) => stdout.push(text),
      collectStatus: async () => statusReport(),
    });

    await handleReplInput({ line: "/status", state: replState(), deps });

    expect(stdout.join("")).toContain("Rikyu status");
    expect(stdout.join("")).toContain("config: valid");
  });

  it("classifies natural language input and auto-saves the turn", async () => {
    const flowInputs: RunCollaborationFlowInput[] = [];
    const saved: SessionSnapshotInput[] = [];
    const deps = createDeps({
      classifySessionBrief: () => ({ task: "debug", target: "symptom", intent: "debug this" }),
      runFlow: async (input) => {
        flowInputs.push(input);
        return result("Debugged");
      },
      saveSessionSnapshot: async (input) => {
        saved.push(input);
        return sessionSnapshot(input.sessionId, input.brief);
      },
    });

    await handleReplInput({ line: "debug this", state: replState(), deps });

    expect(flowInputs[0]?.brief.task).toBe("debug");
    expect(saved[0]).toMatchObject({
      sessionId: "session-1",
      brief: { task: "debug", target: "symptom", mode: "quick" },
    });
  });

  it("does not run mizuya flow for natural fix requests", async () => {
    const stdout: string[] = [];
    const saved: SessionSnapshotInput[] = [];
    let flowCalled = false;
    const deps = createDeps({
      stdout: (text) => stdout.push(text),
      classifySessionBrief: () => ({ task: "fix", target: "question", intent: "fix this" }),
      runFlow: async () => {
        flowCalled = true;
        return result("Should not happen");
      },
      saveSessionSnapshot: async (input) => {
        saved.push(input);
        return sessionSnapshot(input.sessionId, input.brief);
      },
    });

    await handleReplInput({ line: "fix this", state: replState(), deps });

    expect(flowCalled).toBe(false);
    expect(stdout).toEqual(["Fix flow is not implemented in Phase 0. Use review or ask for now.\n"]);
    expect(saved[0]?.brief.task).toBe("fix");
  });

  it("reports unknown commands", async () => {
    const stderr: string[] = [];
    const deps = createDeps({ stderr: (text) => stderr.push(text) });

    await handleReplInput({ line: "/nope", state: replState(), deps });

    expect(stderr).toEqual(["Unknown command: /nope\n"]);
  });
});

function createDeps(options: {
  stdout?: (text: string) => void;
  stderr?: (text: string) => void;
  classifySessionBrief?: ReplDeps["classifySessionBrief"];
  runFlow?: (input: RunCollaborationFlowInput) => Promise<CollaborationResult>;
  collectStatus?: ReplDeps["collectStatus"];
  listSessionSnapshots?: ReplDeps["listSessionSnapshots"];
  loadSessionSnapshot?: ReplDeps["loadSessionSnapshot"];
  saveSessionSnapshot?: ReplDeps["saveSessionSnapshot"];
} = {}): ReplDeps & { collectContext: NonNullable<ReplDeps["collectContext"]> } {
  return {
    cwd: "/repo",
    io: {
      stdout: options.stdout ?? (() => undefined),
      stderr: options.stderr ?? (() => undefined),
    },
    loadConfig: async () => config,
    createRequestId: () => "req-1",
    createProgressReporter: () => ({ stage: () => undefined }),
    classifySessionBrief: options.classifySessionBrief,
    runFlow: options.runFlow ?? (async () => result("Output")),
    collectContext: async () => ({
      cwd: "/repo",
      blocks: [{ label: "git-diff:working-tree", content: "diff" }],
    }),
    collectStatus: options.collectStatus,
    listSessionSnapshots: options.listSessionSnapshots,
    loadSessionSnapshot: options.loadSessionSnapshot,
    saveSessionSnapshot:
      options.saveSessionSnapshot ??
      (async (input) => sessionSnapshot(input.sessionId, input.brief)),
  };
}

function replState(): ReplState {
  return {
    sessionId: "session-1",
    exit: false,
  };
}

function result(output: string): CollaborationResult {
  return {
    requestId: "req-1",
    output,
    teishuResponse: { output, needsMoreFromMizuya: false },
    degraded: false,
    stderr: [],
  };
}

function sessionSnapshot(sessionId: string, brief: SessionBrief): SessionSnapshot {
  return {
    sessionId,
    brief,
    mizuyaResponses: [],
    metadata: {
      createdAt: "2026-04-10T00:00:00.000Z",
      updatedAt: "2026-04-10T00:00:00.000Z",
    },
  };
}

function statusReport(): RikyuStatusReport {
  return {
    providers: [],
    config: {
      state: "valid",
      sources: {},
      config,
    },
  };
}
