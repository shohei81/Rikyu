/**
 * Interactive REPL — the 正客 (shokyaku) in conversation.
 *
 * Like an ongoing tea gathering where the guest and host
 * exchange dialogue, the REPL maintains session state
 * across multiple turns.
 */

import { createInterface, type Interface } from "node:readline";
import { randomUUID } from "node:crypto";
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

// ── Slash commands ──────────────────────────────────────

interface SlashCommand {
  name: string;
  description: string;
  handler: (
    args: string,
    state: ReplState,
    rl: Interface,
  ) => Promise<boolean>; // returns true to continue, false to exit
}

const slashCommands: SlashCommand[] = [
  {
    name: "help",
    description: "Show available commands",
    handler: async () => {
      console.log("\nCommands:");
      console.log("  /review [prompt]  — Review code changes");
      console.log("  /ask [prompt]     — Ask a question");
      console.log("  /debug [prompt]   — Debug a symptom");
      console.log("  /explain [prompt] — Explain a concept");
      console.log("  /fix [prompt]     — Propose a fix");
      console.log("  /sessions         — List saved sessions");
      console.log("  /resume [id]      — Resume a session");
      console.log("  /status           — Show status");
      console.log("  /exit             — Exit REPL");
      console.log("  (or just type naturally)\n");
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
        console.log("No saved sessions.");
      } else {
        console.log("\nSaved sessions:");
        for (const s of sessions.slice(0, 10)) {
          console.log(`  ${s.sessionId}  (${s.updatedAt})`);
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
            console.log("No sessions to resume.");
            return true;
          }
          snapshot = await loadSnapshot(sessions[0].sessionId);
        }
        state.sessionId = snapshot.sessionId;
        state.claudeSessionId = snapshot.claudeSessionId;
        state.lastBrief = snapshot.brief as unknown as SessionBrief;
        console.log(`Resumed session ${snapshot.sessionId}\n`);
      } catch (error) {
        console.error(
          `Failed to resume: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      return true;
    },
  },
  {
    name: "status",
    description: "Show status",
    handler: async (_, state) => {
      console.log(`\nSession: ${state.sessionId}`);
      if (state.claudeSessionId) {
        console.log(`Claude session: ${state.claudeSessionId}`);
      }
      if (state.lastBrief) {
        console.log(`Last task: ${state.lastBrief.task}`);
      }
      console.log(
        `Circuit breaker: ${state.circuitOpen ? "OPEN" : "closed"}`,
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
          console.log("No sessions to resume.");
          snapshot = undefined as unknown as SessionSnapshot;
        }
      }
      if (snapshot) {
        state.sessionId = snapshot.sessionId;
        state.claudeSessionId = snapshot.claudeSessionId;
        state.lastBrief = snapshot.brief as unknown as SessionBrief;
        console.log(`Resumed session ${snapshot.sessionId}`);
      }
    } catch (error) {
      console.error(
        `Could not resume: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  console.log("rikyu — 一期一会");
  console.log('Type /help for commands, or just ask.\n');

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "rikyu> ",
  });

  rl.prompt();

  for await (const line of rl) {
    const input = line.trim();
    if (!input) {
      rl.prompt();
      continue;
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
          rl.close();
          return;
        }
      } else {
        console.log(`Unknown command: /${cmdName}. Type /help for help.`);
      }
      rl.prompt();
      continue;
    }

    // Natural language input
    await runTurn(input, state);
    rl.prompt();
  }
}

// ── Single turn execution ───────────────────────────────

async function runTurn(
  input: string,
  state: ReplState,
  forceTask?: string,
): Promise<void> {
  // Classify the brief
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
      mizuyaResult:
        state.lastMizuyaResponse && briefUnchanged(brief, state.lastBrief)
          ? state.lastMizuyaResponse
          : undefined,
      mizuyaFailure: state.circuitOpen
        ? new Error("Circuit breaker open — mizuya skipped")
        : undefined,
    });

    // Update state
    state.lastBrief = brief;
    state.lastMizuyaResponse = result.mizuya;
    if (result.claudeSessionId) {
      state.claudeSessionId = result.claudeSessionId;
    }

    // Circuit breaker
    if (result.degraded && result.degradedReason?.startsWith("codex:")) {
      state.consecutiveFailures++;
      if (state.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        state.circuitOpen = true;
      }
    } else {
      state.consecutiveFailures = 0;
      state.circuitOpen = false;
    }

    console.log();
  } catch (error) {
    if (error instanceof ProviderError) {
      console.error(`\nError [${error.provider}:${error.code}]: ${error.message}\n`);
      if (error.provider === "codex") {
        state.consecutiveFailures++;
        if (state.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          state.circuitOpen = true;
          console.error(
            "Circuit breaker opened — mizuya will be skipped until a successful request.\n",
          );
        }
      }
    } else {
      console.error(
        `\nError: ${error instanceof Error ? error.message : String(error)}\n`,
      );
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
