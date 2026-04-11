import type { ChajiResult } from "../hanto/orchestrator.js";
import { redactSecrets } from "./redaction.js";
import { renderMarkdown } from "../shokyaku/render.js";

export function formatText(result: ChajiResult): string {
  const text = redactSecrets(result.output);
  if (process.stdout.isTTY) {
    return renderMarkdown(text);
  }
  return text.endsWith("\n") ? text : text + "\n";
}
