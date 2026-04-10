import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

import { z } from "zod";

import {
  defaultRikyuConfig,
  parseConfigKey,
  parseConfigValue,
  partialRikyuConfigSchema,
  rikyuConfigSchema,
  type ConfigKey,
  type PartialRikyuConfig,
  type RikyuConfig,
} from "./schema.js";

export type ConfigErrorCode = "INVALID_JSON" | "INVALID_CONFIG" | "WRITE_FAILED";

export class ConfigError extends Error {
  readonly code: ConfigErrorCode;
  readonly path: string;

  constructor(code: ConfigErrorCode, path: string, message: string, cause?: unknown) {
    super(message, { cause });
    this.name = "ConfigError";
    this.code = code;
    this.path = path;
  }
}

export interface LoadConfigOptions {
  cwd?: string;
  globalConfigPath?: string;
  projectConfigPath?: string;
}

export interface LoadedRikyuConfig {
  config: RikyuConfig;
  sources: {
    global?: string;
    project?: string;
  };
}

export function getGlobalConfigPath(): string {
  return join(homedir(), ".config", "rikyu", "config.json");
}

export function getProjectConfigPath(cwd = process.cwd()): string {
  return join(cwd, ".rikyu", "config.json");
}

export async function loadRikyuConfig(
  options: LoadConfigOptions = {},
): Promise<LoadedRikyuConfig> {
  const globalConfigPath = options.globalConfigPath ?? getGlobalConfigPath();
  const projectConfigPath = options.projectConfigPath ?? getProjectConfigPath(options.cwd);
  const globalConfig = await readConfigFile(globalConfigPath);
  const projectConfig = await readConfigFile(projectConfigPath);

  return {
    config: mergeRikyuConfig(globalConfig, projectConfig),
    sources: {
      ...(globalConfig ? { global: globalConfigPath } : {}),
      ...(projectConfig ? { project: projectConfigPath } : {}),
    },
  };
}

export function mergeRikyuConfig(
  globalConfig: PartialRikyuConfig | undefined,
  projectConfig: PartialRikyuConfig | undefined,
): RikyuConfig {
  return rikyuConfigSchema.parse({
    ...defaultRikyuConfig,
    ...(globalConfig ?? {}),
    ...(projectConfig ?? {}),
  });
}

export async function readConfigFile(path: string): Promise<PartialRikyuConfig | undefined> {
  let text: string;
  try {
    text = await readFile(path, "utf8");
  } catch (cause) {
    if (isNodeError(cause) && cause.code === "ENOENT") return undefined;
    throw cause;
  }

  let json: unknown;
  try {
    json = JSON.parse(text) as unknown;
  } catch (cause) {
    throw new ConfigError("INVALID_JSON", path, `Invalid JSON in ${path}`, cause);
  }

  try {
    return partialRikyuConfigSchema.parse(json);
  } catch (cause) {
    if (cause instanceof z.ZodError) {
      throw new ConfigError("INVALID_CONFIG", path, `Invalid Rikyu config in ${path}`, cause);
    }
    throw cause;
  }
}

export async function setConfigValue(
  path: string,
  key: string,
  rawValue: string,
): Promise<PartialRikyuConfig> {
  const parsedKey = parseConfigKey(key);
  const parsedValue = parseConfigValue(parsedKey, rawValue);
  const currentConfig = (await readConfigFile(path)) ?? {};
  const nextConfig = partialRikyuConfigSchema.parse({
    ...currentConfig,
    [parsedKey]: parsedValue,
  });

  try {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, `${JSON.stringify(nextConfig, null, 2)}\n`, "utf8");
  } catch (cause) {
    throw new ConfigError("WRITE_FAILED", path, `Could not write Rikyu config to ${path}`, cause);
  }

  return nextConfig;
}

export function getConfigValue(config: RikyuConfig, key: string): RikyuConfig[ConfigKey] {
  return config[parseConfigKey(key)];
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
