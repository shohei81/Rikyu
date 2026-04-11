/**
 * JSON output formatter.
 */

import type { ChajiResult } from "../hanto/orchestrator.js";
import type { SessionBrief } from "../chaji/types.js";
import { redactJsonValues } from "./redaction.js";

export interface JsonOutputOptions {
  brief: SessionBrief;
  sessionId?: string;
  totalMs?: number;
  classificationMs?: number;
}

export interface RikyuJsonOutput {
  sessionId?: string;
  requestId: string;
  task: string;
  output: string;
  mizuya?: unknown;
  degraded: boolean;
  degradedReason?: string;
  timing: {
    totalMs?: number;
    classificationMs?: number;
    mizuyaMs?: number;
    teishuMs?: number;
  };
}

export function formatJson(
  result: ChajiResult,
  options: JsonOutputOptions,
): string {
  const output: RikyuJsonOutput = {
    ...(options.sessionId ? { sessionId: options.sessionId } : {}),
    requestId: result.id,
    task: options.brief.task,
    output: result.output,
    ...(result.mizuya ? { mizuya: result.mizuya } : {}),
    degraded: result.degraded,
    ...(result.degradedReason ? { degradedReason: result.degradedReason } : {}),
    timing: {
      totalMs: options.totalMs,
      classificationMs: options.classificationMs,
      mizuyaMs: sumPhaseDuration(result, "shoza"),
      teishuMs: sumPhaseDuration(result, "goza"),
    },
  };

  return JSON.stringify(redactJsonValues(output), null, 2) + "\n";
}

function sumPhaseDuration(
  result: ChajiResult,
  prefix: string,
): number | undefined {
  const matching = result.phases.filter((p) => p.name.startsWith(prefix));
  if (matching.length === 0) return undefined;
  return matching.reduce((sum, p) => sum + p.durationMs, 0);
}
