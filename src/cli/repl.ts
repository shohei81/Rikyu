import { createInterface, type Interface } from "node:readline/promises";
import { randomUUID } from "node:crypto";
import type { Readable, Writable } from "node:stream";

import { collectStatus } from "../status/checks.js";
import { formatStatusReport } from "../status/format.js";
import type { CollaborationResult } from "../collaboration/flow.js";
import type { MizuyaResponse } from "../mizuya/schema.js";
import {
  classifySessionBrief,
  shouldUseMizuyaForTask,
  type SessionBrief,
} from "../session/brief.js";
import {
  listSessionSnapshots,
  loadSessionSnapshot,
  saveSessionSnapshot,
  type SessionSnapshot,
} from "../session/store.js";
import { executeCollaborationCommand, type CommandHandlerDeps, type CommandIo } from "./common.js";
import { handleAskCommand } from "./ask.js";
import { handleDebugCommand } from "./debug.js";
import { handleFixCommand } from "./fix.js";
import { handleReviewCommand } from "./review.js";
import { parseSlashCommand, slashHelpText, type SlashParseResult } from "./slash.js";

export interface ReplDeps extends CommandHandlerDeps {
  classifySessionBrief?: (utterance: string) => Promise<SessionBrief> | SessionBrief;
  collectStatus?: typeof collectStatus;
  listSessionSnapshots?: typeof listSessionSnapshots;
  loadSessionSnapshot?: typeof loadSessionSnapshot;
  saveSessionSnapshot?: typeof saveSessionSnapshot;
}

export interface ReplState {
  sessionId: string;
  exit: boolean;
  lastBrief?: SessionBrief;
  lastMizuyaResponse?: MizuyaResponse;
}

export interface HandleReplInputOptions {
  line: string;
  state: ReplState;
  deps?: ReplDeps;
}

export interface ReplRunOptions {
  input?: Readable;
  output?: Writable;
  deps?: ReplDeps;
  resume?: boolean | string;
}

export async function runRepl(options: ReplRunOptions = {}): Promise<void> {
  const io = createReplIo(options.output ?? process.stdout);
  const deps = { ...(options.deps ?? {}), io };
  const state: ReplState = {
    sessionId:
      typeof options.resume === "string" ? options.resume : options.deps?.sessionId ?? randomUUID(),
    exit: false,
  };

  if (options.resume) {
    await resumeSession({ state, deps, sessionId: typeof options.resume === "string" ? options.resume : undefined });
  }

  const rl = createInterface({
    input: options.input ?? process.stdin,
    output: options.output ?? process.stdout,
    prompt: "rikyu> ",
  });

  try {
    io.stdout("Rikyu session started. Type /help for commands.\n");
    while (!state.exit) {
      const line = await question(rl, "rikyu> ");
      await handleReplInput({ line, state, deps });
    }
  } finally {
    rl.close();
  }
}

export async function handleReplInput(options: HandleReplInputOptions): Promise<ReplState> {
  const deps = options.deps ?? {};
  const io = deps.io ?? defaultIo;
  const parsed = parseSlashCommand(options.line);

  if (parsed.kind === "empty") return options.state;
  if (parsed.kind === "unknown") {
    io.stderr(`Unknown command: /${parsed.command}\n`);
    return options.state;
  }
  if (parsed.kind === "command") {
    return handleSlashCommand(parsed, options.state, deps);
  }

  const brief = await (deps.classifySessionBrief ?? classifySessionBrief)(parsed.text);
  options.state.lastBrief = brief;

  if (!shouldUseMizuyaForTask(brief.task)) {
    const result = await handleFixCommand({
      prompt: parsed.text,
      deps: withSessionDeps(options.state, deps, { mizuyaResponse: options.state.lastMizuyaResponse }),
    });
    rememberMizuyaResponse(options.state, result);
    return options.state;
  }

  const result = await executeCollaborationCommand({
    userRequest: parsed.text,
    brief,
    deps: withSessionDeps(options.state, deps),
  });
  rememberMizuyaResponse(options.state, result);
  return options.state;
}

export function createReplIo(output: Writable): CommandIo {
  return {
    stdout: (text) => output.write(text),
    stderr: (text) => output.write(text),
  };
}

