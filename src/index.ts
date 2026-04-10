#!/usr/bin/env node
import { Command } from "commander";

import { registerAskCommand } from "./cli/ask.js";
import { registerConfigCommand } from "./cli/config.js";
import { registerReviewCommand } from "./cli/review.js";
import { registerStatusCommand } from "./cli/status.js";
import { version } from "./version.js";

const program = new Command();

program
  .name("rikyu")
  .description("A unified CLI agent that coordinates teishu and mizuya.")
  .version(version);

registerStatusCommand(program);
registerAskCommand(program);
registerReviewCommand(program);
registerConfigCommand(program);

await program.parseAsync(process.argv);
