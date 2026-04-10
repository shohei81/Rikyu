import type { Command } from "commander";

import {
  collectChangeVerification,
  formatChangeVerification,
} from "../collaboration/change-verification.js";
import { estimateChangeSize, selectChangeExecutor } from "../collaboration/change-size.js";
import { compareReviewFindings, formatReReviewNotification } from "../collaboration/review-compare.js";
import {
  formatRollbackGuidance,
  recordRollbackSnapshot,
  type RollbackSnapshot,
} from "../collaboration/rollback.js";
import type { MizuyaResponse } from "../mizuya/schema.js";
import { redactSecrets } from "../output/redaction.js";
import { collectSessionContext, type CollectSessionContextOptions } from "../session/context.js";
import type { DesiredOutcome, SessionBrief } from "../session/brief.js";
import { modeFromFlags, type ModeFlagOptions } from "../session/mode.js";
import { executeCollaborationCommand, type CommandHandlerDeps, type CommandOutputOptions } from "./common.js";

export interface FixCommandOptions extends ModeFlagOptions, CommandOutputOptions {
  plan?: boolean;
  patch?: boolean;
  apply?: boolean;
}

export interface HandleFixCommandInput {
  target?: string;
  options?: FixCommandOptions;
  prompt?: string;
  deps?: CommandHandlerDeps & {
    collectChangeVerification?: typeof collectChangeVerification;
    collectContext?: typeof collectSessionContext;
    recordRollbackSnapshot?: typeof recordRollbackSnapshot;
  };
}

export function registerFixCommand(program: Command): void {
  program
    .command("fix")
    .description("Plan or prepare a fix with Rikyu.")
    .argument("[target]", "Optional path or focus to fix")
    .option("--plan", "Return a fix plan only")
    .option("--patch", "Return a patch proposal")
    .option("--apply", "Prepare an apply flow through the provider approval mechanism")
    .option("--quick", "Use quick collaboration mode")
    .option("--deep", "Use deep collaboration mode")
    .option("--ci", "Use CI-friendly output and exit code behavior")
    .option("--json", "Write machine-readable JSON output")
    .option("--quiet", "Suppress output when there are no findings")
    .option("--sarif", "Write SARIF v2.1.0 output")
    .option("--verbose", "Write verbose diagnostic output")
    .action(async (target: string | undefined, options: FixCommandOptions) => {
      await handleFixCommand({ target, options });
    });
}

export async function handleFixCommand(input: HandleFixCommandInput = {}) {
  const mode = resolveFixMode(input.options);
  const estimatedSize = estimateChangeSize({
    filesChanged: input.target ? 1 : 2,
    diffLines: 80,
    requiresTests: mode !== "fix-plan",
  });
  const executor = selectChangeExecutor(estimatedSize);
  const brief: SessionBrief = {
    task: "fix",
    target: input.target ? "file" : "question",
    ...(input.target ? { focus: [input.target] } : {}),
    desiredOutcome: mode,
  };
  const userRequest = buildFixUserRequest({
    target: input.target,
    prompt: input.prompt,
    desiredOutcome: mode,
    executor,
  });

  const rollbackSnapshot = mode === "apply" ? await prepareRollbackSnapshot(input) : undefined;
  let result: Awaited<ReturnType<typeof executeCollaborationCommand>>;
  try {
    result = await executeCollaborationCommand({
      userRequest,
      brief,
      useMizuya: false,
      cliMode: modeFromFlags(input.options),
      outputOptions: input.options,
      deps: input.deps,
    });
  } catch (error) {
    if (rollbackSnapshot) writeRollbackGuidance(input, rollbackSnapshot);
    throw error;
  }

  if (mode === "apply") {
    await runReReviewAfterApply(input, result.mizuyaResponse);
    await reportChangeVerification(input, rollbackSnapshot);
  }

  return result;
}

async function prepareRollbackSnapshot(input: HandleFixCommandInput): Promise<RollbackSnapshot> {
  const recorder = input.deps?.recordRollbackSnapshot ?? recordRollbackSnapshot;
  try {
    return await recorder({ cwd: input.deps?.cwd });
  } catch (error) {
    return {
      id: "unrecorded",
      cwd: input.deps?.cwd ?? process.cwd(),
      createdAt: new Date().toISOString(),
      captureError: error instanceof Error ? error.message : String(error),
    };
  }
}

function writeRollbackGuidance(input: HandleFixCommandInput, snapshot: RollbackSnapshot): void {
  const io = input.deps?.io ?? {
    stdout: (text: string) => process.stdout.write(text),
    stderr: (text: string) => process.stderr.write(text),
  };
  io.stderr(redactSecrets(formatRollbackGuidance(snapshot)));
}

async function reportChangeVerification(
  input: HandleFixCommandInput,
  beforeSnapshot: RollbackSnapshot | undefined,
): Promise<void> {
  const deps = input.deps ?? {};
  const io = deps.io ?? {
    stdout: (text: string) => process.stdout.write(text),
    stderr: (text: string) => process.stderr.write(text),
  };
  const collector = deps.collectChangeVerification ?? collectChangeVerification;
  const summary = await collector({ cwd: deps.cwd, beforeSnapshot });
  io.stderr(redactSecrets(formatChangeVerification(summary)));
}

function resolveFixMode(options: FixCommandOptions | undefined): DesiredOutcome {
  if (options?.apply) return "apply";
  if (options?.patch) return "patch-proposal";
  return "fix-plan";
}

function buildFixUserRequest(input: {
  target?: string;
  prompt?: string;
  desiredOutcome: DesiredOutcome;
  executor: string;
}): string {
  const base = input.prompt?.trim() || (input.target ? `Fix ${input.target}.` : "Plan a fix.");
  return [
    base,
    `Desired outcome: ${input.desiredOutcome}.`,
    `Selected executor: ${input.executor}.`,
    "Do not perform destructive changes without explicit approval.",
  ].join("\n");
}

async function runReReviewAfterApply(
  input: HandleFixCommandInput,
  previousReview: MizuyaResponse | undefined,
): Promise<void> {
  const deps = input.deps ?? {};
  const io = deps.io ?? {
    stdout: (text: string) => process.stdout.write(text),
    stderr: (text: string) => process.stderr.write(text),
  };
  const reviewDeps = { ...deps, mizuyaResponse: undefined };
  const contextOptions = toReReviewContextOptions(input.target, deps.cwd);
  const context = await (deps.collectContext ?? collectSessionContext)(contextOptions);
  const reviewResult = await executeCollaborationCommand({
    userRequest: input.target
      ? `Re-review ${input.target} after applying the fix.`
      : "Re-review the working tree after applying the fix.",
    brief: toReReviewBrief(input.target),
    context: context.blocks,
    suppressOutput: true,
    cliMode: modeFromFlags(input.options),
    outputOptions: input.options,
    deps: reviewDeps,
  });
  if (!reviewResult.mizuyaResponse) {
    io.stderr("Re-review completed without comparable mizuya findings.\n");
    return;
  }
  const comparison = compareReviewFindings(previousReview, reviewResult.mizuyaResponse);
  io.stderr(redactSecrets(formatReReviewNotification(comparison)));
}

function toReReviewContextOptions(
  target: string | undefined,
  cwd: string | undefined,
): CollectSessionContextOptions {
  if (target) return { cwd, target: "file", path: target };
  return { cwd, target: "working-tree" };
}

function toReReviewBrief(target: string | undefined): SessionBrief {
  if (target) {
    return {
      task: "review",
      target: "file",
      focus: [target],
      desiredOutcome: "review",
    };
  }

  return { task: "review", target: "working-tree", desiredOutcome: "review" };
}
