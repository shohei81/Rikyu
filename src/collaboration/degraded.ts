import { ProviderError } from "../providers/types.js";

export interface DegradedInfo {
  degraded: true;
  reason: string;
  stderr: string[];
}

export type DegradedStderrLogger = (line: string) => void;

export function createDegradedInfo(error: unknown): DegradedInfo {
  if (error instanceof ProviderError) {
    return {
      degraded: true,
      reason: `${error.provider}:${error.code}`,
      stderr: collectStderr(error.stderr),
    };
  }

  if (error instanceof Error) {
    return {
      degraded: true,
      reason: error.message,
      stderr: [],
    };
  }

  return {
    degraded: true,
    reason: String(error),
    stderr: [],
  };
}

export function logDegradedStderr(
  info: DegradedInfo,
  logger: DegradedStderrLogger = defaultDegradedStderrLogger,
): void {
  for (const line of info.stderr) {
    logger(line);
  }
}

export function defaultDegradedStderrLogger(line: string): void {
  process.stderr.write(`${line}\n`);
}

function collectStderr(stderr: string): string[] {
  const trimmed = stderr.trim();
  return trimmed ? [trimmed] : [];
}
