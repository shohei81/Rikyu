import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  resolvePolicySettings,
  shouldFailForFindings,
} from "../src/config/policy.js";
import type { MizuyaFinding } from "../src/mizuya/schema.js";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "rikyu-policy-test-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("policy profiles", () => {
  it("resolves built-in strict, balanced, and lenient profiles", async () => {
    await expect(resolvePolicySettings({ cwd: dir, profile: "strict" })).resolves.toEqual({
      failOnLevels: ["error", "warning", "note"],
    });
    await expect(resolvePolicySettings({ cwd: dir, profile: "balanced" })).resolves.toEqual({
      failOnLevels: ["error", "warning"],
    });
    await expect(resolvePolicySettings({ cwd: dir, profile: "lenient" })).resolves.toEqual({
      failOnLevels: ["error"],
    });
  });

  it("loads team overrides from .rikyu/policy.json", async () => {
    const policyDir = join(dir, ".rikyu");
    await mkdir(policyDir, { recursive: true });
    await writeFile(
      join(policyDir, "policy.json"),
      JSON.stringify({
        defaultProfile: "strict",
        profiles: {
          strict: { failOnLevels: ["error"] },
        },
      }),
      "utf8",
    );

    await expect(resolvePolicySettings({ cwd: dir })).resolves.toEqual({
      failOnLevels: ["error"],
    });
  });

  it("uses resolved fail levels for findings", () => {
    expect(shouldFailForFindings([finding("warning")], { failOnLevels: ["error"] })).toBe(false);
    expect(shouldFailForFindings([finding("warning")], { failOnLevels: ["error", "warning"] })).toBe(
      true,
    );
  });
});

function finding(level: MizuyaFinding["level"]): MizuyaFinding {
  return {
    ruleId: "rikyu.rule",
    level,
    message: "message",
    evidence: ["evidence"],
    confidence: "high",
  };
}
