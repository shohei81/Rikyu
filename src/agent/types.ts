/**
 * Core agent abstractions.
 *
 * Every participant in a chaji (茶事) implements the Agent interface.
 * The provider layer wraps CLI tools (Claude, Codex) as subprocess-based agents.
 */

// ── Provider ────────────────────────────────────────────

export type ProviderName = "claude" | "codex";

// ── Agent interface ─────────────────────────────────────

export interface AgentRunOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
  sessionId?: string;
  maxTokens?: number;
}

export interface AgentResult<T = unknown> {
  output: string;
  parsed?: T;
  provider: ProviderName;
  durationMs: number;
  tokenUsage?: { input: number; output: number };
  sessionId?: string;
}

export interface Agent<TResult = unknown> {
  readonly name: string;
  readonly provider: ProviderName;
  run(prompt: string, options?: AgentRunOptions): Promise<AgentResult<TResult>>;
}

// ── Phase spans (observability) ─────────────────────────

export interface PhaseSpan {
  name: string;
  startMs: number;
  durationMs: number;
  provider?: ProviderName;
  tokenUsage?: { input: number; output: number };
  error?: string;
}

// ── Provider errors ─────────────────────────────────────

export type ProviderErrorCode =
  | "ENOENT"
  | "EXIT_CODE"
  | "TIMEOUT"
  | "SIGNAL"
  | "PARSE_ERROR"
  | "TOKEN_OVERFLOW";

export class ProviderError extends Error {
  override readonly name = "ProviderError";
  readonly provider: ProviderName;
  readonly code: ProviderErrorCode;
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode?: number;
  readonly signal?: string;
  override readonly cause?: unknown;

  constructor(
    provider: ProviderName,
    code: ProviderErrorCode,
    message: string,
    details: {
      stdout?: string;
      stderr?: string;
      exitCode?: number;
      signal?: string;
      cause?: unknown;
    } = {},
  ) {
    super(message);
    this.provider = provider;
    this.code = code;
    this.stdout = details.stdout ?? "";
    this.stderr = details.stderr ?? "";
    this.exitCode = details.exitCode;
    this.signal = details.signal;
    this.cause = details.cause;
  }
}
