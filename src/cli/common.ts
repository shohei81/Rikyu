import { randomUUID } from "node:crypto";

import type { MizuyaResponse } from "../mizuya/schema.js";
import type { CollaborationMode, SessionBrief } from "../session/brief.js";
import type { RikyuConfig } from "../config/schema.js";
import type {
  CollaborationResult,
  RunCollaborationFlowInput,
} from "../collaboration/flow.js";
import { runCollaborationFlow } from "../collaboration/flow.js";
import { loadRikyuConfig } from "../config/loader.js";
import { writeJsonOutput } from "../output/json.js";
import { redactSecrets } from "../output/redaction.js";
import { writeSarifOutput } from "../output/sarif.js";
import { createProgressReporter, type ProgressReporter } from "../output/streaming.js";
import { writeTextOutput } from "../output/text.js";
import { resolveCollaborationMode } from "../session/mode.js";
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
  setExitCode?: (code: number) => void;
  sessionId?: string;
  mizuyaResponse?: MizuyaResponse;
  saveSessionSnapshot?: typeof saveSessionSnapshot;
}

export interface CommandOutputOptions {
  ci?: boolean;
  json?: boolean;
  quiet?: boolean;
  sarif?: boolean;
  verbose?: boolean;
}

export interface ExecuteCommandOptions {
  userRequest: string;
  brief: SessionBrief;
  context?: RunCollaborationFlowInput["context"];
  config?: RikyuConfig;
  progress?: ProgressReporter;
  useMizuya?: boolean;
  mizuyaResponse?: MizuyaResponse;
  suppressOutput?: boolean;
  cliMode?: CollaborationMode;
  outputOptions?: CommandOutputOptions;
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
  const ciMode = isCiMode(options.outputOptions, deps.env);
  const quietMode = options.outputOptions?.quiet === true;
  const outputConfig = {
    ...applyOutputOptions(config, options.outputOptions),
    ...(ciMode ? { progress: false } : {}),
  };
  const startedAt = Date.now();
  const progress =
    options.progress ??
    (deps.createProgressReporter
    ? deps.createProgressReporter(outputConfig.progress)
      : createProgressReporter({ enabled: outputConfig.progress, writer: io.stderr }));
  const brief = applyConfigMode(options.brief, outputConfig, options.cliMode);

  progress.stage("mizuya");
  const result = await (deps.runFlow ?? runCollaborationFlow)({
    requestId: deps.createRequestId?.() ?? randomUUID(),
    userRequest: options.userRequest,
    brief,
    context: options.context,
    mizuyaResponse: options.mizuyaResponse ?? deps.mizuyaResponse,
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

  if (ciMode) {
    (deps.setExitCode ?? ((code: number) => {
      process.exitCode = code;
    }))(ciExitCode(result));
  }

  if (!options.suppressOutput && !shouldSuppressQuietOutput(result, quietMode)) {
    if (options.outputOptions?.sarif) {
      writeSarifOutput(result, io.stdout);
    } else if (outputConfig.json) {
      writeJsonOutput(result, { brief, sessionId: deps.sessionId, totalMs: Date.now() - startedAt }, io.stdout);
    } else {
      writeTextOutput(result, io.stdout);
    }
  }
  if (outputConfig.verbose && !options.suppressOutput) {
    writeVerboseResult(result, io.stderr, brief);
  }
  progress.stage("done");

  return result;
}

export function applyOutputOptions(config: RikyuConfig, options: CommandOutputOptions | undefined): RikyuConfig {
  return {
    ...config,
    ...(options?.json === undefined ? {} : { json: options.json }),
    ...(options?.verbose === undefined ? {} : { verbose: options.verbose }),
  };
}

export function applyConfigMode(
  brief: SessionBrief,
  config: RikyuConfig,
  cliMode?: CollaborationMode,
): SessionBrief {
  return {
    ...brief,
    mode: resolveCollaborationMode({ brief, configMode: config.mode, cliMode }),
  };
}

function writeVerboseResult(
  result: CollaborationResult,
  stderr: (text: string) => void,
  brief: SessionBrief,
): void {
  stderr(`requestId=${result.requestId}\n`);
  stderr(`mode=${brief.mode ?? "unknown"}\n`);
  stderr(`degraded=${String(result.degraded)}\n`);
  stderr(`mizuyaFindings=${String(result.mizuyaResponse?.findings.length ?? 0)}\n`);
  if (result.degradedReason) stderr(`degradedReason=${redactSecrets(result.degradedReason)}\n`);
}

function isCiMode(options: CommandOutputOptions | undefined, env: NodeJS.ProcessEnv | undefined): boolean {
  return options?.ci === true || (env ?? process.env).CI === "true";
}

function shouldSuppressQuietOutput(result: CollaborationResult, quietMode: boolean): boolean {
  return quietMode && (result.mizuyaResponse?.findings.length ?? 0) === 0;
}

function ciExitCode(result: CollaborationResult): number {
  if (result.degraded) return 1;
  return result.mizuyaResponse?.findings.some((finding) => finding.level === "error" || finding.level === "warning")
    ? 1
    : 0;
}

const defaultIo: CommandIo = {
  stdout: (text) => process.stdout.write(text),
  stderr: (text) => process.stderr.write(text),
};
