/**
 * Secret redaction — 清 (sei, purity).
 *
 * "Redact secrets, tokens, and credentials before including in output."
 */

const SECRET_PATTERNS = [
  /\b(sk-[a-zA-Z0-9]{20,})\b/g,
  /\b(ghp_[a-zA-Z0-9]{36,})\b/g,
  /\b(gho_[a-zA-Z0-9]{36,})\b/g,
  /\b(xoxb-[a-zA-Z0-9-]+)\b/g,
  /\b(xoxp-[a-zA-Z0-9-]+)\b/g,
  /\b(Bearer\s+[a-zA-Z0-9._-]{20,})\b/gi,
];

export function redactSecrets(text: string): string {
  let result = text;
  for (const pattern of SECRET_PATTERNS) {
    result = result.replace(pattern, (match) => {
      const prefix = match.slice(0, 6);
      return `${prefix}${"*".repeat(Math.min(match.length - 6, 20))}`;
    });
  }
  return result;
}

export function redactJsonValues(obj: unknown): unknown {
  if (typeof obj === "string") return redactSecrets(obj);
  if (Array.isArray(obj)) return obj.map(redactJsonValues);
  if (obj !== null && typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      result[key] = redactJsonValues(value);
    }
    return result;
  }
  return obj;
}
