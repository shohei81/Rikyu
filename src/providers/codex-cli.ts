import {
  parseProviderJsonResult,
  runProviderCommand,
  type JsonParser,
  type RunProviderCommandOptions,
} from "./subprocess.js";
import type { ProviderResult } from "./types.js";

export interface CodexCliOptions extends RunProviderCommandOptions {
  executable?: string;
}

export async function runCodexCli(
  args: string[],
  options: CodexCliOptions = {},
): Promise<ProviderResult> {
  return runProviderCommand(
    "codex",
    {
      command: options.executable ?? "codex",
      args,
    },
    options,
  );
}

export async function runCodexCliJson<T>(
  args: string[],
  parser?: JsonParser<T>,
  options: CodexCliOptions = {},
): Promise<ProviderResult<T>> {
  const result = await runCodexCli(args, options);
  return parseProviderJsonResult("codex", result, parser);
}
