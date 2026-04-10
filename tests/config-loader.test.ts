import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ConfigError, getConfigValue, loadRikyuConfig, setConfigValue } from "../src/config/loader.js";
import { defaultRikyuConfig } from "../src/config/schema.js";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "rikyu-config-test-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("loadRikyuConfig", () => {
  it("returns defaults when config files are missing", async () => {
    const loaded = await loadRikyuConfig({
      globalConfigPath: join(dir, "global.json"),
      projectConfigPath: join(dir, "project.json"),
    });

    expect(loaded.config).toEqual(defaultRikyuConfig);
    expect(loaded.sources).toEqual({});
  });

  it("loads and merges global and project config with project priority", async () => {
    const globalConfigPath = join(dir, "global.json");
    const projectConfigPath = join(dir, "project.json");
    await writeFile(globalConfigPath, JSON.stringify({ mode: "quick", verbose: true }), "utf8");
    await writeFile(projectConfigPath, JSON.stringify({ mode: "deep", progress: false }), "utf8");

    const loaded = await loadRikyuConfig({ globalConfigPath, projectConfigPath });

    expect(loaded.config).toEqual({
      mode: "deep",
      verbose: true,
      json: false,
      progress: false,
    });
    expect(loaded.sources).toEqual({
      global: globalConfigPath,
      project: projectConfigPath,
    });
  });

  it("accepts partial config files", async () => {
    const projectConfigPath = join(dir, "project.json");
    await writeFile(projectConfigPath, JSON.stringify({ json: true }), "utf8");

    const loaded = await loadRikyuConfig({
      globalConfigPath: join(dir, "missing.json"),
      projectConfigPath,
    });

    expect(loaded.config).toEqual({
      ...defaultRikyuConfig,
      json: true,
    });
  });

  it("throws ConfigError for invalid JSON", async () => {
    const projectConfigPath = join(dir, "project.json");
    await writeFile(projectConfigPath, "{", "utf8");

    await expect(
      loadRikyuConfig({
        globalConfigPath: join(dir, "missing.json"),
        projectConfigPath,
      }),
    ).rejects.toMatchObject({
      code: "INVALID_JSON",
      path: projectConfigPath,
    });
  });

  it("throws ConfigError for invalid values", async () => {
    const projectConfigPath = join(dir, "project.json");
    await writeFile(projectConfigPath, JSON.stringify({ mode: "slow" }), "utf8");

    await expect(
      loadRikyuConfig({
        globalConfigPath: join(dir, "missing.json"),
        projectConfigPath,
      }),
    ).rejects.toBeInstanceOf(ConfigError);
  });
});

describe("config set/get", () => {
  it("sets and gets values", async () => {
    const projectConfigPath = join(dir, ".rikyu", "config.json");

    await setConfigValue(projectConfigPath, "mode", "standard");
    await setConfigValue(projectConfigPath, "verbose", "true");

    const loaded = await loadRikyuConfig({
      globalConfigPath: join(dir, "missing.json"),
      projectConfigPath,
    });
    const text = await readFile(projectConfigPath, "utf8");

    expect(JSON.parse(text)).toEqual({ mode: "standard", verbose: true });
    expect(getConfigValue(loaded.config, "mode")).toBe("standard");
    expect(getConfigValue(loaded.config, "verbose")).toBe(true);
  });

  it("rejects invalid set values", async () => {
    await expect(setConfigValue(join(dir, "config.json"), "progress", "yes")).rejects.toThrow(
      'Expected "true" or "false" for progress',
    );
  });
});
