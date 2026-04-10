export type SessionTask = "review" | "ask" | "explain" | "debug" | "fix";

export type SessionTarget = "working-tree" | "staged" | "range" | "file" | "question" | "symptom";

export type SessionUrgency = "low" | "normal" | "high";

export type DesiredOutcome = "answer" | "review" | "fix-plan" | "patch-proposal" | "apply";

export type CollaborationMode = "quick" | "standard" | "deep";

export interface SessionBrief {
  task: SessionTask;
  target: SessionTarget;
  intent?: string;
  focus?: string[];
  nonGoals?: string[];
  urgency?: SessionUrgency;
  desiredOutcome?: DesiredOutcome;
  mode?: CollaborationMode;
}
