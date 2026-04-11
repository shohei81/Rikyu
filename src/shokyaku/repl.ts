/**
 * Interactive REPL — the 正客 (shokyaku) in conversation.
 *
 * Like an ongoing tea gathering where the guest and host
 * exchange dialogue, the REPL maintains session state
 * across multiple turns.
 */

import { createInterface, type Interface, type CompleterResult } from "node:readline";
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
import { ProviderError, type ToolPermission } from "../agent/types.js";
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
  toolPermission: ToolPermission;
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
        ["/fix", "Propose a fix (tool use auto-enabled)"],
        ["/permissions", "Set tool permissions (safe/edit/full)"],
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
    name: "permissions",
    description: "Set tool permissions",
    handler: async (args, state) => {
      const arg = args.trim().toLowerCase();
      const levels: Record<string, ToolPermission> = {
        safe: "safe",
        edit: "edit",
        full: "full",
      };
      if (arg in levels) {
        state.toolPermission = levels[arg];
      } else {
        // Interactive selector
        const selected = await selectPermission(state.toolPermission);
        state.toolPermission = selected;
      }
      const labels: Record<ToolPermission, string> = {
        safe: chalk.yellow("safe") + chalk.dim(" — read-only analysis"),
        edit: chalk.blue("edit") + chalk.dim(" — read + edit files"),
        full: chalk.green("full") + chalk.dim(" — read + edit + bash"),
      };
      console.log(`  ${chalk.dim("permissions")} ${labels[state.toolPermission]}`);
      return true;
    },
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
      const permColors: Record<ToolPermission, string> = {
        safe: chalk.yellow("safe"),
        edit: chalk.blue("edit"),
        full: chalk.green("full"),
      };
      console.log(`  ${chalk.dim("perms")}     ${permColors[state.toolPermission]}`);
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

// ── Tab completion ──────────────────────────────────────

const commandNames = slashCommands.map((c) => `/${c.name}`);

function completer(line: string): CompleterResult {
  if (line.startsWith("/")) {
    const hits = commandNames.filter((c) => c.startsWith(line));
    return [hits.length ? hits : commandNames, line];
  }
  return [[], line];
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
    toolPermission: "safe",
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
      completer,
    });

    rl.on("close", () => {
      resolve();
    });

    const handleLine = async (line: string): Promise<void> => {
      const input = line.trim();
      if (!input) return;

      // Bare exit/quit without /
      if (/^(exit|quit|q)$/i.test(input)) {
        console.log(chalk.dim("\n  お先に失礼します。\n"));
        rl.close();
        return;
      }

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
          try {
            rl.resume();
            rl.prompt();
          } catch {
            // readline already closed (e.g. /exit)
          }
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

  const controller = new AbortController();
  const cleanupEsc = listenForEsc(() => {
    controller.abort();
    printInfo("interrupted");
  });

  try {
    const result = await execute({
      brief,
      userRequest: input,
      sessionId: state.sessionId,
      claudeSessionId: state.claudeSessionId,
      suppressOutput: true,
      toolPermission: state.toolPermission !== "safe" ? state.toolPermission : undefined,
      signal: controller.signal,
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
    if (controller.signal.aborted) {
      // ESC — already printed "interrupted", just return
    } else if (error instanceof ProviderError) {
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
  } finally {
    cleanupEsc();
  }
}

function briefUnchanged(
  current: SessionBrief,
  previous?: SessionBrief,
): boolean {
  if (!previous) return false;
  return current.task === previous.task && current.target === previous.target;
}

// ── Interactive permission selector ─────────────────────

const permissionOptions: Array<{
  value: ToolPermission;
  label: string;
  description: string;
}> = [
  { value: "safe", label: "safe", description: "read-only analysis (no tool use)" },
  { value: "edit", label: "edit", description: "read + edit files (Read, Edit, Write, Glob, Grep)" },
  { value: "full", label: "full", description: "read + edit + run commands (+ Bash)" },
];

async function selectPermission(current: ToolPermission): Promise<ToolPermission> {
  const stdin = process.stdin;
  if (!stdin.isTTY || !stdin.setRawMode) return current;

  let index = permissionOptions.findIndex((o) => o.value === current);

  const render = (initial: boolean) => {
    // Move cursor up to overwrite previous render (skip on first draw)
    if (!initial) {
      process.stdout.write(`\x1b[${permissionOptions.length}A`);
    }
    for (let i = 0; i < permissionOptions.length; i++) {
      const o = permissionOptions[i];
      const active = i === index;
      const marker = active ? chalk.green("● ") : chalk.dim("○ ");
      const name = active ? chalk.cyan.bold(o.label) : chalk.dim(o.label);
      // Clear line, write, newline
      process.stdout.write(`\x1b[2K  ${marker}${name.padEnd(16)} ${chalk.dim(o.description)}\n`);
    }
  };

  console.log();
  console.log(chalk.white.bold("  Permissions") + chalk.dim("  ↑↓ select  ⏎ confirm  esc cancel"));
  console.log();
  render(true);

  return new Promise<ToolPermission>((resolve) => {
    stdin.setRawMode(true);
    stdin.resume();

    const cleanup = () => {
      stdin.removeListener("data", onData);
      try { stdin.setRawMode(false); } catch { /* */ }
    };

    const onData = (data: Buffer) => {
      // Arrow keys: ESC [ A/B
      if (data[0] === 0x1b && data[1] === 0x5b) {
        if (data[2] === 0x41) {
          // Up
          index = (index - 1 + permissionOptions.length) % permissionOptions.length;
          render(false);
        } else if (data[2] === 0x42) {
          // Down
          index = (index + 1) % permissionOptions.length;
          render(false);
        }
      } else if (data[0] === 0x0d) {
        // Enter — confirm
        cleanup();
        resolve(permissionOptions[index].value);
      } else if (data[0] === 0x1b && data.length === 1) {
        // ESC — cancel
        cleanup();
        resolve(current);
      }
    };

    stdin.on("data", onData);
  });
}

// ── ESC / Ctrl-C key listener ───────────────────────────
//
// readline holds data listeners on stdin even when paused.
// We temporarily evict them so our raw-mode listener is the
// sole consumer, then restore on cleanup.

function listenForEsc(callback: () => void): () => void {
  const stdin = process.stdin;
  if (!stdin.isTTY || !stdin.setRawMode) return () => {};

  // Evict readline's listeners
  const saved = stdin.rawListeners("data").slice();
  stdin.removeAllListeners("data");

  stdin.setRawMode(true);
  stdin.resume();

  const onData = (data: Buffer) => {
    // ESC (0x1b alone) or Ctrl-C (0x03)
    if ((data.length === 1 && data[0] === 0x1b) || data[0] === 0x03) {
      callback();
    }
  };
  stdin.on("data", onData);

  return () => {
    stdin.removeListener("data", onData);
    try { stdin.setRawMode(false); } catch { /* */ }
    // Restore readline's listeners
    for (const fn of saved) {
      stdin.on("data", fn as (...args: unknown[]) => void);
    }
  };
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
