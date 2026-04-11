/**
 * Context collection — preparing kaiseki (懐石).
 *
 * Like the multi-course meal that nourishes guests before
 * the main tea, context blocks feed the agents with
 * the information they need to perform their analysis.
 */

import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import type { ContextBlock, SessionBrief } from "./types.js";

const exec = promisify(execFile);

export type CommandRunner = (
  cmd: string,
  args: string[],
  cwd?: string,
) => Promise<string>;

const defaultRunner: CommandRunner = async (cmd, args, cwd) => {
  const { stdout } = await exec(cmd, args, {
    cwd,
    maxBuffer: 10 * 1024 * 1024,
  });
  return stdout;
};

export interface SessionContext {
  cwd: string;
  gitRoot?: string;
  head?: string;
  blocks: ContextBlock[];
}

export async function collectContext(
  brief: SessionBrief,
  options?: { cwd?: string; target?: string; runner?: CommandRunner },
): Promise<SessionContext> {
  const cwd = options?.cwd ?? process.cwd();
  const run = options?.runner ?? defaultRunner;
  const blocks: ContextBlock[] = [];

  let gitRoot: string | undefined;
  let head: string | undefined;

  try {
    gitRoot = (await run("git", ["rev-parse", "--show-toplevel"], cwd)).trim();
    head = (await run("git", ["rev-parse", "--short", "HEAD"], cwd)).trim();
  } catch {
    // Not a git repo — expected, not an error
  }

  switch (brief.target) {
    case "working-tree": {
      const diff = await safeDiff(run, ["diff", "HEAD"], cwd);
      if (diff) blocks.push({ label: "Working tree diff", content: diff });
      break;
    }
    case "staged": {
      const diff = await safeDiff(run, ["diff", "--staged"], cwd);
      if (diff) blocks.push({ label: "Staged diff", content: diff });
      break;
    }
    case "range": {
      const range = options?.target ?? "HEAD~1..HEAD";
      const diff = await safeDiff(run, ["diff", range], cwd);
      if (diff) blocks.push({ label: `Diff ${range}`, content: diff });
      break;
    }
    case "file": {
      if (options?.target) {
        try {
          const content = await readFile(options.target, "utf8");
          blocks.push({ label: `File: ${options.target}`, content });
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
            process.stderr.write(
              `Warning: could not read ${options.target}: ${error instanceof Error ? error.message : String(error)}\n`,
            );
          }
        }
      }
      break;
    }
  }

  // Recent commits for code-related tasks
  if (gitRoot && (brief.task === "review" || brief.task === "debug")) {
    try {
      const log = await run("git", ["log", "--oneline", "-10"], cwd);
      if (log.trim()) {
        blocks.push({ label: "Recent commits", content: log.trim() });
      }
    } catch {
      /* ignore */
    }
  }

  return { cwd, gitRoot, head, blocks };
}

async function safeDiff(
  run: CommandRunner,
  args: string[],
  cwd: string,
): Promise<string | undefined> {
  try {
    const diff = await run("git", args, cwd);
    return diff.trim() || undefined;
  } catch {
    return undefined;
  }
}
