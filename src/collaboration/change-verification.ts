import { execFile } from "node:child_process";
import { promisify } from "node:util";

import type { RollbackSnapshot } from "./rollback.js";

const execFileAsync = promisify(execFile);

export interface ChangeVerificationSummary {
  suggestedCommands: string[];
  impact: string[];
  changedFiles: string[];
  beforeDiffSummary?: string;
  afterDiffSummary?: string;
}

export interface ChangeVerificationCommandResult {
  stdout: string;
  stderr: string;
}

export type ChangeVerificationCommandRunner = (
  command: string,
  args: string[],
  options: { cwd: string },
) => Promise<ChangeVerificationCommandResult>;

export interface CollectChangeVerificationOptions {
  cwd?: string;
  beforeSnapshot?: RollbackSnapshot;
  runner?: ChangeVerificationCommandRunner;
}

export async function collectChangeVerification(
  options: CollectChangeVerificationOptions = {},
): Promise<ChangeVerificationSummary> {
  const cwd = options.cwd ?? process.cwd();
  const runner = options.runner ?? defaultChangeVerificationCommandRunner;
  const [afterDiffSummary, changedFilesText] = await Promise.all([
    runOptionalGit(runner, cwd, ["diff", "--stat"]),
    runOptionalGit(runner, cwd, ["diff", "--name-only"]),
  ]);
  const changedFiles = (changedFilesText ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  return {
    suggestedCommands: suggestTestCommands(changedFiles),
    impact: analyzeImpact(changedFiles),
    changedFiles,
    ...(options.beforeSnapshot?.diffSummary
      ? { beforeDiffSummary: options.beforeSnapshot.diffSummary }
      : {}),
    ...(afterDiffSummary ? { afterDiffSummary } : {}),
  };
}

export function formatChangeVerification(summary: ChangeVerificationSummary): string {
  return [
    "Change verification:",
    `- Suggested tests: ${summary.suggestedCommands.join("; ")}`,
    `- Impact: ${summary.impact.join("; ")}`,
    summary.beforeDiffSummary ? `- Before apply diff: ${summary.beforeDiffSummary}` : "",
    summary.afterDiffSummary ? `- After apply diff: ${summary.afterDiffSummary}` : "",
    summary.changedFiles.length > 0 ? `- Changed files: ${summary.changedFiles.join(", ")}` : "",
    "",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function defaultChangeVerificationCommandRunner(
  command: string,
  args: string[],
  options: { cwd: string },
): Promise<ChangeVerificationCommandResult> {
  const { stdout, stderr } = await execFileAsync(command, args, { cwd: options.cwd });
  return {
    stdout: String(stdout),
    stderr: String(stderr),
  };
}

function suggestTestCommands(changedFiles: string[]): string[] {
  if (changedFiles.some((file) => /\.(ts|tsx|js|jsx)$/.test(file))) {
    return ["npm test", "npm run build"];
  }
  if (changedFiles.some((file) => /\.py$/.test(file))) return ["pytest"];
  if (changedFiles.some((file) => /\.rs$/.test(file))) return ["cargo test"];
  return ["Run the affected project's relevant test suite"];
}

function analyzeImpact(changedFiles: string[]): string[] {
  const impact = new Set<string>();
  if (changedFiles.some((file) => /^src\//.test(file))) impact.add("runtime source");
  if (changedFiles.some((file) => /^tests?\//.test(file))) impact.add("test surface");
  if (changedFiles.some((file) => /^docs?\//.test(file))) impact.add("documentation");
  if (changedFiles.some((file) => /(^|\/)package(-lock)?\.json$/.test(file))) {
    impact.add("dependency manifest");
  }
  if (changedFiles.some((file) => /\.(json|ya?ml|toml)$/.test(file))) impact.add("configuration");
  if (impact.size === 0) impact.add("review changed files manually");
  return [...impact];
}

async function runOptionalGit(
  runner: ChangeVerificationCommandRunner,
  cwd: string,
  args: string[],
): Promise<string | undefined> {
  try {
    const result = await runner("git", args, { cwd });
    return result.stdout.trim() || undefined;
  } catch {
    return undefined;
  }
}
