import type { CollaborationResult } from "../collaboration/flow.js";
import { redactSecrets } from "./redaction.js";

export interface TextOutputInput {
  output: string;
}

export function renderTextOutput(input: TextOutputInput | CollaborationResult): string {
  return ensureTrailingNewline(redactSecrets(input.output));
}

export function writeTextOutput(
  input: TextOutputInput | CollaborationResult,
  writer: (text: string) => void = (text) => process.stdout.write(text),
): void {
  writer(renderTextOutput(input));
}

function ensureTrailingNewline(value: string): string {
  return value.endsWith("\n") ? value : `${value}\n`;
}
