/**
 * 半東 (Hanto) — the assistant host / orchestrator.
 *
 * In Urasenke, the hanto bridges the mizuya (preparation room) and
 * the tea room, managing timing and flow. The hanto must have skill
 * equal to or exceeding the host, understanding the full system
 * to coordinate precisely.
 *
 * Here, Hanto orchestrates a chaji (茶事) through its phases:
 *
 *   初座 (Shoza)     — mizuya preparation
 *   中立 (Nakadachi)  — state transformation (implicit)
 *   後座 (Goza)      — teishu synthesis
 *     濃茶 (Koicha)  — main analysis
 *     薄茶 (Usucha)  — follow-up loops
 *   退席 (Taiseki)   — return result
 */

import type { Agent, AgentRunOptions, PhaseSpan, ProviderName, ToolPermission } from "../agent/types.js";
import { ProviderError } from "../agent/types.js";
import type { MizuyaResponse } from "../mizuya/schema.js";
import type { TeishuResponse } from "../teishu/schema.js";
import { buildMizuyaPrompt } from "../mizuya/agent.js";
import { buildTeishuPrompt } from "../teishu/agent.js";
import type { SessionBrief, ContextBlock, ChajiMode } from "../chaji/types.js";
import { maxMizuyaTurns } from "./toriawase.js";

// ── Types ───────────────────────────────────────────────

export interface ChajiRequest {
  id: string;
  brief: SessionBrief;
  userRequest: string;
  context?: ContextBlock[];
  mode?: ChajiMode;
  claudeSessionId?: string;
  mizuyaResult?: MizuyaResponse;
  mizuyaFailure?: unknown;
  skipMizuya?: boolean;
  /** Tool permission level for teishu */
  toolPermission?: ToolPermission;
}

export interface ChajiResult {
  id: string;
  output: string;
  teishu: TeishuResponse;
  mizuya?: MizuyaResponse;
  claudeSessionId?: string;
  degraded: boolean;
  degradedReason?: string;
  phases: PhaseSpan[];
}

export interface HantoCallbacks {
  onPhase?: (phase: string) => void;
  onDegraded?: (reason: string, stderr: string[]) => void;
}

// ── Hanto ───────────────────────────────────────────────

export class Hanto {
  constructor(
    private readonly mizuya: Agent<MizuyaResponse>,
    private readonly teishu: Agent<TeishuResponse>,
  ) {}

  async conduct(
    request: ChajiRequest,
    runOptions?: AgentRunOptions,
    callbacks?: HantoCallbacks,
  ): Promise<ChajiResult> {
    const t0 = Date.now();
    const phases: PhaseSpan[] = [];
    let mizuyaResponse: MizuyaResponse | undefined = request.mizuyaResult;
    let degradedReason: string | undefined;
    let mizuyaTurns = mizuyaResponse ? 1 : 0;

    // ── 初座 (Shoza) — Mizuya preparation ─────────────
    if (!request.skipMizuya && !mizuyaResponse) {
      callbacks?.onPhase?.("shoza");

      if (request.mizuyaFailure !== undefined) {
        degradedReason = classifyError(request.mizuyaFailure);
        callbacks?.onDegraded?.(degradedReason, extractStderr(request.mizuyaFailure));
      } else {
        const turnStart = Date.now();
        try {
          const prompt = buildMizuyaPrompt({
            requestId: request.id,
            userRequest: request.userRequest,
            brief: request.brief,
            context: request.context,
          });
          const result = await this.mizuya.run(prompt, runOptions);
          mizuyaResponse = requireParsed("codex", result.parsed);
          mizuyaTurns = 1;
          phases.push(
            makeSpan("shoza", t0, turnStart, result.durationMs, "codex", result.tokenUsage),
          );
        } catch (error) {
          degradedReason = classifyError(error);
          callbacks?.onDegraded?.(degradedReason, extractStderr(error));
          phases.push(makeErrorSpan("shoza", t0, turnStart, error));
        }
      }
    }

    // ── 後座 (Goza) — Teishu synthesis (濃茶 koicha) ──
    callbacks?.onPhase?.("goza");

    let teishuResponse = await this.runTeishuTurn(
      request,
      mizuyaResponse,
      undefined,
      t0,
      phases,
      runOptions,
    );

    // ── 薄茶 (Usucha) — Follow-up loops ───────────────
    // Skip follow-ups in tool use mode — teishu handles everything directly
    const maxTurns = maxMizuyaTurns(request.mode ?? request.brief.mode);

    while (
      !(request.toolPermission && request.toolPermission !== "safe") &&
      !request.skipMizuya &&
      !degradedReason &&
      teishuResponse.needsMoreFromMizuya &&
      teishuResponse.followUpQuestion &&
      mizuyaTurns < maxTurns
    ) {
      callbacks?.onPhase?.(`usucha-${mizuyaTurns}`);
      const turnStart = Date.now();
      const followUpId = `${request.id}-followup-${mizuyaTurns}`;

      try {
        const prompt = buildMizuyaPrompt({
          requestId: followUpId,
          userRequest: teishuResponse.followUpQuestion,
          brief: request.brief,
          context: request.context,
        });
        const result = await this.mizuya.run(prompt, runOptions);
        mizuyaResponse = requireParsed("codex", result.parsed);
        mizuyaTurns++;
        phases.push(
          makeSpan(`usucha-mizuya-${mizuyaTurns - 1}`, t0, turnStart, result.durationMs, "codex", result.tokenUsage),
        );
      } catch (error) {
        phases.push(makeErrorSpan(`usucha-mizuya-${mizuyaTurns}`, t0, turnStart, error));
        break;
      }

      teishuResponse = await this.runTeishuTurn(
        request,
        mizuyaResponse,
        teishuResponse.followUpQuestion,
        t0,
        phases,
        runOptions,
      );
    }

    // ── 退席 (Taiseki) — Return ───────────────────────
    callbacks?.onPhase?.("taiseki");

    return {
      id: request.id,
      output: teishuResponse.output,
      teishu: teishuResponse,
      ...(mizuyaResponse ? { mizuya: mizuyaResponse } : {}),
      ...(teishuResponse.sessionId
        ? { claudeSessionId: teishuResponse.sessionId }
        : {}),
      degraded: Boolean(degradedReason),
      ...(degradedReason ? { degradedReason } : {}),
      phases,
    };
  }

