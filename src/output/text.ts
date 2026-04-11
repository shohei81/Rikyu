import type { ChajiResult } from "../hanto/orchestrator.js";
import { redactSecrets } from "./redaction.js";

export function formatText(result: ChajiResult): string {
  const text = redactSecrets(result.output);
  return text.endsWith("\n") ? text : text + "\n";
}
