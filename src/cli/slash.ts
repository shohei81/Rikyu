export type SlashCommandName =
  | "help"
  | "exit"
  | "review"
  | "ask"
  | "debug"
  | "fix"
  | "resume"
  | "sessions"
  | "status";

export type SlashParseResult =
  | { kind: "empty" }
  | { kind: "text"; text: string }
  | { kind: "command"; command: SlashCommandName; prompt?: string }
  | { kind: "unknown"; command: string; prompt?: string };

const knownCommands = new Set<SlashCommandName>([
  "help",
  "exit",
  "review",
  "ask",
  "debug",
  "fix",
  "resume",
  "sessions",
  "status",
]);

export function parseSlashCommand(input: string): SlashParseResult {
  const trimmed = input.trim();
  if (!trimmed) return { kind: "empty" };
  if (!trimmed.startsWith("/")) return { kind: "text", text: trimmed };

  const withoutSlash = trimmed.slice(1).trim();
  if (!withoutSlash) return { kind: "unknown", command: "" };

  const [commandText = "", ...rest] = withoutSlash.split(/\s+/);
  const prompt = rest.join(" ").trim() || undefined;
  if (knownCommands.has(commandText as SlashCommandName)) {
    return { kind: "command", command: commandText as SlashCommandName, ...(prompt ? { prompt } : {}) };
  }

  return { kind: "unknown", command: commandText, ...(prompt ? { prompt } : {}) };
}

export function slashHelpText(): string {
  return [
    "Commands:",
    "/help - Show commands",
    "/exit - Exit the session",
    "/review [prompt] - Review current changes",
    "/ask [prompt] - Ask a question",
    "/debug [prompt] - Debug a symptom",
    "/fix [prompt] - Plan a fix (stub in Phase 0)",
    "/resume [sessionId] - Resume a saved session snapshot",
    "/sessions - List saved sessions",
    "/status - Show environment status",
  ].join("\n");
}
