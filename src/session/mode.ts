import type { ConfigMode } from "../config/schema.js";
import type { CollaborationMode, SessionBrief } from "./brief.js";

export interface ResolveCollaborationModeInput {
  brief: SessionBrief;
  configMode: ConfigMode;
  cliMode?: CollaborationMode;
}

export interface ModeFlagOptions {
  quick?: boolean;
  deep?: boolean;
}

export function resolveCollaborationMode(input: ResolveCollaborationModeInput): CollaborationMode {
  if (input.cliMode) return input.cliMode;
  if (input.configMode !== "auto") return input.configMode;
  return autoSelectCollaborationMode(input.brief);
}

export function autoSelectCollaborationMode(brief: SessionBrief): CollaborationMode {
  if (brief.mode) return brief.mode;
  if (brief.urgency === "high") return "deep";
  if (brief.desiredOutcome === "apply" || brief.desiredOutcome === "patch-proposal") return "deep";
  if (brief.task === "ask" || brief.task === "explain") return "quick";
  if (brief.task === "fix" && brief.desiredOutcome === "fix-plan") return "standard";
  if (brief.task === "review" || brief.task === "debug") return "standard";
  return "standard";
}

export function modeFromFlags(options: ModeFlagOptions | undefined): CollaborationMode | undefined {
  if (options?.deep) return "deep";
  if (options?.quick) return "quick";
  return undefined;
}
