/**
 * Interactive REPL — the 正客 (shokyaku) in conversation.
 *
 * Like an ongoing tea gathering where the guest and host
 * exchange dialogue, the REPL maintains session state
 * across multiple turns.
 */

import { createInterface, type Interface } from "node:readline";
import { randomUUID } from "node:crypto";
import chalk from "chalk";
import { classifyBrief } from "../chaji/brief.js";
import {
  loadSnapshot,
  listSnapshots,
  type SessionSnapshot,
} from "../chaji/store.js";
import type { SessionBrief } from "../chaji/types.js";
import type { MizuyaResponse } from "../mizuya/schema.js";
import { ProviderError } from "../agent/types.js";
import { execute } from "./execute.js";
import { renderMarkdown } from "./render.js";

// ── REPL state ──────────────────────────────────────────

interface ReplState {
  sessionId: string;
  claudeSessionId?: string;
  lastBrief?: SessionBrief;
  lastMizuyaResponse?: MizuyaResponse;
  consecutiveFailures: number;
  circuitOpen: boolean;
}

const MAX_CONSECUTIVE_FAILURES = 3;

// ── UI helpers ──────────────────────────────────────────

const PROMPT = chalk.green("◆") + chalk.dim(" rikyu ") + chalk.dim("› ");
const SEPARATOR = chalk.dim("─".repeat(Math.min(process.stdout.columns || 60, 60)));

function printBanner(): void {
  console.log();
  console.log(chalk.dim("╭──────────────────────────╮"));
  console.log(chalk.dim("│") + chalk.white.bold("  rikyu ") + chalk.dim("─ 一期一会     ") + chalk.dim("│"));
  console.log(chalk.dim("╰──────────────────────────╯"));
  console.log(chalk.dim("  /help for commands\n"));
}

function printResponse(text: string): void {
  console.log();
  console.log(SEPARATOR);
  process.stdout.write(renderMarkdown(text));
  console.log(SEPARATOR);
  console.log();
}

function printError(message: string): void {
  console.log();
  console.log(chalk.red("  ✕ ") + message);
  console.log();
}

function printInfo(message: string): void {
  console.log(chalk.dim("  " + message));
}

// ── Slash commands ──────────────────────────────────────

interface SlashCommand {
  name: string;
  description: string;
  handler: (
    args: string,
    state: ReplState,
    rl: Interface,
  ) => Promise<boolean>;
}

const slashCommands: SlashCommand[] = [
  {
    name: "help",
    description: "Show available commands",
    handler: async () => {
      console.log();
      console.log(chalk.white.bold("  Commands"));
      console.log();
      const cmds = [
        ["/review", "Review code changes"],
        ["/ask", "Ask a question"],
        ["/debug", "Debug a symptom"],
        ["/explain", "Explain a concept"],
        ["/fix", "Propose a fix"],
        ["/sessions", "List saved sessions"],
        ["/resume", "Resume a session"],
        ["/status", "Show status"],
        ["/exit", "Exit"],
      ];
      for (const [cmd, desc] of cmds) {
        console.log(`  ${chalk.cyan(cmd.padEnd(12))} ${chalk.dim(desc)}`);
      }
      console.log(chalk.dim("\n  Or just type naturally.\n"));
      return true;
    },
  },
  {
    name: "exit",
    description: "Exit REPL",
    handler: async () => false,
  },
  {
    name: "sessions",
    description: "List sessions",
    handler: async () => {
      const sessions = await listSnapshots();
      if (sessions.length === 0) {
        printInfo("No saved sessions.");
      } else {
        console.log();
        console.log(chalk.white.bold("  Sessions"));
        console.log();
        for (const s of sessions.slice(0, 10)) {
          console.log(
            `  ${chalk.cyan(s.sessionId.slice(0, 8))}  ${chalk.dim(s.updatedAt)}`,
          );
        }
      }
      console.log();
      return true;
    },
  },
  {
    name: "resume",
    description: "Resume a session",
    handler: async (args, state) => {
      try {
        let snapshot: SessionSnapshot;
        if (args.trim()) {
          snapshot = await loadSnapshot(args.trim());
        } else {
          const sessions = await listSnapshots();
          if (sessions.length === 0) {
            printInfo("No sessions to resume.");
            return true;
          }
          snapshot = await loadSnapshot(sessions[0].sessionId);
        }
        state.sessionId = snapshot.sessionId;
        state.claudeSessionId = snapshot.claudeSessionId;
        state.lastBrief = snapshot.brief as unknown as SessionBrief;
        printInfo(`Resumed session ${chalk.cyan(snapshot.sessionId.slice(0, 8))}`);
      } catch (error) {
        printError(error instanceof Error ? error.message : String(error));
      }
      return true;
    },
  },
  {
    name: "status",
    description: "Show status",
    handler: async (_, state) => {
      console.log();
      console.log(chalk.white.bold("  Status"));
      console.log();
      console.log(`  ${chalk.dim("session")}   ${chalk.cyan(state.sessionId.slice(0, 8))}`);
      if (state.claudeSessionId) {
        console.log(`  ${chalk.dim("claude")}    ${state.claudeSessionId.slice(0, 8)}`);
      }
      if (state.lastBrief) {
        console.log(`  ${chalk.dim("last task")} ${state.lastBrief.task}`);
      }
      console.log(
        `  ${chalk.dim("circuit")}   ${state.circuitOpen ? chalk.red("open") : chalk.green("closed")}`,
      );
      console.log();
      return true;
    },
  },
];

