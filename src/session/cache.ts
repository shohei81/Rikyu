import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { z } from "zod";

import { mizuyaResponseSchema, type MizuyaResponse } from "../mizuya/schema.js";
import type { SessionTask } from "./types.js";

export interface MizuyaCacheKey {
  task: Extract<SessionTask, "review" | "debug" | "explain">;
  contentHash: string;
  configHash: string;
}

export interface MizuyaCacheRecord {
  key: MizuyaCacheKey;
  response: MizuyaResponse;
  createdAt: string;
  fileHint?: {
    path: string;
    mtimeMs: number;
    size: number;
  };
}

export interface MizuyaCacheOptions {
  cwd?: string;
  cacheDir?: string;
}

const mizuyaCacheRecordSchema: z.ZodType<MizuyaCacheRecord> = z
  .object({
    key: z
      .object({
        task: z.enum(["review", "debug", "explain"]),
        contentHash: z.string().min(1),
        configHash: z.string().min(1),
      })
      .strict(),
    response: mizuyaResponseSchema,
    createdAt: z.string().min(1),
    fileHint: z
      .object({
        path: z.string().min(1),
        mtimeMs: z.number(),
        size: z.number(),
      })
      .strict()
      .optional(),
  })
  .strict();

export function getCacheDir(cwd = process.cwd()): string {
  return join(cwd, ".rikyu", "cache");
}

export function hashString(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function createConfigHash(config: unknown): string {
  return hashString(JSON.stringify(config));
}

export function createMizuyaCacheKey(
  task: MizuyaCacheKey["task"],
  content: string,
  config: unknown,
): MizuyaCacheKey {
  return {
    task,
    contentHash: hashString(content),
    configHash: createConfigHash(config),
  };
}

export async function writeMizuyaCache(
  record: Omit<MizuyaCacheRecord, "createdAt"> & { createdAt?: string },
  options: MizuyaCacheOptions = {},
): Promise<MizuyaCacheRecord> {
  const cacheDir = options.cacheDir ?? getCacheDir(options.cwd);
  const nextRecord = mizuyaCacheRecordSchema.parse({
    ...record,
    createdAt: record.createdAt ?? new Date().toISOString(),
  });

  await mkdir(cacheDir, { recursive: true });
  await writeFile(cachePath(nextRecord.key, cacheDir), `${JSON.stringify(nextRecord, null, 2)}\n`, "utf8");
  return nextRecord;
}

export async function readMizuyaCache(
  key: MizuyaCacheKey,
  options: MizuyaCacheOptions = {},
): Promise<MizuyaCacheRecord | undefined> {
  const cacheDir = options.cacheDir ?? getCacheDir(options.cwd);
  let text: string;
  try {
    text = await readFile(cachePath(key, cacheDir), "utf8");
  } catch (cause) {
    if (isNodeError(cause) && cause.code === "ENOENT") return undefined;
    throw cause;
  }

  const record = mizuyaCacheRecordSchema.parse(JSON.parse(text));
  if (!sameCacheKey(record.key, key)) return undefined;

  if (record.fileHint) {
    try {
      const fileStat = await stat(record.fileHint.path);
      if (fileStat.mtimeMs !== record.fileHint.mtimeMs || fileStat.size !== record.fileHint.size) {
        return undefined;
      }
    } catch (cause) {
      if (isNodeError(cause) && cause.code === "ENOENT") return undefined;
      throw cause;
    }
  }

  return record;
}

export async function createFileHashWithMtimeHint(path: string): Promise<{
  contentHash: string;
  fileHint: NonNullable<MizuyaCacheRecord["fileHint"]>;
}> {
  const [content, fileStat] = await Promise.all([readFile(path, "utf8"), stat(path)]);

  return {
    contentHash: hashString(content),
    fileHint: {
      path,
      mtimeMs: fileStat.mtimeMs,
      size: fileStat.size,
    },
  };
}

function cachePath(key: MizuyaCacheKey, cacheDir: string): string {
  return join(cacheDir, `${key.task}-${key.contentHash}-${key.configHash}.json`);
}

function sameCacheKey(left: MizuyaCacheKey, right: MizuyaCacheKey): boolean {
  return (
    left.task === right.task &&
    left.contentHash === right.contentHash &&
    left.configHash === right.configHash
  );
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
