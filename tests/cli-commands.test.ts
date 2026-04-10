import { describe, expect, it } from "vitest";

import { handleAskCommand } from "../src/cli/ask.js";
import { handleDebugCommand } from "../src/cli/debug.js";
import { handleFixCommand } from "../src/cli/fix.js";
import { handleReviewCommand } from "../src/cli/review.js";
import type { CommandHandlerDeps } from "../src/cli/common.js";
import type { CollaborationResult, RunCollaborationFlowInput } from "../src/collaboration/flow.js";
import type { SessionContext } from "../src/session/context.js";
import type { RikyuConfig } from "../src/config/schema.js";

const baseConfig: RikyuConfig = {
  mode: "quick",
  verbose: false,
  json: false,
  progress: true,
};

describe("handleReviewCommand", () => {
  it("reviews the working tree through the collaboration flow", async () => {
    const calls: string[] = [];
    const flowInputs: RunCollaborationFlowInput[] = [];
    const deps = createDeps({
      collectContext: async (options) => {
        expect(options).toMatchObject({ cwd: "/repo", target: "working-tree" });
        return context([{ label: "git-diff:working-tree", content: "diff" }]);
      },
      runFlow: async (input) => {
        flowInputs.push(input);
        return result("Review output");
      },
      progress: (stage) => calls.push(stage),
    });

    await handleReviewCommand({ deps });

    expect(calls).toEqual(["reading", "mizuya", "done"]);
    expect(flowInputs[0]).toMatchObject({
      requestId: "req-test",
      userRequest: "Review the working tree changes.",
      brief: {
        task: "review",
        target: "working-tree",
        desiredOutcome: "review",
        mode: "quick",
      },
      context: [{ label: "git-diff:working-tree", content: "diff" }],
    });
  });

  it("reviews staged changes", async () => {
    let contextTarget: unknown;
    const deps = createDeps({
      collectContext: async (options) => {
        contextTarget = options.target;
        return context([{ label: "git-diff:staged", content: "staged diff" }]);
      },
      runFlow: async (input) => {
        expect(input.brief.target).toBe("staged");
        expect(input.userRequest).toBe("Review the staged changes.");
        return result("Staged output");
      },
    });

    await handleReviewCommand({ options: { staged: true }, deps });

    expect(contextTarget).toBe("staged");
  });

  it("reviews a target path as file context", async () => {
    const deps = createDeps({
      collectContext: async (options) => {
        expect(options).toMatchObject({ target: "file", path: "src/app.ts" });
        return context([{ label: "file:src/app.ts", content: "source" }]);
      },
      runFlow: async (input) => {
        expect(input.brief).toMatchObject({
          task: "review",
          target: "file",
          focus: ["src/app.ts"],
        });
        expect(input.userRequest).toBe("Review src/app.ts.");
        return result("File output");
      },
    });

    await handleReviewCommand({ target: "src/app.ts", deps });
  });

  it("does not emit progress when config disables it", async () => {
    const progressStages: string[] = [];
    const deps = createDeps({
      config: { ...baseConfig, progress: false },
      progress: (stage) => progressStages.push(stage),
    });

    await handleReviewCommand({ deps });

    expect(progressStages).toEqual([]);
  });

  it("auto-selects standard mode when config mode is auto", async () => {
    const flowInputs: RunCollaborationFlowInput[] = [];
    const deps = createDeps({
      config: { ...baseConfig, mode: "auto" },
      runFlow: async (input) => {
        flowInputs.push(input);
        return result("Review output");
      },
    });

    await handleReviewCommand({ deps });

    expect(flowInputs[0]?.brief.mode).toBe("standard");
  });
});

