const secretPatterns: RegExp[] = [
  /\b(sk-[A-Za-z0-9_-]{8,})\b/g,
  /\b(xox[baprs]-[A-Za-z0-9-]{8,})\b/g,
  /\b(gh[pousr]_[A-Za-z0-9_]{8,})\b/g,
  /\b([A-Za-z0-9_]*api[_-]?key[A-Za-z0-9_]*\s*[:=]\s*)["']?([^"'\s]+)["']?/gi,
  /\b([A-Za-z0-9_]*token[A-Za-z0-9_]*\s*[:=]\s*)["']?([^"'\s]+)["']?/gi,
];

export function redactSecrets(text: string): string {
  return secretPatterns.reduce((value, pattern) => {
    if (pattern.source.includes("[:=]")) {
      return value.replace(pattern, "$1[REDACTED]");
    }
    return value.replace(pattern, "[REDACTED]");
  }, text);
}

export function redactJsonValue<T>(value: T): T {
  if (typeof value === "string") return redactSecrets(value) as T;
  if (Array.isArray(value)) return value.map((item) => redactJsonValue(item)) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [key, redactJsonValue(nested)]),
    ) as T;
  }
  return value;
}
