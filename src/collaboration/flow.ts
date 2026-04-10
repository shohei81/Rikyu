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
import type { CollaborationMode } from "../session/brief.js";
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
  mizuyaResponse?: MizuyaResponse;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
  skipMizuya?: boolean;
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
  let mizuyaResponse: MizuyaResponse | undefined = input.mizuyaResponse;
  let degradedInfo: DegradedInfo | undefined;
  let mizuyaTurns = input.mizuyaResponse ? 1 : 0;

  if (!input.skipMizuya && !mizuyaResponse) {
    try {
      const mizuyaPrompt = buildMizuyaPrompt(toMizuyaPromptInput(input));
      const mizuyaResult = await mizuya(mizuyaPrompt, input);
      mizuyaResponse = requireParsedResult("codex", mizuyaResult);
      mizuyaTurns += 1;
    } catch (error) {
      degradedInfo = createDegradedInfo(error);
      logDegradedStderr(
        degradedInfo,
        input.degradedStderrLogger ?? defaultDegradedStderrLogger,
      );
    }
  }

  let teishuResponse = await runTeishuTurn(teishu, input, mizuyaResponse);

  while (
    !input.skipMizuya &&
    !degradedInfo &&
    teishuResponse.needsMoreFromMizuya &&
    teishuResponse.followUpQuestion &&
    mizuyaTurns < maxMizuyaTurns(input.brief.mode)
  ) {
    const followUpRequestId = `${input.requestId}-followup-${mizuyaTurns}`;
    const mizuyaPrompt = buildMizuyaPrompt({
      ...toMizuyaPromptInput(input),
      requestId: followUpRequestId,
      userRequest: teishuResponse.followUpQuestion,
    });
    const mizuyaResult = await mizuya(mizuyaPrompt, input);
    mizuyaResponse = requireParsedResult("codex", mizuyaResult);
    mizuyaTurns += 1;
    teishuResponse = await runTeishuTurn(
      teishu,
      input,
      mizuyaResponse,
      teishuResponse.followUpQuestion,
    );
  }

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

async function runTeishuTurn(
  teishu: TeishuRunner,
  input: RunCollaborationFlowInput,
  mizuyaResponse: MizuyaResponse | undefined,
  followUpQuestion?: string,
): Promise<TeishuResponse> {
  const teishuPrompt = buildTeishuPrompt({
    userRequest: input.userRequest,
    brief: input.brief,
    mizuyaResponse,
    mizuyaSkipped: input.skipMizuya,
    followUpQuestion,
  });
  const teishuResult = await teishu(teishuPrompt, input);
  return requireParsedResult("claude", teishuResult);
}

function maxMizuyaTurns(mode: CollaborationMode | undefined): number {
  switch (mode) {
    case "quick":
      return 1;
    case "deep":
      return 3;
    case "standard":
    default:
      return 2;
  }
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
  const result = await runClaudeCli(["-p", "--output-format", "json", prompt], {
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
