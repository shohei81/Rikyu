import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { z } from "zod";

import { mizuyaResponseSchema, type MizuyaResponse } from "../mizuya/schema.js";
import { sessionBriefSchema, type SessionBrief } from "./brief.js";

export type SessionStoreErrorCode = "NOT_FOUND" | "INVALID_SNAPSHOT";

export class SessionStoreError extends Error {
  readonly code: SessionStoreErrorCode;
  readonly path: string;

  constructor(code: SessionStoreErrorCode, path: string, message: string, cause?: unknown) {
    super(message, { cause });
    this.name = "SessionStoreError";
    this.code = code;
    this.path = path;
  }
}

export const sessionSnapshotSchema = z
  .object({
    sessionId: z.string().min(1),
    claudeSessionId: z.string().min(1).optional(),
    brief: sessionBriefSchema,
    mizuyaResponses: z.array(mizuyaResponseSchema).default([]),
    metadata: z
      .object({
        createdAt: z.string().min(1),
        updatedAt: z.string().min(1),
        cwd: z.string().optional(),
      })
      .catchall(z.unknown()),
  })
  .strict();

export type SessionSnapshot = z.infer<typeof sessionSnapshotSchema>;

export interface SessionSnapshotInput {
  sessionId: string;
  claudeSessionId?: string;
  brief: SessionBrief;
  mizuyaResponses?: MizuyaResponse[];
  metadata?: Record<string, unknown>;
}

export interface SessionStoreOptions {
  cwd?: string;
  sessionsDir?: string;
}

export function getSessionsDir(cwd = process.cwd()): string {
  return join(cwd, ".rikyu", "sessions");
}

export function getSessionPath(sessionId: string, options: SessionStoreOptions = {}): string {
  return join(options.sessionsDir ?? getSessionsDir(options.cwd), `${sessionId}.json`);
}

export async function saveSessionSnapshot(
  input: SessionSnapshotInput,
  options: SessionStoreOptions = {},
): Promise<SessionSnapshot> {
  const path = getSessionPath(input.sessionId, options);
  const now = new Date().toISOString();
  const snapshot = sessionSnapshotSchema.parse({
    ...input,
    mizuyaResponses: input.mizuyaResponses ?? [],
    metadata: {
      createdAt: now,
      updatedAt: now,
      cwd: options.cwd,
      ...(input.metadata ?? {}),
    },
  });

  await mkdir(options.sessionsDir ?? getSessionsDir(options.cwd), { recursive: true });
  await writeFile(path, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  return snapshot;
}

export async function loadSessionSnapshot(
  sessionId: string,
  options: SessionStoreOptions = {},
): Promise<SessionSnapshot> {
  const path = getSessionPath(sessionId, options);
  let text: string;
  try {
    text = await readFile(path, "utf8");
  } catch (cause) {
    if (isNodeError(cause) && cause.code === "ENOENT") {
      throw new SessionStoreError("NOT_FOUND", path, `Session snapshot not found: ${sessionId}`, cause);
    }
    throw cause;
  }

  try {
    return sessionSnapshotSchema.parse(JSON.parse(text));
  } catch (cause) {
    throw new SessionStoreError("INVALID_SNAPSHOT", path, `Invalid session snapshot: ${sessionId}`, cause);
  }
}

export async function listSessionSnapshots(
  options: SessionStoreOptions = {},
): Promise<SessionSnapshot[]> {
  const dir = options.sessionsDir ?? getSessionsDir(options.cwd);
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch (cause) {
    if (isNodeError(cause) && cause.code === "ENOENT") return [];
    throw cause;
  }

  const snapshots = await Promise.all(
    entries
      .filter((entry) => entry.endsWith(".json"))
      .map((entry) => loadSessionSnapshot(entry.slice(0, -".json".length), options)),
  );

  return snapshots.sort((a, b) => b.metadata.updatedAt.localeCompare(a.metadata.updatedAt));
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
