#!/usr/bin/env node
import { createProgram } from "./shokyaku/program.js";

const program = createProgram();
program.parseAsync(process.argv).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
