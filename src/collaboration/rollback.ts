import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface RollbackSnapshot {
  id: string;
  cwd: string;
  createdAt: string;
  path?: string;
  head?: string;
  statusShort?: string;
  diffSummary?: string;
  captureError?: string;
}

export interface RollbackCommandResult {
  stdout: string;
  stderr: string;
}

export type RollbackCommandRunner = (
  command: string,
  args: string[],
  options: { cwd: string },
) => Promise<RollbackCommandResult>;

export interface RecordRollbackSnapshotOptions {
  cwd?: string;
  rollbackDir?: string;
  id?: string;
  now?: () => Date;
  runner?: RollbackCommandRunner;
}

export function getRollbackDir(cwd = process.cwd()): string {
  return join(cwd, ".rikyu", "rollback");
}

export async function recordRollbackSnapshot(
  options: RecordRollbackSnapshotOptions = {},
): Promise<RollbackSnapshot> {
  const cwd = options.cwd ?? process.cwd();
  const rollbackDir = options.rollbackDir ?? getRollbackDir(cwd);
  const id = options.id ?? randomUUID();
  const runner = options.runner ?? defaultRollbackCommandRunner;
  const [head, statusShort, diffSummary] = await Promise.all([
    runOptionalGit(runner, cwd, ["rev-parse", "--short", "HEAD"]),
    runOptionalGit(runner, cwd, ["status", "--short"]),
    runOptionalGit(runner, cwd, ["diff", "--stat"]),
  ]);
  const path = join(rollbackDir, `${id}.json`);
  const snapshot: RollbackSnapshot = {
    id,
    cwd,
    createdAt: (options.now ?? (() => new Date()))().toISOString(),
    path,
    ...(head ? { head } : {}),
    ...(statusShort ? { statusShort } : {}),
    ...(diffSummary ? { diffSummary } : {}),
  };

  await mkdir(rollbackDir, { recursive: true });
  await writeFile(path, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  return snapshot;
}

export function formatRollbackGuidance(snapshot: RollbackSnapshot): string {
  return [
    "Apply failed. Rollback guidance:",
    `- Snapshot: ${snapshot.path ?? "not recorded"}${snapshot.captureError ? ` (${snapshot.captureError})` : ""}`,
    "- Inspect current changes: git status --short",
    `- Preserve current changes: git stash push -u -m "rikyu rollback ${snapshot.id}"`,
    "- Discard tracked working-tree changes: git checkout -- .",
    "- Remove untracked files if needed: git clean -fd",
    snapshot.head ? `- Return to recorded HEAD if appropriate: git checkout ${snapshot.head}` : "",
    "",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function defaultRollbackCommandRunner(
  command: string,
  args: string[],
  options: { cwd: string },
): Promise<RollbackCommandResult> {
  const { stdout, stderr } = await execFileAsync(command, args, { cwd: options.cwd });
  return {
    stdout: String(stdout),
    stderr: String(stderr),
  };
}

async function runOptionalGit(
  runner: RollbackCommandRunner,
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
