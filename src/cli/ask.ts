import type { Command } from "commander";

import { modeFromFlags, type ModeFlagOptions } from "../session/mode.js";
import type { SessionBrief } from "../session/brief.js";
import { executeCollaborationCommand, type CommandHandlerDeps } from "./common.js";

export interface HandleAskCommandInput {
  question: string;
  options?: ModeFlagOptions;
  deps?: CommandHandlerDeps;
}

export function registerAskCommand(program: Command): void {
  program
    .command("ask")
    .description("Ask Rikyu a question.")
    .argument("<question>", "Question to answer")
    .option("--quick", "Use quick collaboration mode")
    .option("--deep", "Use deep collaboration mode")
    .action(async (question: string, options: ModeFlagOptions) => {
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
    deps: input.deps,
  });
}
