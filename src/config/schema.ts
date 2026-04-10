import { z } from "zod";

import { policyProfileSchema } from "./policy.js";

export const configModeSchema = z.enum(["auto", "quick", "standard", "deep"]);

export const rikyuConfigSchema = z
  .object({
    mode: configModeSchema.default("auto"),
    verbose: z.boolean().default(false),
    json: z.boolean().default(false),
    progress: z.boolean().default(true),
    policyProfile: policyProfileSchema.default("balanced"),
  })
  .strict();

export const partialRikyuConfigSchema = z
  .object({
    mode: configModeSchema.optional(),
    verbose: z.boolean().optional(),
    json: z.boolean().optional(),
    progress: z.boolean().optional(),
    policyProfile: policyProfileSchema.optional(),
  })
  .strict();

export const configKeySchema = z.enum(["mode", "verbose", "json", "progress", "policyProfile"]);

export const defaultRikyuConfig = rikyuConfigSchema.parse({});

export type ConfigKey = z.infer<typeof configKeySchema>;
export type ConfigMode = z.infer<typeof configModeSchema>;
export type RikyuConfig = z.infer<typeof rikyuConfigSchema>;
export type PartialRikyuConfig = z.infer<typeof partialRikyuConfigSchema>;

export function parseConfigKey(key: string): ConfigKey {
  return configKeySchema.parse(key);
}

export function parseConfigValue(key: ConfigKey, rawValue: string): RikyuConfig[ConfigKey] {
  if (key === "mode") {
    return configModeSchema.parse(rawValue);
  }

  if (key === "policyProfile") {
    return policyProfileSchema.parse(rawValue);
  }

  if (rawValue === "true") return true;
  if (rawValue === "false") return false;

  throw new Error(`Expected "true" or "false" for ${key}`);
}