  private async runTeishuTurn(
    request: ChajiRequest,
    mizuyaResponse: MizuyaResponse | undefined,
    followUpQuestion: string | undefined,
    t0: number,
    phases: PhaseSpan[],
    runOptions?: AgentRunOptions,
  ): Promise<TeishuResponse> {
    const turnStart = Date.now();
    const spanName = followUpQuestion ? "usucha-teishu" : "goza";
    const prompt = buildTeishuPrompt({
      userRequest: request.userRequest,
      brief: request.brief,
      mizuyaResponse,
      mizuyaSkipped: request.skipMizuya,
      followUpQuestion,
      toolUse: request.toolPermission && request.toolPermission !== "safe",
    });

    try {
      const result = await this.teishu.run(prompt, {
        ...runOptions,
        sessionId: request.claudeSessionId,
        toolPermission: request.toolPermission,
      });
      phases.push(
        makeSpan(spanName, t0, turnStart, result.durationMs, "claude", result.tokenUsage),
      );
      return requireParsed("claude", result.parsed);
    } catch (error) {
      phases.push(makeErrorSpan(spanName, t0, turnStart, error));
      throw error;
    }
  }
}

// ── Helpers ─────────────────────────────────────────────

function requireParsed<T>(provider: string, parsed: T | undefined): T {
  if (parsed === undefined) {
    throw new Error(`${provider} returned no parsed result`);
  }
  return parsed;
}

function classifyError(error: unknown): string {
  if (error instanceof ProviderError) return `${error.provider}:${error.code}`;
  if (error instanceof Error) return error.message;
  return String(error);
}

function extractStderr(error: unknown): string[] {
  if (error instanceof ProviderError && error.stderr) {
    return error.stderr.split("\n").filter(Boolean);
  }
  return [];
}

function makeSpan(
  name: string,
  sessionStart: number,
  turnStart: number,
  durationMs: number,
  provider?: ProviderName,
  tokenUsage?: { input: number; output: number },
): PhaseSpan {
  return {
    name,
    startMs: turnStart - sessionStart,
    durationMs,
    ...(provider ? { provider } : {}),
    ...(tokenUsage ? { tokenUsage } : {}),
  };
}

function makeErrorSpan(
  name: string,
  sessionStart: number,
  turnStart: number,
  error: unknown,
): PhaseSpan {
  return {
    name,
    startMs: turnStart - sessionStart,
    durationMs: Math.max(0, Date.now() - turnStart),
    ...(error instanceof ProviderError ? { provider: error.provider } : {}),
    error: error instanceof Error ? error.message : String(error),
  };
}
