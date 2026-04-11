import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadConfig, setConfigValue } from "../src/config/loader.js";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), "rikyu-config-test-"));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true });
});

describe("loadConfig", () => {
  it("returns defaults when no config files exist", async () => {
    const result = await loadConfig({ cwd: tmpDir });

    expect(result.config.mode).toBe("auto");
    expect(result.config.verbose).toBe(false);
    expect(result.config.json).toBe(false);
    expect(result.config.progress).toBe(true);
    expect(result.config.policyProfile).toBe("balanced");
    expect(result.sources).toEqual([]);
  });

  it("reads project config and merges with defaults", async () => {
    const configDir = join(tmpDir, ".rikyu");
    await mkdir(configDir, { recursive: true });
    await writeFile(
      join(configDir, "config.json"),
      JSON.stringify({ mode: "deep", verbose: true }),
      "utf8",
    );

    const result = await loadConfig({ cwd: tmpDir });

    expect(result.config.mode).toBe("deep");
    expect(result.config.verbose).toBe(true);
    // Defaults fill in the rest
    expect(result.config.json).toBe(false);
    expect(result.config.progress).toBe(true);
    expect(result.sources).toHaveLength(1);
  });

  it("partial config works and fills in defaults", async () => {
    const configDir = join(tmpDir, ".rikyu");
    await mkdir(configDir, { recursive: true });
    await writeFile(
      join(configDir, "config.json"),
      JSON.stringify({ policyProfile: "strict" }),
      "utf8",
    );

    const result = await loadConfig({ cwd: tmpDir });

    expect(result.config.policyProfile).toBe("strict");
    expect(result.config.mode).toBe("auto");
    expect(result.config.verbose).toBe(false);
  });
});

describe("setConfigValue", () => {
  it("writes a valid config value and can be loaded back", async () => {
    await setConfigValue("mode", "quick", { cwd: tmpDir });

    const result = await loadConfig({ cwd: tmpDir });
    expect(result.config.mode).toBe("quick");
  });

  it("validates before writing (rejects invalid values)", async () => {
    await expect(
      setConfigValue("mode", "invalid-mode", { cwd: tmpDir }),
    ).rejects.toThrow();
  });

  it("preserves existing values when setting a new key", async () => {
    await setConfigValue("mode", "deep", { cwd: tmpDir });
    await setConfigValue("verbose", "true", { cwd: tmpDir });

    const result = await loadConfig({ cwd: tmpDir });
    expect(result.config.mode).toBe("deep");
    expect(result.config.verbose).toBe(true);
  });
});
