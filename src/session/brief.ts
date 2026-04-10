import { z } from "zod";
import { extractJsonObject } from "../mizuya/parse.js";
import type { SessionBrief } from "./types.js";

export const sessionBriefSchema = z
  .object({
    task: z.enum(["review", "ask", "explain", "debug", "fix"]),
    target: z.enum(["working-tree", "staged", "range", "file", "question", "symptom"]),
    intent: z.string().optional(),
    focus: z.array(z.string()).optional(),
    nonGoals: z.array(z.string()).optional(),
    urgency: z.enum(["low", "normal", "high"]).optional(),
    desiredOutcome: z.enum(["answer", "review", "fix-plan", "patch-proposal", "apply"]).optional(),
    mode: z.enum(["quick", "standard", "deep"]).optional(),
  })
  .strict();

export type {
  CollaborationMode,
  DesiredOutcome,
  SessionBrief,
  SessionTarget,
  SessionTask,
  SessionUrgency,
} from "./types.js";

export function parseSessionBrief(value: unknown): SessionBrief {
  return sessionBriefSchema.parse(value);
}

export function classifySessionBrief(utterance: string): SessionBrief {
  const text = utterance.trim();
  const normalized = text.toLowerCase();

  if (/\b(review|diff|変更|レビュー)\b/.test(normalized)) {
    return { task: "review", target: "working-tree", intent: text, desiredOutcome: "review" };
  }

  if (/\b(debug|bug|error|fail|failing|落ちる|エラー)\b/.test(normalized)) {
    return { task: "debug", target: "symptom", intent: text };
  }

  if (/\b(explain|describe|what is|説明)\b/.test(normalized)) {
    return { task: "explain", target: "question", intent: text, desiredOutcome: "answer" };
  }

  if (/\b(fix|修正|直して)\b/.test(normalized)) {
    return { task: "fix", target: "question", intent: text, desiredOutcome: "fix-plan" };
  }

  return { task: "ask", target: "question", intent: text, desiredOutcome: "answer" };
}

export type SessionBriefClassificationRunner = (prompt: string) => Promise<string>;

export async function classifySessionBriefWithClaude(
  utterance: string,
  runner: SessionBriefClassificationRunner,
): Promise<SessionBrief> {
  const raw = await runner(buildSessionBriefClassificationPrompt(utterance));
  const jsonText = extractJsonObject(raw);
  if (!jsonText) {
    throw new Error("Could not find SessionBrief JSON in classifier output");
  }

  return parseSessionBrief(JSON.parse(jsonText));
}

export function buildSessionBriefClassificationPrompt(utterance: string): string {
  return [
    "Classify the user utterance into a Rikyu SessionBrief.",
    "Return only one JSON object. Do not wrap it in Markdown.",
    "",
    "Schema:",
    '{ "task": "review|ask|explain|debug|fix", "target": "working-tree|staged|range|file|question|symptom", "intent": "string", "desiredOutcome": "answer|review|fix-plan|patch-proposal|apply" }',
    "",
    `<user-utterance>${utterance}</user-utterance>`,
  ].join("\n");
}

export type RoutableTask = SessionBrief["task"] | "conversation";

export function shouldUseMizuyaForTask(task: RoutableTask): boolean {
  return task === "review" || task === "debug" || task === "explain" || task === "ask";
}
