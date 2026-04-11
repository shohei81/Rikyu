/**
 * Subprocess runner — the engine behind every agent.
 *
 * Like the 水屋 (mizuya) where the actual physical work happens,
 * this module handles the low-level execution of CLI tools.
 */

import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { ProviderError, type ProviderName } from "./types.js";

export interface SubprocessCommand {
  command: string;
  args: string[];
}

export interface SubprocessOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
  stdin?: string;
  maxTokens?: number;
  spawnImpl?: typeof spawn;
  signal?: AbortSignal;
}

export interface SubprocessResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export async function runSubprocess(
  provider: ProviderName,
  command: SubprocessCommand,
  options: SubprocessOptions = {},
): Promise<SubprocessResult> {
  const input = options.stdin ?? command.args.join(" ");
  if (options.maxTokens !== undefined && estimateTokens(input) > options.maxTokens) {
    throw new ProviderError(provider, "TOKEN_OVERFLOW", `${provider} input exceeded token budget`);
  }

  const startedAt = Date.now();
  const spawnFn = options.spawnImpl ?? spawn;
  const child = spawnFn(command.command, command.args, {
    cwd: options.cwd,
    env: options.env,
    stdio: "pipe",
  }) as ChildProcessWithoutNullStreams;

  return new Promise<SubprocessResult>((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    let settled = false;

    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      fn();
    };

    // AbortSignal — ESC key or other cancellation
    if (options.signal) {
      const onAbort = () => {
        child.kill("SIGTERM");
        settle(() =>
          reject(
            new ProviderError(provider, "SIGNAL", `${provider} CLI aborted`, {
              stdout,
              stderr,
              signal: "SIGTERM",
            }),
          ),
        );
      };
      if (options.signal.aborted) {
        onAbort();
      } else {
        options.signal.addEventListener("abort", onAbort, { once: true });
      }
    }

    const timer =
      options.timeoutMs !== undefined
        ? setTimeout(() => {
            child.kill("SIGTERM");
            settle(() =>
              reject(
                new ProviderError(provider, "TIMEOUT", `${provider} CLI timed out`, {
                  stdout,
                  stderr,
                }),
              ),
            );
          }, options.timeoutMs)
        : undefined;

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });

    child.on("error", (cause: NodeJS.ErrnoException) => {
      if (timer) clearTimeout(timer);
      settle(() =>
        reject(
          new ProviderError(
            provider,
            cause.code === "ENOENT" ? "ENOENT" : "EXIT_CODE",
            `${provider} CLI failed to start`,
            { stdout, stderr, cause },
          ),
        ),
      );
    });

    child.on("close", (exitCode, signal) => {
      if (timer) clearTimeout(timer);
      settle(() => {
        const durationMs = Date.now() - startedAt;
        if (signal) {
          reject(
            new ProviderError(provider, "SIGNAL", `${provider} CLI killed by ${signal}`, {
              exitCode: exitCode ?? undefined,
              signal,
              stdout,
              stderr,
            }),
          );
        } else if (exitCode !== 0) {
          reject(
            new ProviderError(provider, "EXIT_CODE", `${provider} CLI exited with ${exitCode}`, {
              exitCode: exitCode ?? undefined,
              stdout,
              stderr,
            }),
          );
        } else {
          resolve({ stdout, stderr, exitCode: 0, durationMs });
        }
      });
    });

    if (options.stdin !== undefined) {
      child.stdin.end(options.stdin);
    } else {
      child.stdin.end();
    }
  });
}