async function handleSlashCommand(
  parsed: Extract<SlashParseResult, { kind: "command" }>,
  state: ReplState,
  deps: ReplDeps,
): Promise<ReplState> {
  const io = deps.io ?? defaultIo;

  switch (parsed.command) {
    case "help":
      io.stdout(`${slashHelpText()}\n`);
      return state;
    case "exit":
      state.exit = true;
      io.stdout("Bye.\n");
      return state;
    case "review":
      rememberMizuyaResponse(
        state,
        await handleReviewCommand({ prompt: parsed.prompt, deps: withSessionDeps(state, deps) }),
      );
      return state;
    case "ask":
      if (!parsed.prompt) {
        io.stderr("/ask requires a prompt in Phase 0.\n");
        return state;
      }
      rememberMizuyaResponse(
        state,
        await handleAskCommand({ question: parsed.prompt, deps: withSessionDeps(state, deps) }),
      );
      return state;
    case "debug":
      if (!parsed.prompt) {
        io.stderr("/debug requires a prompt.\n");
        return state;
      }
      rememberMizuyaResponse(
        state,
        await handleDebugCommand({ symptom: parsed.prompt, deps: withSessionDeps(state, deps) }),
      );
      return state;
    case "fix":
      rememberMizuyaResponse(
        state,
        await handleFixCommand({
          prompt: parsed.prompt,
          deps: withSessionDeps(state, deps, { mizuyaResponse: state.lastMizuyaResponse }),
        }),
      );
      return state;
    case "sessions":
      await printSessions(deps);
      return state;
    case "resume":
      await resumeSession({ state, deps, sessionId: parsed.prompt });
      return state;
    case "status":
      io.stdout(formatStatusReport(await (deps.collectStatus ?? collectStatus)()));
      return state;
  }
}

async function printSessions(deps: ReplDeps): Promise<void> {
  const io = deps.io ?? defaultIo;
  const sessions = await (deps.listSessionSnapshots ?? listSessionSnapshots)({ cwd: deps.cwd });
  if (sessions.length === 0) {
    io.stdout("No saved sessions.\n");
    return;
  }

  for (const session of sessions) {
    io.stdout(formatSessionLine(session));
  }
}

async function resumeSession(options: {
  state: ReplState;
  deps: ReplDeps;
  sessionId?: string;
}): Promise<void> {
  const io = options.deps.io ?? defaultIo;
  const loader = options.deps.loadSessionSnapshot ?? loadSessionSnapshot;
  const lister = options.deps.listSessionSnapshots ?? listSessionSnapshots;
  const sessionId = options.sessionId ?? (await lister({ cwd: options.deps.cwd }))[0]?.sessionId;

  if (!sessionId) {
    io.stdout("No saved sessions.\n");
    return;
  }

  const snapshot = await loader(sessionId, { cwd: options.deps.cwd });
  options.state.sessionId = snapshot.sessionId;
  options.state.lastBrief = snapshot.brief;
  options.state.lastMizuyaResponse = snapshot.mizuyaResponses.at(-1);
  io.stdout(`Resumed ${snapshot.sessionId} (${snapshot.brief.task}).\n`);
}

function withSessionDeps(
  state: ReplState,
  deps: ReplDeps,
  options: { mizuyaResponse?: MizuyaResponse } = {},
): ReplDeps {
  return {
    ...deps,
    sessionId: state.sessionId,
    ...(options.mizuyaResponse ? { mizuyaResponse: options.mizuyaResponse } : {}),
    saveSessionSnapshot: deps.saveSessionSnapshot ?? saveSessionSnapshot,
  };
}

function rememberMizuyaResponse(state: ReplState, result: CollaborationResult): void {
  if (result.mizuyaResponse) {
    state.lastMizuyaResponse = result.mizuyaResponse;
  }
}

function formatSessionLine(session: SessionSnapshot): string {
  return `${session.sessionId}\t${session.brief.task}\t${session.metadata.updatedAt}\n`;
}

async function question(rl: Interface, prompt: string): Promise<string> {
  try {
    return await rl.question(prompt);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") return "/exit";
    throw error;
  }
}

const defaultIo: CommandIo = {
  stdout: (text) => process.stdout.write(text),
  stderr: (text) => process.stderr.write(text),
};
