import type { Command } from "commander";

import { modeFromFlags, type ModeFlagOptions } from "../session/mode.js";
import type { SessionBrief } from "../session/brief.js";
import { executeCollaborationCommand, type CommandHandlerDeps } from "./common.js";

export interface HandleDebugCommandInput {
  symptom: string;
  options?: ModeFlagOptions;
  deps?: CommandHandlerDeps;
}

export function registerDebugCommand(program: Command): void {
  program
    .command("debug")
    .description("Debug a symptom with Rikyu.")
    .argument("<symptom>", "Symptom to debug")
    .option("--quick", "Use quick collaboration mode")
    .option("--deep", "Use deep collaboration mode")
    .action(async (symptom: string, options: ModeFlagOptions) => {
      await handleDebugCommand({ symptom, options });
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
    cliMode: modeFromFlags(input.options),
    deps: input.deps,
  });
}
