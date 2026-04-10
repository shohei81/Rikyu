#!/usr/bin/env node
import { Command } from "commander";

import { registerAskCommand } from "./cli/ask.js";
import { registerConfigCommand } from "./cli/config.js";
import { registerDebugCommand } from "./cli/debug.js";
import { runRepl } from "./cli/repl.js";
import { registerReviewCommand } from "./cli/review.js";
import { registerStatusCommand } from "./cli/status.js";
import { version } from "./version.js";

const program = new Command();

program
  .name("rikyu")
  .description("A unified CLI agent that coordinates teishu and mizuya.")
  .version(version)
  .option("--resume [sessionId]", "Resume an interactive session");

registerStatusCommand(program);
registerAskCommand(program);
registerDebugCommand(program);
registerReviewCommand(program);
registerConfigCommand(program);

program.action(async (options: { resume?: boolean | string }) => {
  await runRepl({ resume: options.resume });
});

await program.parseAsync(process.argv);
