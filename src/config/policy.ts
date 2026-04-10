import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { z } from "zod";

import type { MizuyaFinding } from "../mizuya/schema.js";

export const policyProfileSchema = z.enum(["strict", "balanced", "lenient"]);
export type PolicyProfile = z.infer<typeof policyProfileSchema>;

export const policySettingsSchema = z
  .object({
    failOnLevels: z.array(z.enum(["error", "warning", "note"])).default(["error", "warning"]),
  })
  .strict();

export const policyFileSchema = z
  .object({
    defaultProfile: policyProfileSchema.optional(),
    profiles: z.record(policyProfileSchema, policySettingsSchema.partial()).optional(),
  })
  .strict();

export type PolicySettings = z.infer<typeof policySettingsSchema>;
export type PolicyFile = z.infer<typeof policyFileSchema>;

export const builtinPolicyProfiles: Record<PolicyProfile, PolicySettings> = {
  strict: { failOnLevels: ["error", "warning", "note"] },
  balanced: { failOnLevels: ["error", "warning"] },
  lenient: { failOnLevels: ["error"] },
};

export interface LoadPolicyOptions {
  cwd?: string;
  policyPath?: string;
}

export interface ResolvePolicyOptions extends LoadPolicyOptions {
  profile?: PolicyProfile;
}

export function getProjectPolicyPath(cwd = process.cwd()): string {
  return join(cwd, ".rikyu", "policy.json");
}

export async function readPolicyFile(path: string): Promise<PolicyFile | undefined> {
  let text: string;
  try {
    text = await readFile(path, "utf8");
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") return undefined;
    throw error;
  }

  return policyFileSchema.parse(JSON.parse(text));
}

export async function resolvePolicySettings(
  options: ResolvePolicyOptions = {},
): Promise<PolicySettings> {
  const policyPath = options.policyPath ?? getProjectPolicyPath(options.cwd);
  const policyFile = await readPolicyFile(policyPath);
  const profile = options.profile ?? policyFile?.defaultProfile ?? "balanced";
  return policySettingsSchema.parse({
    ...builtinPolicyProfiles[profile],
    ...(policyFile?.profiles?.[profile] ?? {}),
  });
}

export function shouldFailForFindings(
  findings: MizuyaFinding[],
  policy: PolicySettings,
): boolean {
  const failLevels = new Set(policy.failOnLevels);
  return findings.some((finding) => failLevels.has(finding.level));
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
