import type { Command } from "commander";

import { loadRikyuConfig } from "../config/loader.js";
import { collectSessionContext, type CollectSessionContextOptions } from "../session/context.js";
import type { SessionBrief } from "../session/brief.js";
import { modeFromFlags, type ModeFlagOptions } from "../session/mode.js";
import {
  applyOutputOptions,
  executeCollaborationCommand,
  type CommandHandlerDeps,
  type CommandOutputOptions,
} from "./common.js";
import { createProgressReporter } from "../output/streaming.js";

export interface ReviewCommandOptions extends ModeFlagOptions, CommandOutputOptions {
  staged?: boolean;
}

export interface HandleReviewCommandInput {
  target?: string;
  options?: ReviewCommandOptions;
  prompt?: string;
  deps?: CommandHandlerDeps & {
    collectContext?: typeof collectSessionContext;
  };
}

export function registerReviewCommand(program: Command): void {
  program
    .command("review")
    .description("Review the current working tree or a target path.")
    .argument("[target]", "Optional path to review")
    .option("--staged", "Review staged changes")
    .option("--quick", "Use quick collaboration mode")
    .option("--deep", "Use deep collaboration mode")
    .option("--json", "Write machine-readable JSON output")
    .option("--sarif", "Write SARIF v2.1.0 output")
    .option("--verbose", "Write verbose diagnostic output")
    .action(async (target: string | undefined, options: ReviewCommandOptions) => {
      await handleReviewCommand({ target, options });
    });
}

export async function handleReviewCommand(input: HandleReviewCommandInput = {}) {
  const deps = input.deps ?? {};
  const io = deps.io ?? {
    stdout: (text: string) => process.stdout.write(text),
    stderr: (text: string) => process.stderr.write(text),
  };
  const loadedConfig = deps.loadConfig
    ? await deps.loadConfig()
    : (await loadRikyuConfig({ cwd: deps.cwd })).config;
  const config = applyOutputOptions(loadedConfig, input.options);
  const progress = deps.createProgressReporter
    ? deps.createProgressReporter(config.progress)
    : createProgressReporter({ enabled: config.progress, writer: io.stderr });
  const contextOptions = toReviewContextOptions(input.target, input.options, deps.cwd);
  progress.stage("reading");
  const context = await (deps.collectContext ?? collectSessionContext)(contextOptions);
  const brief = toReviewBrief(input.target, input.options);
  const userRequest = input.prompt?.trim() || toReviewUserRequest(input.target, input.options);

  return executeCollaborationCommand({
    userRequest,
    brief,
    context: context.blocks,
    config,
    progress,
    cliMode: modeFromFlags(input.options),
    outputOptions: input.options,
    deps,
  });
}

function toReviewContextOptions(
  target: string | undefined,
  options: ReviewCommandOptions | undefined,
  cwd: string | undefined,
): CollectSessionContextOptions {
  if (options?.staged) return { cwd, target: "staged" };
  if (target) return { cwd, target: "file", path: target };
  return { cwd, target: "working-tree" };
}

function toReviewBrief(target: string | undefined, options: ReviewCommandOptions | undefined): SessionBrief {
  if (options?.staged) {
    return { task: "review", target: "staged", desiredOutcome: "review" };
  }

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

function toReviewUserRequest(target: string | undefined, options: ReviewCommandOptions | undefined): string {
  if (options?.staged) return "Review the staged changes.";
  if (target) return `Review ${target}.`;
  return "Review the working tree changes.";
}
