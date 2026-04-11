/**
 * 正客 (Shokyaku) — the principal guest / CLI interface.
 *
 * The shokyaku is the user's representative in the tea ceremony.
 * They lead the dialogue with the host and represent all guests.
 *
 * This module sets up the Commander CLI with all commands:
 * review, ask, debug, explain, fix, status, config.
 */

import { Command } from "commander";
import { version } from "../version.js";
import { classifyBrief } from "../chaji/brief.js";
import { loadConfig, setConfigValue, getConfigValue } from "../config/loader.js";
import type { ChajiMode, SessionBrief } from "../chaji/types.js";
import { execute, type OutputOptions } from "./execute.js";
import { runRepl } from "./repl.js";

export function createProgram(): Command {
  const program = new Command();

  program
    .name("rikyu")
    .description(
      "A multi-agent CLI that coordinates teishu (亭主) and mizuya (水屋) for code analysis.",
    )
    .version(version)
    .option("--resume [sessionId]", "Resume an interactive session");

  // ── review ──────────────────────────────────────────
  program
    .command("review [target]")
    .description("Review code changes")
    .option("--staged", "Review staged changes")
    .option("--quick", "Quick mode (1 mizuya turn)")
    .option("--deep", "Deep mode (up to 3 mizuya turns)")
    .option("--ci", "CI mode (set exit code on findings)")
    .option("--json", "JSON output")
    .option("--quiet", "Suppress output when no findings")
    .option("--sarif", "SARIF v2.1.0 output")
    .option("--verbose", "Verbose output")
    .action(async (target: string | undefined, opts) => {
      const brief: SessionBrief = {
        task: "review",
        target: opts.staged ? "staged" : target ? "file" : "working-tree",
        intent: target ? `Review ${target}` : "Review working tree changes",
      };
      await execute({
        brief,
        userRequest: brief.intent!,
        target,
        cliMode: resolveCliMode(opts),
        output: extractOutputOptions(opts),
      });
    });

  // ── ask ─────────────────────────────────────────────
  program
    .command("ask <question...>")
    .description("Ask a question about the codebase")
    .action(async (parts: string[]) => {
      const question = parts.join(" ");
      await execute({
        brief: { task: "ask", target: "question", intent: question },
        userRequest: question,
      });
    });

  // ── debug ───────────────────────────────────────────
  program
    .command("debug <symptom...>")
    .description("Debug a symptom or error")
    .action(async (parts: string[]) => {
      const symptom = parts.join(" ");
      await execute({
        brief: { task: "debug", target: "symptom", intent: symptom },
        userRequest: symptom,
      });
    });

  // ── explain ─────────────────────────────────────────
  program
    .command("explain <topic...>")
    .description("Explain a concept or piece of code")
    .action(async (parts: string[]) => {
      const topic = parts.join(" ");
      await execute({
        brief: { task: "explain", target: "question", intent: topic },
        userRequest: topic,
      });
    });

  // ── fix ─────────────────────────────────────────────
  program
    .command("fix [description...]")
    .description("Propose a fix")
    .option("--plan", "Output a fix plan")
    .option("--patch", "Output a patch proposal")
    .option("--apply", "Apply the fix directly")
    .option("--quick", "Quick mode")
    .option("--deep", "Deep mode")
    .action(async (parts: string[], opts) => {
      const desc = parts.join(" ") || "Fix issues in the working tree";
      const brief = classifyBrief(`fix ${desc}`);
      if (opts.apply) brief.desiredOutcome = "apply";
      else if (opts.patch) brief.desiredOutcome = "patch-proposal";
      else if (opts.plan) brief.desiredOutcome = "fix-plan";
      await execute({
        brief,
        userRequest: desc,
        cliMode: resolveCliMode(opts),
      });
    });

  // ── status ──────────────────────────────────────────
  program
    .command("status")
    .description("Show environment and configuration status")
    .action(async () => {
      const { config, sources } = await loadConfig();
      console.log("rikyu status\n");
      console.log(`Mode: ${config.mode}`);
      console.log(`Verbose: ${config.verbose}`);
      console.log(`JSON: ${config.json}`);
      console.log(`Progress: ${config.progress}`);
      console.log(`Policy: ${config.policyProfile}`);
      console.log(`\nConfig sources: ${sources.length > 0 ? sources.join(", ") : "(defaults)"}`);

      // Check CLI availability
      for (const cli of ["claude", "codex"] as const) {
        try {
          const { execFile } = await import("node:child_process");
          const { promisify } = await import("node:util");
          const exec = promisify(execFile);
          await exec(cli, ["--version"]);
          console.log(`${cli} CLI: available`);
        } catch {
          console.log(`${cli} CLI: not found`);
        }
      }
    });

  // ── config ──────────────────────────────────────────
  const configCmd = program
    .command("config")
    .description("Manage configuration");

  configCmd
    .command("set <key> <value>")
    .option("--global", "Set in global config")
    .action(async (key: string, value: string, opts) => {
      await setConfigValue(key, value, { global: opts.global });
      console.log(`Set ${key} = ${value}`);
    });

  configCmd.command("get <key>").action(async (key: string) => {
    const value = await getConfigValue(key);
    console.log(value !== undefined ? String(value) : `(not set)`);
  });

  configCmd.command("list").action(async () => {
    const { config, sources } = await loadConfig();
    console.log(JSON.stringify(config, null, 2));
    if (sources.length > 0) {
      console.log(`\nSources: ${sources.join(", ")}`);
    }
  });

  // ── Default action: REPL ────────────────────────────
  program.action(async (options: { resume?: boolean | string }) => {
    await runRepl({ resume: options.resume });
  });

  return program;
}

// ── Helpers ─────────────────────────────────────────────

function resolveCliMode(
  opts: Record<string, unknown>,
): ChajiMode | undefined {
  if (opts.quick) return "quick";
  if (opts.deep) return "deep";
  return undefined;
}

function extractOutputOptions(opts: Record<string, unknown>): OutputOptions {
  return {
    ci: opts.ci as boolean | undefined,
    json: opts.json as boolean | undefined,
    quiet: opts.quiet as boolean | undefined,
    sarif: opts.sarif as boolean | undefined,
    verbose: opts.verbose as boolean | undefined,
  };
}
