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
    return teishuResponseSchema.parse(JSON.parse(jsonText));
  } catch (cause) {
    throw new ProviderError("claude", "PARSE_ERROR", "Invalid TeishuResponse JSON", {
      stdout: raw,
      cause,
    });
  }
}
