import {
  buildMizuyaPrompt,
  type BuildMizuyaPromptInput,
  type PromptContextBlock,
} from "../mizuya/prompt.js";
import { parseMizuyaResponse } from "../mizuya/parse.js";
import type { MizuyaResponse } from "../mizuya/schema.js";
import { runClaudeCli } from "../providers/claude-cli.js";
import { runCodexCli } from "../providers/codex-cli.js";
import type { ProviderResult } from "../providers/types.js";
import type { SessionBrief } from "../session/types.js";
import { parseTeishuResponse } from "../teishu/parse.js";
import { buildTeishuPrompt } from "../teishu/prompt.js";
import type { TeishuResponse } from "../teishu/schema.js";
import {
  createDegradedInfo,
  defaultDegradedStderrLogger,
  logDegradedStderr,
  type DegradedInfo,
  type DegradedStderrLogger,
} from "./degraded.js";

export type MizuyaRunner = (
  prompt: string,
  input: RunCollaborationFlowInput,
) => Promise<ProviderResult<MizuyaResponse>>;

export type TeishuRunner = (
  prompt: string,
  input: RunCollaborationFlowInput,
) => Promise<ProviderResult<TeishuResponse>>;

export interface RunCollaborationFlowInput {
  requestId: string;
  userRequest: string;
  brief: SessionBrief;
  context?: PromptContextBlock[];
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
  mizuyaRunner?: MizuyaRunner;
  teishuRunner?: TeishuRunner;
  degradedStderrLogger?: DegradedStderrLogger;
}

export interface CollaborationResult {
  requestId: string;
  output: string;
  teishuResponse: TeishuResponse;
  mizuyaResponse?: MizuyaResponse;
  degraded: boolean;
  degradedReason?: string;
  stderr: string[];
}

export async function runCollaborationFlow(
  input: RunCollaborationFlowInput,
): Promise<CollaborationResult> {
  const mizuya = input.mizuyaRunner ?? defaultMizuyaRunner;
  const teishu = input.teishuRunner ?? defaultTeishuRunner;
  let mizuyaResponse: MizuyaResponse | undefined;
  let degradedInfo: DegradedInfo | undefined;

  try {
    const mizuyaPrompt = buildMizuyaPrompt(toMizuyaPromptInput(input));
    const mizuyaResult = await mizuya(mizuyaPrompt, input);
    mizuyaResponse = requireParsedResult("codex", mizuyaResult);
  } catch (error) {
    degradedInfo = createDegradedInfo(error);
    logDegradedStderr(
      degradedInfo,
      input.degradedStderrLogger ?? defaultDegradedStderrLogger,
    );
  }

  const teishuPrompt = buildTeishuPrompt({
    userRequest: input.userRequest,
    brief: input.brief,
    mizuyaResponse,
  });
  const teishuResult = await teishu(teishuPrompt, input);
  const teishuResponse = requireParsedResult("claude", teishuResult);

  return {
    requestId: input.requestId,
    output: teishuResponse.output,
    teishuResponse,
    ...(mizuyaResponse ? { mizuyaResponse } : {}),
    degraded: Boolean(degradedInfo),
    ...(degradedInfo ? { degradedReason: degradedInfo.reason } : {}),
    stderr: degradedInfo?.stderr ?? [],
  };
}

export async function defaultMizuyaRunner(
  prompt: string,
  input: RunCollaborationFlowInput,
): Promise<ProviderResult<MizuyaResponse>> {
  const result = await runCodexCli(["exec", prompt], {
    cwd: input.cwd,
    env: input.env,
    timeoutMs: input.timeoutMs,
  });

  return {
    ...result,
    parsed: parseMizuyaResponse(result.stdout),
  };
}

export async function defaultTeishuRunner(
  prompt: string,
  input: RunCollaborationFlowInput,
): Promise<ProviderResult<TeishuResponse>> {
  const result = await runClaudeCli(["--bare", "-p", "--output-format", "json", prompt], {
    cwd: input.cwd,
    env: input.env,
    timeoutMs: input.timeoutMs,
  });

  return {
    ...result,
    parsed: parseTeishuResponse(result.stdout),
  };
}

function toMizuyaPromptInput(input: RunCollaborationFlowInput): BuildMizuyaPromptInput {
  return {
    requestId: input.requestId,
    userRequest: input.userRequest,
    brief: input.brief,
    context: input.context,
  };
}

function requireParsedResult<T>(provider: string, result: ProviderResult<T>): T {
  if (result.parsed === undefined) {
    throw new Error(`${provider} runner returned no parsed result`);
  }
  return result.parsed;
}
