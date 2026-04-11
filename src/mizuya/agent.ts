/**
 * 水屋 (Mizuya) agent — the preparation room.
 *
 * In Urasenke tea ceremony, the mizuya is where all backstage work happens:
 * washing utensils, organizing supplies, preparing what the host needs.
 * The mizuya is invisible to guests but essential to the ceremony.
 *
 * Here, mizuya wraps Codex CLI to perform code analysis and produce
 * structured findings for the teishu to evaluate.
 */

import type { Agent, AgentResult, AgentRunOptions } from "../agent/types.js";
import { runSubprocess, estimateTokens } from "../agent/subprocess.js";
import type { MizuyaResponse } from "./schema.js";
import { MizuyaResponseSchema } from "./schema.js";
import type { SessionBrief, ContextBlock } from "../chaji/types.js";

// ── Temae (点前) — prompt construction ──────────────────

export interface MizuyaTemaeInput {
  requestId: string;
  userRequest: string;
  brief: SessionBrief;
  context?: ContextBlock[];
}

const taskHints: Record<string, string> = {
  review:
    "Find bugs, regressions, risky patterns, and missing tests. Use findings for code issues only.",
  debug:
    "Structure as symptom → hypotheses → confirmation steps. Treat findings as suspicious locations.",
  ask: "Findings may be empty. Put the answer in summary. Track context used.",
  explain: "Findings may be empty. Put the explanation in summary. Track context used.",
  fix: "Prefer a fix plan. Use findings for blockers and risks only.",
};

export function buildMizuyaPrompt(input: MizuyaTemaeInput): string {
  const sections: string[] = [
    `# Mizuya Analysis Request`,
    `Request ID: ${input.requestId}`,
    `Task: ${input.brief.task}`,
    ``,
    `## Instructions`,
    taskHints[input.brief.task] ?? taskHints.ask,
    ``,
    `## User Request`,
    input.userRequest,
  ];

  if (input.brief.intent) {
    sections.push(``, `## Intent`, input.brief.intent);
  }

  if (input.context && input.context.length > 0) {
    sections.push(``, `## Context`);
    for (const block of input.context) {
      sections.push(``, `### ${block.label}`, "```", block.content, "```");
    }
  }

  sections.push(
    ``,
    `## Output Format`,
    `Respond with a single JSON object:`,
    `{`,
    `  "requestId": "${input.requestId}",`,
    `  "findings": [{ "ruleId": string, "level": "error"|"warning"|"note", "message": string, "location?": { "file": string, "startLine?": number }, "evidence": string[], "inference?": string, "suggestedAction?": string, "confidence": "high"|"medium"|"low" }],`,
    `  "summary": string,`,
    `  "doubts": string[],`,
    `  "contextUsed": string[]`,
    `}`,
  );

  return sections.join("\n");
}

// ── Response parsing ────────────────────────────────────

export function parseMizuyaOutput(stdout: string): MizuyaResponse {
  const json = extractJsonObject(stdout);
  if (!json) {
    throw new Error("No JSON object found in mizuya output");
  }
  return MizuyaResponseSchema.parse(JSON.parse(json));
}

function extractJsonObject(text: string): string | undefined {
  const start = text.indexOf("{");
  if (start === -1) return undefined;

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];
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
    if (depth === 0) return text.slice(start, i + 1);
  }
  return undefined;
}

// ── Agent implementation ────────────────────────────────

export class MizuyaAgent implements Agent<MizuyaResponse> {
  readonly name = "mizuya";
  readonly provider = "codex" as const;

  async run(
    prompt: string,
    options?: AgentRunOptions,
  ): Promise<AgentResult<MizuyaResponse>> {
    const result = await runSubprocess(
      "codex",
      { command: "codex", args: ["exec", prompt] },
      {
        cwd: options?.cwd,
        env: options?.env,
        timeoutMs: options?.timeoutMs,
        stdin: prompt,
        maxTokens: options?.maxTokens ?? 32_000,
      },
    );

    const parsed = parseMizuyaOutput(result.stdout);

    return {
      output: result.stdout,
      parsed,
      provider: "codex",
      durationMs: result.durationMs,
      tokenUsage: {
        input: estimateTokens(prompt),
        output: estimateTokens(result.stdout),
      },
    };
  }
}
