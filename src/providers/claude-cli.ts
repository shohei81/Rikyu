import {
  parseProviderJsonResult,
  runProviderCommand,
  type JsonParser,
  type RunProviderCommandOptions,
} from "./subprocess.js";
import type { ProviderResult } from "./types.js";

export interface ClaudeCliOptions extends RunProviderCommandOptions {
  executable?: string;
}

export async function runClaudeCli(
  args: string[],
  options: ClaudeCliOptions = {},
): Promise<ProviderResult> {
  return runProviderCommand(
    "claude",
    {
      command: options.executable ?? "claude",
      args,
    },
    options,
  );
}

export async function runClaudeCliJson<T>(
  args: string[],
  parser?: JsonParser<T>,
  options: ClaudeCliOptions = {},
): Promise<ProviderResult<T>> {
  const result = await runClaudeCli(args, options);
  return parseProviderJsonResult("claude", result, parser);
}