// Task-specific slash commands
for (const task of ["review", "ask", "debug", "explain", "fix"] as const) {
  slashCommands.push({
    name: task,
    description: `Run ${task} command`,
    handler: async (args, state) => {
      const prompt = args.trim() || task;
      await runTurn(prompt, state, task);
      return true;
    },
  });
}

// ── Main REPL loop ──────────────────────────────────────

export interface ReplOptions {
  resume?: boolean | string;
}

export async function runRepl(options?: ReplOptions): Promise<void> {
  const state: ReplState = {
    sessionId: randomUUID(),
    consecutiveFailures: 0,
    circuitOpen: false,
  };

  // Handle --resume
  if (options?.resume) {
    const resumeId =
      typeof options.resume === "string" ? options.resume : undefined;
    try {
      let snapshot: SessionSnapshot;
      if (resumeId) {
        snapshot = await loadSnapshot(resumeId);
      } else {
        const sessions = await listSnapshots();
        if (sessions.length > 0) {
          snapshot = await loadSnapshot(sessions[0].sessionId);
        } else {
          printInfo("No sessions to resume.");
          snapshot = undefined as unknown as SessionSnapshot;
        }
      }
      if (snapshot) {
        state.sessionId = snapshot.sessionId;
        state.claudeSessionId = snapshot.claudeSessionId;
        state.lastBrief = snapshot.brief as unknown as SessionBrief;
        printInfo(`Resumed session ${chalk.cyan(snapshot.sessionId.slice(0, 8))}`);
      }
    } catch (error) {
      printError(error instanceof Error ? error.message : String(error));
    }
  }

  printBanner();

  return new Promise<void>((resolve) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: PROMPT,
    });

    rl.on("close", () => {
      resolve();
    });

    const handleLine = async (line: string): Promise<void> => {
      const input = line.trim();
      if (!input) return;

      // Slash command
      if (input.startsWith("/")) {
        const [cmdName, ...rest] = input.slice(1).split(/\s+/);
        const cmd = slashCommands.find((c) => c.name === cmdName);
        if (cmd) {
          const shouldContinue = await cmd.handler(
            rest.join(" "),
            state,
            rl,
          );
          if (!shouldContinue) {
            console.log(chalk.dim("\n  お先に失礼します。\n"));
            rl.close();
            return;
          }
        } else {
          printInfo(`Unknown command: /${cmdName}. Type /help.`);
        }
        return;
      }

      // Natural language input
      await runTurn(input, state);
    };

    rl.on("line", (line) => {
      rl.pause();
      handleLine(line)
        .catch((err) => {
          printError(err instanceof Error ? err.message : String(err));
        })
        .finally(() => {
          rl.resume();
          rl.prompt();
        });
    });

    rl.prompt();
  });
}

// ── Single turn execution ───────────────────────────────

async function runTurn(
  input: string,
  state: ReplState,
  forceTask?: string,
): Promise<void> {
  const brief = forceTask
    ? {
        ...classifyBrief(input, state.lastBrief),
        task: forceTask as SessionBrief["task"],
      }
    : classifyBrief(input, state.lastBrief);

  try {
    const result = await execute({
      brief,
      userRequest: input,
      sessionId: state.sessionId,
      claudeSessionId: state.claudeSessionId,
      suppressOutput: true,
      mizuyaResult:
        state.lastMizuyaResponse && briefUnchanged(brief, state.lastBrief)
          ? state.lastMizuyaResponse
          : undefined,
      mizuyaFailure: state.circuitOpen
        ? new Error("Circuit breaker open — mizuya skipped")
        : undefined,
    });

    // Render output with markdown
    printResponse(result.output);

    // Update state
    state.lastBrief = brief;
    state.lastMizuyaResponse = result.mizuya;
    if (result.claudeSessionId) {
      state.claudeSessionId = result.claudeSessionId;
    }

    // Circuit breaker
    const cb = updateCircuitBreaker(
      {
        consecutiveFailures: state.consecutiveFailures,
        open: state.circuitOpen,
      },
      result.degraded,
      result.degradedReason,
    );
    state.consecutiveFailures = cb.consecutiveFailures;
    state.circuitOpen = cb.open;
  } catch (error) {
    if (error instanceof ProviderError) {
      printError(`[${error.provider}:${error.code}] ${error.message}`);
      if (error.provider === "codex") {
        state.consecutiveFailures++;
        if (state.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          state.circuitOpen = true;
          printInfo(
            "Circuit breaker opened — mizuya will be skipped.",
          );
        }
      }
    } else {
      printError(error instanceof Error ? error.message : String(error));
    }
  }
}

function briefUnchanged(
  current: SessionBrief,
  previous?: SessionBrief,
): boolean {
  if (!previous) return false;
  return current.task === previous.task && current.target === previous.target;
}

// ── Circuit breaker (exported for testing) ──────────────

export interface CircuitBreakerState {
  consecutiveFailures: number;
  open: boolean;
}

export function updateCircuitBreaker(
  state: CircuitBreakerState,
  degraded: boolean,
  degradedReason: string | undefined,
  maxFailures: number = MAX_CONSECUTIVE_FAILURES,
): CircuitBreakerState {
  if (degraded && degradedReason?.startsWith("codex:")) {
    const failures = state.consecutiveFailures + 1;
    return {
      consecutiveFailures: failures,
      open: failures >= maxFailures,
    };
  }
  return { consecutiveFailures: 0, open: false };
}
