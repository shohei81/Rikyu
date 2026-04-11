/**
 * 亭主 (Teishu) agent — the host.
 *
 * In Urasenke tea ceremony, the teishu is the central figure:
 * they plan the gathering, select utensils (取り合わせ toriawase),
 * perform the temae (点前), and synthesize everything into
 * a meaningful experience for the guests.
 *
 * Here, teishu wraps Claude CLI to synthesize mizuya findings
 * with independent judgment, guided by 和敬清寂 constraints.
 */

import type { Agent, AgentResult, AgentRunOptions } from "../agent/types.js";
import { runSubprocess, estimateTokens } from "../agent/subprocess.js";
import type { TeishuResponse } from "./schema.js";
import { TeishuResponseSchema } from "./schema.js";
import { formatConstraints } from "./constraints.js";
import type { MizuyaResponse } from "../mizuya/schema.js";
import type { SessionBrief } from "../chaji/types.js";

// ── Temae (点前) — prompt construction ──────────────────

export interface TeishuTemaeInput {
  userRequest: string;
  brief: SessionBrief;
  mizuyaResponse?: MizuyaResponse;
  mizuyaSkipped?: boolean;
  followUpQuestion?: string;
}

const taskHints: Record<string, string> = {
  review: "Synthesize the analysis into a clear, actionable code review.",
  debug: "Identify the most likely root cause and suggest concrete debugging steps.",
  ask: "Provide a direct, helpful answer.",
  explain: "Explain clearly, adjusting depth to the question.",
  fix: "Propose a concrete fix plan with rationale.",
};

export function buildTeishuPrompt(input: TeishuTemaeInput): string {
  const sections: string[] = [
    `# Teishu Synthesis`,
    ``,
    `## Role`,
    `You are teishu (亭主), the host of this code analysis session.`,
    `Your role is to synthesize available information and provide`,
    `the user with a clear, actionable response.`,
    ``,
    `## Behavioral Constraints (和敬清寂)`,
    formatConstraints(),
    ``,
    `## Task`,
    taskHints[input.brief.task] ?? taskHints.ask,
  ];

  if (input.mizuyaResponse) {
    sections.push(
      ``,
      `## Mizuya Preparation (raw data — evaluate independently)`,
      `Summary: ${input.mizuyaResponse.summary}`,
      `Findings: ${JSON.stringify(input.mizuyaResponse.findings, null, 2)}`,
      `Doubts: ${JSON.stringify(input.mizuyaResponse.doubts)}`,
    );
  } else if (!input.mizuyaSkipped) {
    sections.push(
      ``,
      `## Note`,
      `Mizuya preparation was unavailable. Provide your analysis independently.`,
    );
  }

  if (input.followUpQuestion) {
    sections.push(``, `## Follow-up Context`, input.followUpQuestion);
  }

  sections.push(
    ``,
    `## User Request`,
    input.userRequest,
    ``,
    `## Output Format`,
    `Respond with a single JSON object:`,
    `{`,
    `  "output": "your response text",`,
    `  "needsMoreFromMizuya": false,`,
    `  "followUpQuestion": null`,
    `}`,
    `Set needsMoreFromMizuya to true with followUpQuestion only if`,
    `you genuinely need more code analysis to answer properly.`,
  );

  return sections.join("\n");
}

// ── Response parsing ────────────────────────────────────

export function parseTeishuOutput(stdout: string): TeishuResponse {
  // Try Claude JSON envelope: { result: string, session_id?: string }
  try {
    const envelope = JSON.parse(stdout) as Record<string, unknown>;
    if (typeof envelope.result === "string") {
      const inner = parseTeishuJson(envelope.result);
      return {
        ...inner,
        sessionId: (envelope.session_id as string) ?? inner.sessionId,
      };
    }
  } catch {
    /* not an envelope — fall through */
  }

  return parseTeishuJson(stdout);
}

function parseTeishuJson(text: string): TeishuResponse {
  // Strip markdown code fences (```json ... ```)
  const stripped = text.replace(/^```(?:json)?\s*\n?/m, "").replace(/\n?```\s*$/m, "");

  const start = stripped.indexOf("{");
  if (start === -1) {
    // Plain text — wrap as response
    return wrapPlainText(stripped);
  }

  // Try to extract a JSON object with depth tracking
  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < stripped.length; i++) {
    const ch = stripped[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === "\\") {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === "{") depth++;
    if (ch === "}") depth--;
    if (depth === 0) {
      const json = stripped.slice(start, i + 1);
      try {
        return TeishuResponseSchema.parse(JSON.parse(json));
      } catch {
        // JSON parsed but doesn't match TeishuResponse schema —
        // treat the entire text as plain output
        return wrapPlainText(stripped);
      }
    }
  }

  // No complete JSON object found — use as plain text
  return wrapPlainText(stripped);
}

function wrapPlainText(text: string): TeishuResponse {
  return { output: text.trim(), needsMoreFromMizuya: false };
}

// ── Agent implementation ────────────────────────────────

export class TeishuAgent implements Agent<TeishuResponse> {
  readonly name = "teishu";
  readonly provider = "claude" as const;

  async run(
    prompt: string,
    options?: AgentRunOptions,
  ): Promise<AgentResult<TeishuResponse>> {
    const args = ["-p", "--output-format", "json"];
    if (options?.sessionId) {
      args.push("--resume", options.sessionId);
    }
    args.push(prompt);

    const result = await runSubprocess(
      "claude",
      { command: "claude", args },
      {
        cwd: options?.cwd,
        env: options?.env,
        timeoutMs: options?.timeoutMs,
        stdin: prompt,
        maxTokens: options?.maxTokens ?? 64_000,
      },
    );

    const parsed = parseTeishuOutput(result.stdout);

    return {
      output: parsed.output,
      parsed,
      provider: "claude",
      durationMs: result.durationMs,
      sessionId: parsed.sessionId ?? undefined,
      tokenUsage: {
        input: estimateTokens(prompt),
        output: estimateTokens(result.stdout),
      },
    };
  }
}
