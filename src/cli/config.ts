import { writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

import type { Command } from "commander";

import {
  getConfigValue,
  getProjectConfigPath,
  loadRikyuConfig,
  setConfigValue,
} from "../config/loader.js";
import { partialRikyuConfigSchema } from "../config/schema.js";
import { runConfigWizard } from "../config/wizard.js";

export function registerConfigCommand(program: Command): void {
  const config = program
    .command("config")
    .description("Read or update Rikyu configuration.")
    .action(async () => {
      const path = getProjectConfigPath();
      const loaded = await loadRikyuConfig({ projectConfigPath: path });
      const nextConfig = partialRikyuConfigSchema.parse(
        await runConfigWizard({ defaults: loaded.config }),
      );

      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, `${JSON.stringify(nextConfig, null, 2)}\n`, "utf8");
      console.log(`Wrote ${path}`);
    });

  config
    .command("set")
    .description("Set a project configuration value.")
    .argument("<key>", "Config key")
    .argument("<value>", "Config value")
    .action(async (key: string, value: string) => {
      const path = getProjectConfigPath();
      const nextConfig = await setConfigValue(path, key, value);
      console.log(`${key}=${String(nextConfig[key as keyof typeof nextConfig])}`);
    });

  config
    .command("get")
    .description("Get a configuration value after merging defaults and config files.")
    .argument("<key>", "Config key")
    .action(async (key: string) => {
      const { config: loadedConfig } = await loadRikyuConfig();
      console.log(String(getConfigValue(loadedConfig, key)));
    });

  config
    .command("list")
    .description("List merged configuration.")
    .action(async () => {
      const { config: loadedConfig } = await loadRikyuConfig();
      for (const [key, value] of Object.entries(loadedConfig)) {
        console.log(`${key}=${String(value)}`);
      }
    });
}
