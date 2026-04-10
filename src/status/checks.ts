import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { ConfigError, loadRikyuConfig, type LoadConfigOptions } from "../config/loader.js";
import type { RikyuConfig } from "../config/schema.js";

const execFileAsync = promisify(execFile);

export type StatusState = "ok" | "missing" | "failed" | "skipped" | "unknown";

export interface StatusCommandResult {
  stdout: string;
  stderr: string;
}

export type StatusCommandRunner = (
  command: string,
  args: string[],
) => Promise<StatusCommandResult>;

export interface ProviderStatus {
  name: "claude" | "codex";
  executable: string;
  path?: string;
  exists: StatusState;
  version: {
    state: StatusState;
    value?: string;
    message?: string;
  };
  auth: {
    state: StatusState;
    message?: string;
  };
}

export interface ConfigStatus {
  state: "valid" | "invalid";
  config?: RikyuConfig;
  sources: {
    global?: string;
    project?: string;
  };
  message?: string;
}

export interface RikyuStatusReport {
  providers: ProviderStatus[];
  config: ConfigStatus;
}

export interface CollectStatusOptions extends LoadConfigOptions {
  runner?: StatusCommandRunner;
}

interface ProviderSpec {
  name: "claude" | "codex";
  executable: string;
  authArgs: string[];
}

const providerSpecs: ProviderSpec[] = [
  { name: "claude", executable: "claude", authArgs: ["auth", "status"] },
  { name: "codex", executable: "codex", authArgs: ["auth", "status"] },
];

export async function collectStatus(
  options: CollectStatusOptions = {},
): Promise<RikyuStatusReport> {
  const runner = options.runner ?? createStatusCommandRunner();
  const providers = await Promise.all(
    providerSpecs.map((spec) => checkProviderStatus(spec, runner)),
  );

  return {
    providers,
    config: await checkConfigStatus(options),
  };
}

export async function checkProviderStatus(
  spec: ProviderSpec,
  runner: StatusCommandRunner,
): Promise<ProviderStatus> {
  const pathResult = await runStatusStep(() => runner(whichCommand(), [spec.executable]));

  if (!pathResult.ok) {
    return {
      name: spec.name,
      executable: spec.executable,
      exists: "missing",
      version: { state: "skipped", message: "CLI not found" },
      auth: { state: "skipped", message: "CLI not found" },
    };
  }

  const versionResult = await runStatusStep(() => runner(spec.executable, ["--version"]));
  const authResult = await runStatusStep(() => runner(spec.executable, spec.authArgs));

  return {
    name: spec.name,
    executable: spec.executable,
    path: firstLine(pathResult.value.stdout),
    exists: "ok",
    version: versionResult.ok
      ? { state: "ok", value: firstLine(versionResult.value.stdout) }
      : { state: "failed", message: formatCommandError(versionResult.error) },
    auth: formatAuthStatus(authResult),
  };
}

export async function checkConfigStatus(options: LoadConfigOptions = {}): Promise<ConfigStatus> {
  try {
    const loaded = await loadRikyuConfig(options);
    return {
      state: "valid",
      config: loaded.config,
      sources: loaded.sources,
    };
  } catch (cause) {
    if (cause instanceof ConfigError) {
      return {
        state: "invalid",
        sources: {},
        message: `${cause.code}: ${cause.path}`,
      };
    }
    return {
      state: "invalid",
      sources: {},
      message: cause instanceof Error ? cause.message : String(cause),
    };
  }
}

export function createStatusCommandRunner(timeoutMs = 2_000): StatusCommandRunner {
  return async (command, args) => {
    const { stdout, stderr } = await execFileAsync(command, args, { timeout: timeoutMs });
    return {
      stdout: String(stdout),
      stderr: String(stderr),
    };
  };
}

function whichCommand(): string {
  return process.platform === "win32" ? "where" : "which";
}

async function runStatusStep<T>(
  step: () => Promise<T>,
): Promise<{ ok: true; value: T } | { ok: false; error: unknown }> {
  try {
    return { ok: true, value: await step() };
  } catch (error) {
    return { ok: false, error };
  }
}

function formatAuthStatus(
  result:
    | { ok: true; value: StatusCommandResult }
    | {
        ok: false;
        error: unknown;
      },
): ProviderStatus["auth"] {
  if (result.ok) return { state: "ok" };

  const message = formatCommandError(result.error);
  if (isUnsupportedAuthCommand(message)) {
    return { state: "unknown", message: "auth status command is not supported by this CLI" };
  }

  return { state: "failed", message };
}

function formatCommandError(error: unknown): string {
  if (isExecError(error)) {
    const stderr = typeof error.stderr === "string" ? error.stderr.trim() : "";
    const stdout = typeof error.stdout === "string" ? error.stdout.trim() : "";
    return stderr || stdout || error.message;
  }
  return error instanceof Error ? error.message : String(error);
}

function isExecError(error: unknown): error is Error & { stdout?: unknown; stderr?: unknown } {
  return error instanceof Error && ("stdout" in error || "stderr" in error);
}

function isUnsupportedAuthCommand(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("unknown command") ||
    normalized.includes("unrecognized command") ||
    normalized.includes("unrecognized subcommand") ||
    normalized.includes("invalid command")
  );
}

function firstLine(value: string): string {
  return value.trim().split(/\r?\n/, 1)[0] ?? "";
}
