/**
 * Session store — preserving the memory of each chaji.
 *
 * Like the 御礼 (gorei) — the next-day follow-up after a ceremony —
 * session persistence allows resuming and reflecting on past sessions.
 */

import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import type { SessionBrief } from "./types.js";
import type { MizuyaResponse } from "../mizuya/schema.js";

const SESSIONS_DIR = ".rikyu/sessions";

// ── Snapshot schema ─────────────────────────────────────

export const SessionSnapshotSchema = z.object({
  sessionId: z.string(),
  claudeSessionId: z.string().optional(),
  brief: z.record(z.unknown()),
  mizuyaResponses: z.array(z.record(z.unknown())).default([]),
  metadata: z.object({
    createdAt: z.string(),
    updatedAt: z.string(),
    lastRequestId: z.string().optional(),
    degraded: z.boolean().optional(),
    cwd: z.string().optional(),
  }),
});

export type SessionSnapshot = z.infer<typeof SessionSnapshotSchema>;

export interface SaveSnapshotInput {
  sessionId: string;
  claudeSessionId?: string;
  brief: SessionBrief;
  mizuyaResponses: MizuyaResponse[];
  metadata?: { lastRequestId?: string; degraded?: boolean };
}

// ── Save ────────────────────────────────────────────────

export async function saveSnapshot(
  input: SaveSnapshotInput,
  options?: { cwd?: string },
): Promise<void> {
  const dir = join(options?.cwd ?? process.cwd(), SESSIONS_DIR);
  await mkdir(dir, { recursive: true });
  const file = join(dir, `${input.sessionId}.json`);

  let existing: SessionSnapshot | undefined;
  try {
    existing = SessionSnapshotSchema.parse(
      JSON.parse(await readFile(file, "utf8")),
    );
  } catch {
    /* new session */
  }

  const now = new Date().toISOString();
  const snapshot: SessionSnapshot = {
    sessionId: input.sessionId,
    claudeSessionId: input.claudeSessionId ?? existing?.claudeSessionId,
    brief: input.brief as unknown as Record<string, unknown>,
    mizuyaResponses: mergeMizuyaResponses(
      existing?.mizuyaResponses ?? [],
      input.mizuyaResponses.map(
        (r) => r as unknown as Record<string, unknown>,
      ),
    ),
    metadata: {
      createdAt: existing?.metadata.createdAt ?? now,
      updatedAt: now,
      lastRequestId: input.metadata?.lastRequestId,
      degraded: input.metadata?.degraded,
      cwd: options?.cwd,
    },
  };

  await writeFile(file, JSON.stringify(snapshot, null, 2), "utf8");
}

// ── Load ────────────────────────────────────────────────

export async function loadSnapshot(
  sessionId: string,
  options?: { cwd?: string },
): Promise<SessionSnapshot> {
  const file = join(
    options?.cwd ?? process.cwd(),
    SESSIONS_DIR,
    `${sessionId}.json`,
  );
  try {
    return SessionSnapshotSchema.parse(
      JSON.parse(await readFile(file, "utf8")),
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw Object.assign(new Error(`Session ${sessionId} not found`), {
        code: "NOT_FOUND",
      });
    }
    throw Object.assign(new Error("Invalid session snapshot"), {
      code: "INVALID_SNAPSHOT",
    });
  }
}

// ── List ────────────────────────────────────────────────

export async function listSnapshots(
  options?: { cwd?: string },
): Promise<Array<{ sessionId: string; updatedAt: string }>> {
  const dir = join(options?.cwd ?? process.cwd(), SESSIONS_DIR);
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      process.stderr.write(
        `Warning: could not read sessions directory: ${error instanceof Error ? error.message : String(error)}\n`,
      );
    }
    return [];
  }

  const results: Array<{ sessionId: string; updatedAt: string }> = [];
  for (const entry of entries) {
    if (!entry.endsWith(".json")) continue;
    try {
      const content = JSON.parse(await readFile(join(dir, entry), "utf8"));
      const snapshot = SessionSnapshotSchema.parse(content);
      results.push({
        sessionId: snapshot.sessionId,
        updatedAt: snapshot.metadata.updatedAt,
      });
    } catch {
      /* skip invalid */
    }
  }

  return results.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

// ── Helpers ─────────────────────────────────────────────

function mergeMizuyaResponses(
  existing: Record<string, unknown>[],
  incoming: Record<string, unknown>[],
): Record<string, unknown>[] {
  const byId = new Map<string, Record<string, unknown>>();
  for (const r of existing) byId.set(r.requestId as string, r);
  for (const r of incoming) byId.set(r.requestId as string, r);
  return [...byId.values()];
}