describe("handleAskCommand", () => {
  it("routes ask through the collaboration flow", async () => {
    const flowInputs: RunCollaborationFlowInput[] = [];
    const stdout: string[] = [];
    const deps = createDeps({
      stdout: (text) => stdout.push(text),
      runFlow: async (input) => {
        flowInputs.push(input);
        return result("Ask output");
      },
    });

    await handleAskCommand({ question: "What is Rikyu?", deps });

    expect(flowInputs[0]).toMatchObject({
      userRequest: "What is Rikyu?",
      brief: {
        task: "ask",
        target: "question",
        intent: "What is Rikyu?",
        desiredOutcome: "answer",
        mode: "quick",
      },
    });
    expect(flowInputs[0]?.context).toBeUndefined();
    expect(stdout).toEqual(["Ask output\n"]);
  });

  it("writes verbose metadata when config enables it", async () => {
    const stderr: string[] = [];
    const deps = createDeps({
      config: { ...baseConfig, verbose: true },
      stderr: (text) => stderr.push(text),
      runFlow: async () => result("Verbose output", { degraded: true, degradedReason: "codex:ENOENT" }),
    });

    await handleAskCommand({ question: "Why?", deps });

    expect(stderr).toContain("requestId=req-test\n");
    expect(stderr).toContain("degraded=true\n");
    expect(stderr).toContain("degradedReason=codex:ENOENT\n");
  });

  it("lets CLI mode flags override config", async () => {
    const flowInputs: RunCollaborationFlowInput[] = [];
    const deps = createDeps({
      config: { ...baseConfig, mode: "standard" },
      runFlow: async (input) => {
        flowInputs.push(input);
        return result("Ask output");
      },
    });

    await handleAskCommand({ question: "What is Rikyu?", options: { deep: true }, deps });

    expect(flowInputs[0]?.brief.mode).toBe("deep");
  });
});

describe("handleDebugCommand", () => {
  it("routes debug through the collaboration flow", async () => {
    const flowInputs: RunCollaborationFlowInput[] = [];
    const stdout: string[] = [];
    const deps = createDeps({
      stdout: (text) => stdout.push(text),
      runFlow: async (input) => {
        flowInputs.push(input);
        return result("Debug output");
      },
    });

    await handleDebugCommand({ symptom: "Tests fail with EADDRINUSE", deps });

    expect(flowInputs[0]).toMatchObject({
      userRequest: "Tests fail with EADDRINUSE",
      brief: {
        task: "debug",
        target: "symptom",
        intent: "Tests fail with EADDRINUSE",
        mode: "quick",
      },
    });
    expect(stdout).toEqual(["Debug output\n"]);
  });
});

describe("handleFixCommand", () => {
  it("routes fix plan without mizuya", async () => {
    const flowInputs: RunCollaborationFlowInput[] = [];
    const deps = createDeps({
      runFlow: async (input) => {
        flowInputs.push(input);
        return result("Fix plan");
      },
    });

    await handleFixCommand({ target: "src/app.ts", options: { plan: true }, deps });

    expect(flowInputs[0]).toMatchObject({
      brief: {
        task: "fix",
        target: "file",
        focus: ["src/app.ts"],
        desiredOutcome: "fix-plan",
        mode: "quick",
      },
      skipMizuya: true,
    });
    expect(flowInputs[0]?.userRequest).toContain("Desired outcome: fix-plan.");
  });

  it("routes fix patch and apply modes", async () => {
    const outcomes: unknown[] = [];
    const deps = createDeps({
      runFlow: async (input) => {
        outcomes.push(input.brief.desiredOutcome);
        return result("Fix output");
      },
    });

    await handleFixCommand({ options: { patch: true }, deps });
    await handleFixCommand({ options: { apply: true }, deps });

    expect(outcomes).toEqual(["patch-proposal", "apply"]);
  });
});

function createDeps(options: {
  config?: RikyuConfig;
  stdout?: (text: string) => void;
  stderr?: (text: string) => void;
  progress?: (stage: string) => void;
  collectContext?: Parameters<typeof handleReviewCommand>[0]["deps"] extends infer D
    ? D extends { collectContext?: infer C }
      ? C
      : never
    : never;
  runFlow?: (input: RunCollaborationFlowInput) => Promise<CollaborationResult>;
} = {}): CommandHandlerDeps & { collectContext?: NonNullable<typeof options.collectContext> } {
  const config = options.config ?? baseConfig;
  return {
    cwd: "/repo",
    io: {
      stdout: options.stdout ?? (() => undefined),
      stderr: options.stderr ?? (() => undefined),
    },
    loadConfig: async () => config,
    createRequestId: () => "req-test",
    createProgressReporter: (enabled) => ({
      stage: (stage) => {
        if (enabled) options.progress?.(stage);
      },
    }),
    collectContext:
      options.collectContext ??
      (async () => context([{ label: "git-diff:working-tree", content: "diff" }])),
    runFlow: options.runFlow ?? (async () => result("Output")),
  };
}

function context(blocks: SessionContext["blocks"]): SessionContext {
  return {
    cwd: "/repo",
    gitRoot: "/repo",
    head: "abc123",
    blocks,
  };
}

function result(
  output: string,
  overrides: Partial<CollaborationResult> = {},
): CollaborationResult {
  return {
    requestId: "req-test",
    output,
    teishuResponse: {
      output,
      needsMoreFromMizuya: false,
    },
    degraded: false,
    stderr: [],
    ...overrides,
  };
}
