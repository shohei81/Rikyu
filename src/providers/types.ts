export type ProviderName = "claude" | "codex";

export type ProviderErrorCode =
  | "ENOENT"
  | "EXIT_CODE"
  | "TIMEOUT"
  | "SIGNAL"
  | "PARSE_ERROR";

export interface ProviderResult<T = string> {
  provider: ProviderName;
  stdout: string;
  stderr: string;
  exitCode: number;
  signal: NodeJS.Signals | null;
  durationMs: number;
  parsed?: T;
}

export interface ProviderRunOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
  stdin?: string;
}

export interface ProviderCommand {
  command: string;
  args: string[];
}

export class ProviderError extends Error {
  readonly provider: ProviderName;
  readonly code: ProviderErrorCode;
  readonly exitCode?: number;
  readonly signal?: NodeJS.Signals | null;
  readonly stdout: string;
  readonly stderr: string;

  constructor(
    provider: ProviderName,
    code: ProviderErrorCode,
    message: string,
    details: {
      exitCode?: number;
      signal?: NodeJS.Signals | null;
      stdout?: string;
      stderr?: string;
      cause?: unknown;
    } = {},
  ) {
    super(message, { cause: details.cause });
    this.name = "ProviderError";
    this.provider = provider;
    this.code = code;
    this.exitCode = details.exitCode;
    this.signal = details.signal;
    this.stdout = details.stdout ?? "";
    this.stderr = details.stderr ?? "";
  }
}
