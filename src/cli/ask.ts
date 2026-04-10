import type { Command } from "commander";

import type { SessionBrief } from "../session/brief.js";
import { executeCollaborationCommand, type CommandHandlerDeps } from "./common.js";

export interface HandleAskCommandInput {
  question: string;
  deps?: CommandHandlerDeps;
}

export function registerAskCommand(program: Command): void {
  program
    .command("ask")
    .description("Ask Rikyu a question.")
    .argument("<question>", "Question to answer")
    .action(async (question: string) => {
      await handleAskCommand({ question });
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
    deps: input.deps,
  });
}
