import { readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { isAbsolute, join } from "node:path";

import type { PromptContextBlock } from "../mizuya/prompt.js";

const execFileAsync = promisify(execFile);

export interface CommandResult {
  stdout: string;
  stderr: string;
}

export type ContextCommandRunner = (
  command: string,
  args: string[],
  options: { cwd: string },
) => Promise<CommandResult>;

export interface CollectSessionContextOptions {
  cwd?: string;
  target?: "working-tree" | "staged" | "file" | "range";
  path?: string;
  range?: string;
  runner?: ContextCommandRunner;
}

export interface SessionContext {
  cwd: string;
  gitRoot?: string;
  head?: string;
  blocks: PromptContextBlock[];
}

export async function collectSessionContext(
  options: CollectSessionContextOptions = {},
): Promise<SessionContext> {
  const cwd = options.cwd ?? process.cwd();
  const runner = options.runner ?? defaultContextCommandRunner;
  const [gitRoot, head] = await Promise.all([
    runOptionalGit(runner, cwd, ["rev-parse", "--show-toplevel"]),
    runOptionalGit(runner, cwd, ["rev-parse", "--short", "HEAD"]),
  ]);

  const blocks = await collectContextBlocks(options, cwd, runner);

  return {
    cwd,
    ...(gitRoot ? { gitRoot } : {}),
    ...(head ? { head } : {}),
    blocks,
  };
}

export async function defaultContextCommandRunner(
  command: string,
  args: string[],
  options: { cwd: string },
): Promise<CommandResult> {
  const { stdout, stderr } = await execFileAsync(command, args, { cwd: options.cwd });
  return {
    stdout: String(stdout),
    stderr: String(stderr),
  };
}

async function collectContextBlocks(
  options: CollectSessionContextOptions,
  cwd: string,
  runner: ContextCommandRunner,
): Promise<PromptContextBlock[]> {
  if (options.target === "file" && options.path) {
    const filePath = isAbsolute(options.path) ? options.path : join(cwd, options.path);
    return [
      {
        label: `file:${options.path}`,
        content: await readFile(filePath, "utf8"),
      },
    ];
  }

  if (options.target === "range" && options.range) {
    return [
      {
        label: `git-diff:${options.range}`,
        content: await runGit(runner, cwd, ["diff", options.range]),
      },
    ];
  }

  if (options.target === "staged") {
    return [
      {
        label: "git-diff:staged",
        content: await runGit(runner, cwd, ["diff", "--staged"]),
      },
    ];
  }

  return [
    {
      label: "git-diff:working-tree",
      content: await runGit(runner, cwd, ["diff", "HEAD"]),
    },
  ];
}

async function runGit(
  runner: ContextCommandRunner,
  cwd: string,
  args: string[],
): Promise<string> {
  const result = await runner("git", args, { cwd });
  return result.stdout;
}

async function runOptionalGit(
  runner: ContextCommandRunner,
  cwd: string,
  args: string[],
): Promise<string | undefined> {
  try {
    const output = await runGit(runner, cwd, args);
    return output.trim() || undefined;
  } catch {
    return undefined;
  }
}
