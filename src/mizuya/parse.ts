import { ProviderError } from "../providers/types.js";
import { mizuyaResponseSchema, type MizuyaResponse } from "./schema.js";

export function parseMizuyaResponse(raw: string): MizuyaResponse {
  const jsonText = extractJsonObject(raw);
  if (!jsonText) {
    throw new ProviderError("codex", "PARSE_ERROR", "Could not find MizuyaResponse JSON", {
      stdout: raw,
    });
  }

  try {
    return mizuyaResponseSchema.parse(JSON.parse(jsonText));
  } catch (cause) {
    throw new ProviderError("codex", "PARSE_ERROR", "Invalid MizuyaResponse JSON", {
      stdout: raw,
      cause,
    });
  }
}

export function extractJsonObject(raw: string): string | undefined {
  const start = raw.indexOf("{");
  if (start === -1) return undefined;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < raw.length; i += 1) {
    const char = raw[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;

    if (depth === 0) {
      return raw.slice(start, i + 1);
    }
  }

  return undefined;
}
