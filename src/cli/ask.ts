import type { Command } from "commander";

import { modeFromFlags, type ModeFlagOptions } from "../session/mode.js";
import type { SessionBrief } from "../session/brief.js";
import { executeCollaborationCommand, type CommandHandlerDeps, type CommandOutputOptions } from "./common.js";

export interface AskCommandOptions extends ModeFlagOptions, CommandOutputOptions {}

export interface HandleAskCommandInput {
  question: string;
  options?: AskCommandOptions;
  deps?: CommandHandlerDeps;
}

export function registerAskCommand(program: Command): void {
  program
    .command("ask")
    .description("Ask Rikyu a question.")
    .argument("<question>", "Question to answer")
    .option("--quick", "Use quick collaboration mode")
    .option("--deep", "Use deep collaboration mode")
    .option("--ci", "Use CI-friendly output and exit code behavior")
    .option("--json", "Write machine-readable JSON output")
    .option("--quiet", "Suppress output when there are no findings")
    .option("--sarif", "Write SARIF v2.1.0 output")
    .option("--verbose", "Write verbose diagnostic output")
    .action(async (question: string, options: AskCommandOptions) => {
      await handleAskCommand({ question, options });
    });
}

export async function handleAskCommand(input: HandleAskCommandInput) {
  const brief: SessionBrief = {
    task: "ask",
    target: "question",
    intent: input.question,
    desiredOutcome: "answer",
  };

  return executeCollaborationCommand({
    userRequest: input.question,
    brief,
    cliMode: modeFromFlags(input.options),
    outputOptions: input.options,
    deps: input.deps,
  });
}
