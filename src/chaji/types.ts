/**
 * 茶事 (Chaji) session types.
 *
 * Modeled on the Urasenke 正午の茶事 (shogo no chaji) structure.
 * Each type maps to a concept from the tea ceremony.
 */

// ── Task & target ───────────────────────────────────────

export type SessionTask = "review" | "ask" | "explain" | "debug" | "fix";

export type SessionTarget =
  | "working-tree"
  | "staged"
  | "range"
  | "file"
  | "question"
  | "symptom";

export type SessionUrgency = "low" | "normal" | "high";

export type DesiredOutcome =
  | "answer"
  | "review"
  | "fix-plan"
  | "patch-proposal"
  | "apply";

/**
 * ChajiMode — the depth of the ceremony:
 *
 * - quick    (略点前 ryaku-temae)  — abbreviated, 1 mizuya turn
 * - standard (薄茶 usucha)        — standard flow, up to 2 turns
 * - deep     (濃茶 koicha)        — full ceremony, up to 3 turns
 */
export type ChajiMode = "quick" | "standard" | "deep";

// ── Session brief (茶状 chajou — the invitation) ────────

export interface SessionBrief {
  task: SessionTask;
  target: SessionTarget;
  intent?: string;
  focus?: string[];
  nonGoals?: string[];
  urgency?: SessionUrgency;
  desiredOutcome?: DesiredOutcome;
  mode?: ChajiMode;
}

// ── Context block (懐石 kaiseki — courses of information) ─

export interface ContextBlock {
  label: string;
  content: string;
}

// ── Chaji phases ────────────────────────────────────────

/**
 * Phases of a chaji, following the Urasenke 正午の茶事 flow:
 *
 * machiai   (待合)   — gather, initialize, load config
 * shoza     (初座)   — first half: context collection, mizuya preparation
 * nakadachi (中立)   — intermission: transform state for teishu
 * goza      (後座)   — second half: teishu synthesis + follow-up loops
 * taiseki   (退席)   — departure: output, session save, cleanup
 */
export type ChajiPhase =
  | "machiai"
  | "shoza"
  | "nakadachi"
  | "goza"
  | "taiseki";
