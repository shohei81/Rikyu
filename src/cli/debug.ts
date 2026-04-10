import type { Command } from "commander";

import { modeFromFlags, type ModeFlagOptions } from "../session/mode.js";
import type { SessionBrief } from "../session/brief.js";
import { executeCollaborationCommand, type CommandHandlerDeps, type CommandOutputOptions } from "./common.js";

export interface DebugCommandOptions extends ModeFlagOptions, CommandOutputOptions {}

export interface HandleDebugCommandInput {
  symptom: string;
  options?: DebugCommandOptions;
  deps?: CommandHandlerDeps;
}

export function registerDebugCommand(program: Command): void {
  program
    .command("debug")
    .description("Debug a symptom with Rikyu.")
    .argument("<symptom>", "Symptom to debug")
    .option("--quick", "Use quick collaboration mode")
    .option("--deep", "Use deep collaboration mode")
    .option("--ci", "Use CI-friendly output and exit code behavior")
    .option("--json", "Write machine-readable JSON output")
    .option("--quiet", "Suppress output when there are no findings")
    .option("--sarif", "Write SARIF v2.1.0 output")
    .option("--verbose", "Write verbose diagnostic output")
    .action(async (symptom: string, options: DebugCommandOptions) => {
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
    outputOptions: input.options,
    deps: input.deps,
  });
}
