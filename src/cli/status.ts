import type { Command } from "commander";

import { collectStatus } from "../status/checks.js";
import { formatStatusReport } from "../status/format.js";

export function registerStatusCommand(program: Command): void {
  program
    .command("status")
    .description("Show Rikyu environment status.")
    .action(async () => {
      const report = await collectStatus();
      process.stdout.write(formatStatusReport(report));
    });
}
