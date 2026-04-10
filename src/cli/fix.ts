import type { Command } from "commander";

import { estimateChangeSize, selectChangeExecutor } from "../collaboration/change-size.js";
import type { DesiredOutcome, SessionBrief } from "../session/brief.js";
import { executeCollaborationCommand, type CommandHandlerDeps } from "./common.js";

export interface FixCommandOptions {
  plan?: boolean;
  patch?: boolean;
  apply?: boolean;
}

export interface HandleFixCommandInput {
  target?: string;
  options?: FixCommandOptions;
  prompt?: string;
  deps?: CommandHandlerDeps;
}

export function registerFixCommand(program: Command): void {
  program
    .command("fix")
    .description("Plan or prepare a fix with Rikyu.")
    .argument("[target]", "Optional path or focus to fix")
    .option("--plan", "Return a fix plan only")
    .option("--patch", "Return a patch proposal")
    .option("--apply", "Prepare an apply flow through the provider approval mechanism")
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

  return executeCollaborationCommand({
    userRequest,
    brief,
    useMizuya: false,
    deps: input.deps,
  });
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
