import { randomUUID } from "node:crypto";

import type { CollaborationMode, SessionBrief } from "../session/brief.js";
import type { RikyuConfig } from "../config/schema.js";
import type {
  CollaborationResult,
  RunCollaborationFlowInput,
} from "../collaboration/flow.js";
import { runCollaborationFlow } from "../collaboration/flow.js";
import { loadRikyuConfig } from "../config/loader.js";
import { createProgressReporter, type ProgressReporter } from "../output/streaming.js";
import { writeTextOutput } from "../output/text.js";
import { saveSessionSnapshot } from "../session/store.js";

export interface CommandIo {
  stdout: (text: string) => void;
  stderr: (text: string) => void;
}

export interface CommandHandlerDeps {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  io?: CommandIo;
  loadConfig?: () => Promise<RikyuConfig>;
  runFlow?: (input: RunCollaborationFlowInput) => Promise<CollaborationResult>;
  createRequestId?: () => string;
  createProgressReporter?: (enabled: boolean) => ProgressReporter;
  sessionId?: string;
  saveSessionSnapshot?: typeof saveSessionSnapshot;
}

export interface ExecuteCommandOptions {
  userRequest: string;
  brief: SessionBrief;
  context?: RunCollaborationFlowInput["context"];
  config?: RikyuConfig;
  progress?: ProgressReporter;
  useMizuya?: boolean;
  deps?: CommandHandlerDeps;
}

export async function executeCollaborationCommand(
  options: ExecuteCommandOptions,
): Promise<CollaborationResult> {
  const deps = options.deps ?? {};
  const io = deps.io ?? defaultIo;
  const config =
    options.config ??
    (deps.loadConfig ? await deps.loadConfig() : (await loadRikyuConfig({ cwd: deps.cwd })).config);
  const progress =
    options.progress ??
    (deps.createProgressReporter
    ? deps.createProgressReporter(config.progress)
      : createProgressReporter({ enabled: config.progress, writer: io.stderr }));
  const brief = applyConfigMode(options.brief, config);

  progress.stage("mizuya");
  const result = await (deps.runFlow ?? runCollaborationFlow)({
    requestId: deps.createRequestId?.() ?? randomUUID(),
    userRequest: options.userRequest,
    brief,
    context: options.context,
    cwd: deps.cwd,
    env: deps.env,
    skipMizuya: options.useMizuya === false,
    degradedStderrLogger: (line) => io.stderr(`${line}\n`),
  });

  if (deps.sessionId) {
    await (deps.saveSessionSnapshot ?? saveSessionSnapshot)(
      {
        sessionId: deps.sessionId,
        brief,
        mizuyaResponses: result.mizuyaResponse ? [result.mizuyaResponse] : [],
        metadata: {
          lastRequestId: result.requestId,
          degraded: result.degraded,
        },
      },
      { cwd: deps.cwd },
    );
  }

  writeTextOutput(result, io.stdout);
  if (config.verbose) {
    writeVerboseResult(result, io.stderr);
  }
  progress.stage("done");

  return result;
}

export function applyConfigMode(brief: SessionBrief, config: RikyuConfig): SessionBrief {
  if (config.mode === "auto") return brief;
  return {
    ...brief,
    mode: config.mode as CollaborationMode,
  };
}

function writeVerboseResult(result: CollaborationResult, stderr: (text: string) => void): void {
  stderr(`requestId=${result.requestId}\n`);
  stderr(`degraded=${String(result.degraded)}\n`);
  if (result.degradedReason) stderr(`degradedReason=${result.degradedReason}\n`);
}

const defaultIo: CommandIo = {
  stdout: (text) => process.stdout.write(text),
  stderr: (text) => process.stderr.write(text),
};
