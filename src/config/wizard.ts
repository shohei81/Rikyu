import { createInterface, type Interface } from "node:readline/promises";
import type { Readable, Writable } from "node:stream";

import { defaultRikyuConfig, type PartialRikyuConfig, type RikyuConfig } from "./schema.js";

export interface ConfigWizardOptions {
  input?: Readable;
  output?: Writable;
  defaults?: RikyuConfig;
}

export async function runConfigWizard(
  options: ConfigWizardOptions = {},
): Promise<PartialRikyuConfig> {
  const rl = createInterface({
    input: options.input ?? process.stdin,
    output: options.output ?? process.stdout,
  });

  try {
    return await promptForConfig(rl, options.defaults ?? defaultRikyuConfig);
  } finally {
    rl.close();
  }
}

async function promptForConfig(rl: Interface, defaults: RikyuConfig): Promise<PartialRikyuConfig> {
  const mode = await askWithDefault(
    rl,
    "mode (auto/quick/standard/deep)",
    defaults.mode,
    new Set(["auto", "quick", "standard", "deep"]),
  );
  const policyProfile = await askWithDefault(
    rl,
    "policyProfile (strict/balanced/lenient)",
    defaults.policyProfile,
    new Set(["strict", "balanced", "lenient"]),
  );

  return {
    mode,
    policyProfile,
    verbose: await askBoolean(rl, "verbose", defaults.verbose),
    json: await askBoolean(rl, "json", defaults.json),
    progress: await askBoolean(rl, "progress", defaults.progress),
  };
}

async function askBoolean(rl: Interface, key: string, defaultValue: boolean): Promise<boolean> {
  const answer = await askWithDefault(rl, `${key} (true/false)`, String(defaultValue));
  if (answer === "true") return true;
  if (answer === "false") return false;
  return defaultValue;
}

async function askWithDefault<T extends string>(
  rl: Interface,
  label: string,
  defaultValue: T,
  allowed?: Set<string>,
): Promise<T> {
  const answer = (await rl.question(`${label} [${defaultValue}]: `)).trim();
  if (answer === "") return defaultValue;
  if (allowed && !allowed.has(answer)) return defaultValue;
  return answer as T;
}
