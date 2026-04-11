import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  saveSnapshot,
  loadSnapshot,
  listSnapshots,
  type SaveSnapshotInput,
} from "../src/chaji/store.js";
import type { SessionBrief } from "../src/chaji/types.js";
import type { MizuyaResponse } from "../src/mizuya/schema.js";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), "rikyu-store-test-"));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true });
});

function makeBrief(overrides: Partial<SessionBrief> = {}): SessionBrief {
  return {
    task: "review",
    target: "working-tree",
    intent: "review my changes",
    ...overrides,
  };
}

function makeMizuyaResponse(overrides: Partial<MizuyaResponse> = {}): MizuyaResponse {
  return {
    requestId: "req-001",
    findings: [],
    summary: "No issues found.",
    doubts: [],
    contextUsed: ["Working tree diff"],
    ...overrides,
  };
}

function makeInput(overrides: Partial<SaveSnapshotInput> = {}): SaveSnapshotInput {
  return {
    sessionId: "session-abc",
    brief: makeBrief(),
    mizuyaResponses: [makeMizuyaResponse()],
    ...overrides,
  };
}

describe("saveSnapshot / loadSnapshot", () => {
  it("round-trip: save then load preserves all fields", async () => {
    const input = makeInput({
      sessionId: "session-roundtrip",
      claudeSessionId: "claude-123",
      metadata: { lastRequestId: "lr-1", degraded: false },
    });

    await saveSnapshot(input, { cwd: tmpDir });
    const snapshot = await loadSnapshot("session-roundtrip", { cwd: tmpDir });

    expect(snapshot.sessionId).toBe("session-roundtrip");
    expect(snapshot.claudeSessionId).toBe("claude-123");
    expect(snapshot.brief).toMatchObject({
      task: "review",
      target: "working-tree",
    });
    expect(snapshot.mizuyaResponses).toHaveLength(1);
    expect(snapshot.metadata.createdAt).toBeDefined();
    expect(snapshot.metadata.updatedAt).toBeDefined();
    expect(snapshot.metadata.lastRequestId).toBe("lr-1");
    expect(snapshot.metadata.degraded).toBe(false);
  });
});

describe("listSnapshots", () => {
  it("returns sorted by updatedAt descending", async () => {
    // Save two sessions with known ordering
    const input1 = makeInput({ sessionId: "session-older" });
    const input2 = makeInput({ sessionId: "session-newer" });

    await saveSnapshot(input1, { cwd: tmpDir });

    // Small delay to ensure different updatedAt timestamps
    await new Promise((resolve) => setTimeout(resolve, 50));

    await saveSnapshot(input2, { cwd: tmpDir });

    const list = await listSnapshots({ cwd: tmpDir });
    expect(list).toHaveLength(2);
    expect(list[0].sessionId).toBe("session-newer");
    expect(list[1].sessionId).toBe("session-older");
  });

  it("returns empty array when no sessions dir exists", async () => {
    const emptyDir = await mkdtemp(join(tmpdir(), "rikyu-empty-"));
    try {
      const list = await listSnapshots({ cwd: emptyDir });
      expect(list).toEqual([]);
    } finally {
      await rm(emptyDir, { recursive: true });
    }
  });
});

describe("loadSnapshot errors", () => {
  it("throws NOT_FOUND for missing session", async () => {
    await expect(
      loadSnapshot("nonexistent", { cwd: tmpDir }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("throws INVALID_SNAPSHOT for corrupt file", async () => {
    const sessionsDir = join(tmpDir, ".rikyu", "sessions");
    await mkdir(sessionsDir, { recursive: true });
    await writeFile(
      join(sessionsDir, "bad-session.json"),
      "this is not valid json {{{",
      "utf8",
    );

    await expect(
      loadSnapshot("bad-session", { cwd: tmpDir }),
    ).rejects.toMatchObject({ code: "INVALID_SNAPSHOT" });
  });
});

describe("incremental save", () => {
  it("second save merges mizuyaResponses, updates updatedAt, preserves createdAt", async () => {
    const input1 = makeInput({
      sessionId: "session-incr",
      mizuyaResponses: [makeMizuyaResponse({ requestId: "req-001" })],
    });
    await saveSnapshot(input1, { cwd: tmpDir });

    const first = await loadSnapshot("session-incr", { cwd: tmpDir });
    const firstCreatedAt = first.metadata.createdAt;
    const firstUpdatedAt = first.metadata.updatedAt;

    // Wait to ensure timestamp difference
    await new Promise((resolve) => setTimeout(resolve, 50));

    const input2 = makeInput({
      sessionId: "session-incr",
      mizuyaResponses: [makeMizuyaResponse({ requestId: "req-002", summary: "Second pass" })],
    });
    await saveSnapshot(input2, { cwd: tmpDir });

    const second = await loadSnapshot("session-incr", { cwd: tmpDir });

    // createdAt is preserved from first save
    expect(second.metadata.createdAt).toBe(firstCreatedAt);
    // updatedAt changed
    expect(second.metadata.updatedAt).not.toBe(firstUpdatedAt);
    // Both responses are present (merged by requestId)
    expect(second.mizuyaResponses).toHaveLength(2);
    const reqIds = second.mizuyaResponses.map((r) => r.requestId);
    expect(reqIds).toContain("req-001");
    expect(reqIds).toContain("req-002");
  });
});
