import { ProviderError } from "../providers/types.js";
import { extractJsonObject } from "../mizuya/parse.js";
import { teishuResponseSchema, type TeishuResponse } from "./schema.js";

export function parseTeishuResponse(raw: string): TeishuResponse {
  const jsonText = extractJsonObject(raw);
  if (!jsonText) {
    throw new ProviderError("claude", "PARSE_ERROR", "Could not find TeishuResponse JSON", {
      stdout: raw,
    });
  }

  try {
    const parsed = JSON.parse(jsonText) as unknown;
    const direct = teishuResponseSchema.safeParse(parsed);
    if (direct.success) return direct.data;

    if (isClaudeJsonEnvelope(parsed)) {
      const nestedJsonText = extractJsonObject(parsed.result);
      if (nestedJsonText) {
        return teishuResponseSchema.parse(JSON.parse(nestedJsonText));
      }
    }

    return teishuResponseSchema.parse(parsed);
  } catch (cause) {
    throw new ProviderError("claude", "PARSE_ERROR", "Invalid TeishuResponse JSON", {
      stdout: raw,
      cause,
    });
  }
}

function isClaudeJsonEnvelope(value: unknown): value is { result: string } {
  return typeof value === "object" && value !== null && "result" in value && typeof value.result === "string";
}
