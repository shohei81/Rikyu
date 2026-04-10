import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  listSessionSnapshots,
  loadSessionSnapshot,
  saveSessionSnapshot,
  SessionStoreError,
} from "../src/session/store.js";
import type { SessionBrief } from "../src/session/brief.js";
import type { MizuyaResponse } from "../src/mizuya/schema.js";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "rikyu-session-store-test-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const brief: SessionBrief = {
  task: "review",
  target: "working-tree",
};

const response: MizuyaResponse = {
  requestId: "req-1",
  findings: [],
  summary: "No findings.",
  doubts: [],
  contextUsed: [],
};

describe("session store", () => {
  it("saves and restores a session snapshot", async () => {
    const saved = await saveSessionSnapshot(
      {
        sessionId: "session-1",
        claudeSessionId: "claude-1",
        brief,
        mizuyaResponses: [response],
        metadata: { note: "round trip" },
      },
      { cwd: dir },
    );

    const loaded = await loadSessionSnapshot("session-1", { cwd: dir });

    expect(loaded).toEqual(saved);
    expect(loaded.metadata.note).toBe("round trip");
  });

  it("lists session snapshots newest first", async () => {
    await saveSessionSnapshot(
      {
        sessionId: "old",
        brief,
        metadata: { createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
      },
      { cwd: dir },
    );
    await saveSessionSnapshot(
      {
        sessionId: "new",
        brief,
        metadata: { createdAt: "2026-01-02T00:00:00.000Z", updatedAt: "2026-01-02T00:00:00.000Z" },
      },
      { cwd: dir },
    );

    const sessions = await listSessionSnapshots({ cwd: dir });

    expect(sessions.map((session) => session.sessionId)).toEqual(["new", "old"]);
  });

  it("returns an empty list when the sessions directory does not exist", async () => {
    await expect(listSessionSnapshots({ cwd: dir })).resolves.toEqual([]);
  });

  it("throws a typed error for a missing session", async () => {
    await expect(loadSessionSnapshot("missing", { cwd: dir })).rejects.toBeInstanceOf(
      SessionStoreError,
    );
    await expect(loadSessionSnapshot("missing", { cwd: dir })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("throws a typed error for a corrupted snapshot", async () => {
    const sessionsDir = join(dir, ".rikyu", "sessions");
    await saveSessionSnapshot({ sessionId: "bad", brief }, { cwd: dir });
    await writeFile(join(sessionsDir, "bad.json"), "{", "utf8");

    await expect(loadSessionSnapshot("bad", { cwd: dir })).rejects.toMatchObject({
      code: "INVALID_SNAPSHOT",
    });
  });
});
