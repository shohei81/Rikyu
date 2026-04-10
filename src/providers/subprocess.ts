import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";

import {
  ProviderError,
  type ProviderCommand,
  type ProviderName,
  type ProviderResult,
  type ProviderRunOptions,
} from "./types.js";

type SpawnImpl = typeof spawn;

export type JsonParser<T> = (value: unknown) => T;

export interface RunProviderCommandOptions extends ProviderRunOptions {
  spawnImpl?: SpawnImpl;
}

export async function runProviderCommand(
  provider: ProviderName,
  command: ProviderCommand,
  options: RunProviderCommandOptions = {},
): Promise<ProviderResult> {
  const startedAt = Date.now();
  const spawnImpl = options.spawnImpl ?? spawn;
  const child = spawnImpl(command.command, command.args, {
    cwd: options.cwd,
    env: options.env,
    stdio: "pipe",
  }) as ChildProcessWithoutNullStreams;

  return new Promise<ProviderResult>((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    let settled = false;

    const finishReject = (error: ProviderError) => {
      if (settled) return;
      settled = true;
      reject(error);
    };

    const timer =
      options.timeoutMs === undefined
        ? undefined
        : setTimeout(() => {
            child.kill("SIGTERM");
            finishReject(
              new ProviderError(provider, "TIMEOUT", `${provider} CLI timed out`, {
                stdout,
                stderr,
              }),
            );
          }, options.timeoutMs);

    const clearTimer = () => {
      if (timer) clearTimeout(timer);
    };

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });

    child.on("error", (cause: NodeJS.ErrnoException) => {
      clearTimer();
      const code = cause.code === "ENOENT" ? "ENOENT" : "EXIT_CODE";
      finishReject(
        new ProviderError(provider, code, `${provider} CLI failed to start`, {
          stdout,
          stderr,
          cause,
        }),
      );
    });

    child.on("close", (exitCode, signal) => {
      clearTimer();
      if (settled) return;
      settled = true;

      const durationMs = Date.now() - startedAt;
      if (signal) {
        reject(
          new ProviderError(provider, "SIGNAL", `${provider} CLI exited by signal`, {
            exitCode: exitCode ?? undefined,
            signal,
            stdout,
            stderr,
          }),
        );
        return;
      }

      if (exitCode !== 0) {
        reject(
          new ProviderError(provider, "EXIT_CODE", `${provider} CLI exited with ${exitCode}`, {
            exitCode: exitCode ?? undefined,
            signal,
            stdout,
            stderr,
          }),
        );
        return;
      }

      resolve({
        provider,
        stdout,
        stderr,
        exitCode: exitCode ?? 0,
        signal,
        durationMs,
      });
    });

    if (options.stdin !== undefined) {
      child.stdin.end(options.stdin);
    } else {
      child.stdin.end();
    }
  });
}

export function parseProviderJsonResult<T>(
  provider: ProviderName,
  result: ProviderResult,
  parser: JsonParser<T> = (value) => value as T,
): ProviderResult<T> {
  try {
    return {
      ...result,
      parsed: parser(JSON.parse(result.stdout) as unknown),
    };
  } catch (cause) {
    throw new ProviderError(provider, "PARSE_ERROR", `${provider} CLI returned invalid JSON`, {
      stdout: result.stdout,
      stderr: result.stderr,
      cause,
    });
  }
}
