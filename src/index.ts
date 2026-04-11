#!/usr/bin/env node
import { createProgram } from "./shokyaku/program.js";

const program = createProgram();
await program.parseAsync(process.argv);
