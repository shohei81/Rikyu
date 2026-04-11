/**
 * Session brief classification — reading the guest's intent.
 *
 * Like how the teishu reads the occasion and guests to plan
 * the ceremony, we classify user input into a structured
 * SessionBrief that determines the flow.
 */

import type {
  SessionBrief,
  SessionTask,
  SessionTarget,
  DesiredOutcome,
} from "./types.js";

export function classifyBrief(
  input: string,
  previousBrief?: SessionBrief,
): SessionBrief {
  const trimmed = input.trim();

  // Follow-up detection (continuing a conversation)
  if (previousBrief && isFollowUp(trimmed)) {
    return {
      ...previousBrief,
      intent: trimmed,
      desiredOutcome: resolveFixOutcome(trimmed, previousBrief.desiredOutcome),
    };
  }

  const task = classifyTask(trimmed);
  const target = resolveTarget(trimmed, task);
  const desiredOutcome = resolveOutcome(trimmed, task);

  return { task, target, intent: trimmed, desiredOutcome };
}

// ── Task classification ─────────────────────────────────

const taskPatterns: [RegExp, SessionTask][] = [
  [/(?:\b|(?<=^|[\s。、]))(?:review|レビュー|diff|変更|PR)(?:\b|(?=[\s。、]|$))/i, "review"],
  [/(?:\b|(?<=^|[\s。、]))(?:debug|bug|error|fail|バグ|エラー|落ち|クラッシュ)(?:\b|(?=[\s。、]|$))/i, "debug"],
  [/(?:\b|(?<=^|[\s。、]))(?:explain|describe|what\s+is|説明|解説|とは)(?:\b|(?=[\s。、]|$))/i, "explain"],
  [/(?:\b|(?<=^|[\s。、]))(?:fix|修正|直し|repair|patch)(?:\b|(?=[\s。、]|$))/i, "fix"],
];

function classifyTask(input: string): SessionTask {
  for (const [pattern, task] of taskPatterns) {
    if (pattern.test(input)) return task;
  }
  return "ask";
}

// ── Follow-up detection ─────────────────────────────────

const followUpPatterns = [
  /^(it|that|this|the|those|these)\b/i,
  /^(why|how|what about|and|but|also)\b/i,
  /^(apply|patch|もう少し|詳しく|それ|その|あと)\b/i,
  /^(can you|could you|please)\b/i,
];

function isFollowUp(input: string): boolean {
  return followUpPatterns.some((p) => p.test(input));
}

// ── Target resolution ───────────────────────────────────

function resolveTarget(input: string, task: SessionTask): SessionTarget {
  if (/--staged\b/.test(input)) return "staged";
  if (/\b(file|ファイル)\b/i.test(input)) return "file";

  switch (task) {
    case "review":
    case "fix":
      return "working-tree";
    case "debug":
      return "symptom";
    case "ask":
    case "explain":
    default:
      return "question";
  }
}

// ── Outcome resolution ──────────────────────────────────

function resolveOutcome(
  input: string,
  task: SessionTask,
): DesiredOutcome {
  switch (task) {
    case "review":
      return "review";
    case "fix":
      return resolveFixOutcome(input);
    default:
      return "answer";
  }
}

function resolveFixOutcome(
  input: string,
  fallback?: DesiredOutcome,
): DesiredOutcome {
  if (/\bapply\b/i.test(input)) return "apply";
  if (/\bpatch\b/i.test(input)) return "patch-proposal";
  return fallback ?? "fix-plan";
}
