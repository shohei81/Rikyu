/**
 * 取り合わせ (Toriawase) — utensil coordination.
 *
 * In Urasenke, the host selects utensils that complement
 * the season, occasion, and guests. Toriawase is the art
 * of choosing the right combination.
 *
 * Here, toriawase resolves the ceremony mode and determines
 * which agents should participate for a given task.
 */

import type { ChajiMode, SessionBrief } from "../chaji/types.js";

/** Maximum mizuya turns based on ceremony depth */
export function maxMizuyaTurns(mode: ChajiMode | undefined): number {
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

/** Resolve the collaboration mode from config, CLI flag, and brief */
export function resolveMode(options: {
  brief: SessionBrief;
  configMode?: string;
  cliMode?: ChajiMode;
}): ChajiMode {
  if (options.cliMode) return options.cliMode;

  if (options.configMode && options.configMode !== "auto") {
    return options.configMode as ChajiMode;
  }

  switch (options.brief.task) {
    case "ask":
    case "explain":
      return "quick";
    case "review":
    case "debug":
      return "standard";
    case "fix":
      return "deep";
    default:
      return "standard";
  }
}

/** Whether a task benefits from mizuya preparation */
export function shouldUseMizuya(task: SessionBrief["task"]): boolean {
  return task !== "fix";
}
