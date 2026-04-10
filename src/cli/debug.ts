import type { Command } from "commander";

import type { SessionBrief } from "../session/brief.js";
import { executeCollaborationCommand, type CommandHandlerDeps } from "./common.js";

export interface HandleDebugCommandInput {
  symptom: string;
  deps?: CommandHandlerDeps;
}

export function registerDebugCommand(program: Command): void {
  program
    .command("debug")
    .description("Debug a symptom with Rikyu.")
    .argument("<symptom>", "Symptom to debug")
    .action(async (symptom: string) => {
      await handleDebugCommand({ symptom });
    });
}

export async function handleDebugCommand(input: HandleDebugCommandInput) {
  const brief: SessionBrief = {
    task: "debug",
    target: "symptom",
    intent: input.symptom,
  };

  return executeCollaborationCommand({
    userRequest: input.symptom,
    brief,
    deps: input.deps,
  });
}
