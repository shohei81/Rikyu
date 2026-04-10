import type { CollaborationResult } from "../collaboration/flow.js";
import type { SessionBrief } from "../session/brief.js";
import { redactJsonValue } from "./redaction.js";

export interface RikyuJsonOutput {
  sessionId: string;
  requestId: string;
  task: SessionBrief["task"];
  output: string;
  mizuyaResponse: CollaborationResult["mizuyaResponse"] | null;
  degraded: boolean;
  unavailableProviders: string[];
  metadata: {
    totalMs: number;
    mode?: SessionBrief["mode"];
    degradedReason?: string;
  };
}

export interface RenderJsonOutputOptions {
  sessionId?: string;
  brief: SessionBrief;
  totalMs: number;
}

export function renderJsonOutput(
  result: CollaborationResult,
  options: RenderJsonOutputOptions,
): string {
  const output: RikyuJsonOutput = {
    sessionId: options.sessionId ?? "standalone",
    requestId: result.requestId,
    task: options.brief.task,
    output: result.output,
    mizuyaResponse: result.mizuyaResponse ?? null,
    degraded: result.degraded,
    unavailableProviders: result.degradedReason ? [result.degradedReason.split(":", 1)[0] ?? "unknown"] : [],
    metadata: {
      totalMs: options.totalMs,
      ...(options.brief.mode ? { mode: options.brief.mode } : {}),
      ...(result.degradedReason ? { degradedReason: result.degradedReason } : {}),
    },
  };

  return `${JSON.stringify(redactJsonValue(output), null, 2)}\n`;
}

export function writeJsonOutput(
  result: CollaborationResult,
  options: RenderJsonOutputOptions,
  writer: (text: string) => void = (text) => process.stdout.write(text),
): void {
  writer(renderJsonOutput(result, options));
}
