import { z } from "zod";
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
