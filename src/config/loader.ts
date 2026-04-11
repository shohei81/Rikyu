/**
 * Configuration loader — merges global → project settings,
 * like how Urasenke practice layers personal style on top of
 * the iemoto's canonical forms.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { RikyuConfigSchema, type RikyuConfig } from "./schema.js";

const GLOBAL_CONFIG_PATH = join(homedir(), ".config", "rikyu", "config.json");
const PROJECT_CONFIG_DIR = ".rikyu";
const PROJECT_CONFIG_FILE = "config.json";

export interface LoadConfigResult {
  config: RikyuConfig;
  sources: string[];
}

export async function loadConfig(options?: {
  cwd?: string;
}): Promise<LoadConfigResult> {
  const sources: string[] = [];
  let merged: Record<string, unknown> = {};

  // Global config (~/.config/rikyu/config.json)
  try {
    const raw = JSON.parse(await readFile(GLOBAL_CONFIG_PATH, "utf8")) as Record<string, unknown>;
    merged = { ...merged, ...raw };
    sources.push(GLOBAL_CONFIG_PATH);
  } catch {
    /* no global config */
  }

  // Project config (.rikyu/config.json)
  const projectPath = join(
    options?.cwd ?? process.cwd(),
    PROJECT_CONFIG_DIR,
    PROJECT_CONFIG_FILE,
  );
  try {
    const raw = JSON.parse(await readFile(projectPath, "utf8")) as Record<string, unknown>;
    merged = { ...merged, ...raw };
    sources.push(projectPath);
  } catch {
    /* no project config */
  }

  return {
    config: RikyuConfigSchema.parse(merged),
    sources,
  };
}

export async function setConfigValue(
  key: string,
  value: string,
  options?: { cwd?: string; global?: boolean },
): Promise<void> {
  const path = options?.global
    ? GLOBAL_CONFIG_PATH
    : join(
        options?.cwd ?? process.cwd(),
        PROJECT_CONFIG_DIR,
        PROJECT_CONFIG_FILE,
      );

  let existing: Record<string, unknown> = {};
  try {
    existing = JSON.parse(await readFile(path, "utf8")) as Record<string, unknown>;
  } catch {
    /* new config */
  }

  existing[key] = parseConfigValue(value);

  // Validate before persisting
  RikyuConfigSchema.parse(existing);

  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(existing, null, 2), "utf8");
}

export async function getConfigValue(
  key: string,
  options?: { cwd?: string },
): Promise<unknown> {
  const { config } = await loadConfig(options);
  return (config as unknown as Record<string, unknown>)[key];
}

function parseConfigValue(value: string): unknown {
  if (value === "true") return true;
  if (value === "false") return false;
  const num = Number(value);
  if (!Number.isNaN(num)) return num;
  return value;
}
