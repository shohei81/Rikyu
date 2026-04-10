import { mkdtemp, rm, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  createFileHashWithMtimeHint,
  createMizuyaCacheKey,
  readMizuyaCache,
  writeMizuyaCache,
} from "../src/session/cache.js";
import type { MizuyaResponse } from "../src/mizuya/schema.js";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "rikyu-session-cache-test-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const response: MizuyaResponse = {
  requestId: "req-1",
  findings: [],
  summary: "Cached response.",
  doubts: [],
  contextUsed: [],
};

describe("mizuya cache", () => {
  it("returns a cache hit for the same key", async () => {
    const key = createMizuyaCacheKey("review", "diff", { mode: "quick" });
    const written = await writeMizuyaCache({ key, response }, { cwd: dir });

    await expect(readMizuyaCache(key, { cwd: dir })).resolves.toEqual(written);
  });

  it("returns undefined for a cache miss", async () => {
    const key = createMizuyaCacheKey("review", "diff", { mode: "quick" });

    await expect(readMizuyaCache(key, { cwd: dir })).resolves.toBeUndefined();
  });

  it("invalidates when the file mtime hint changes", async () => {
    const file = join(dir, "target.ts");
    await writeFile(file, "one\n", "utf8");
    const { contentHash, fileHint } = await createFileHashWithMtimeHint(file);
    const key = {
      task: "review" as const,
      contentHash,
      configHash: createMizuyaCacheKey("review", "diff", { mode: "quick" }).configHash,
    };
    await writeMizuyaCache({ key, response, fileHint }, { cwd: dir });

    await writeFile(file, "two\n", "utf8");

    await expect(readMizuyaCache(key, { cwd: dir })).resolves.toBeUndefined();
  });

  it("invalidates when the hinted file is deleted", async () => {
    const file = join(dir, "target.ts");
    await writeFile(file, "one\n", "utf8");
    const { contentHash, fileHint } = await createFileHashWithMtimeHint(file);
    const key = {
      task: "review" as const,
      contentHash,
      configHash: createMizuyaCacheKey("review", "diff", { mode: "quick" }).configHash,
    };
    await writeMizuyaCache({ key, response, fileHint }, { cwd: dir });

    await unlink(file);

    await expect(readMizuyaCache(key, { cwd: dir })).resolves.toBeUndefined();
  });
});
