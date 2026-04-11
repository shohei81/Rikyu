import { describe, expect, it } from "vitest";

import { formatSarif } from "../src/output/sarif.js";
import type { ChajiResult } from "../src/hanto/orchestrator.js";
import type { MizuyaResponse } from "../src/mizuya/schema.js";
import type { MizuyaFinding } from "../src/mizuya/schema.js";

// ── Fixtures ───────────────────────────────────────────

const finding1: MizuyaFinding = {
  ruleId: "null-check",
  level: "warning",
  message: "Missing null handling",
  location: { file: "src/foo.ts", startLine: 10 },
  evidence: ["value may be undefined"],
  confidence: "high",
};

const finding2: MizuyaFinding = {
  ruleId: "unused-import",
  level: "note",
  message: "Unused import detected",
  location: { file: "src/bar.ts", startLine: 3 },
  evidence: [],
  confidence: "medium",
};

const finding3DuplicateRule: MizuyaFinding = {
  ruleId: "null-check",
  level: "warning",
  message: "Another null issue",
  location: { file: "src/baz.ts", startLine: 22 },
  evidence: ["different call site"],
  confidence: "medium",
};

function makeResult(findings: MizuyaFinding[]): ChajiResult {
  const mizuya: MizuyaResponse = {
    requestId: "req-1",
    findings,
    summary: "Analysis complete.",
    doubts: [],
    contextUsed: [],
  };

  return {
    id: "req-1",
    output: "Review complete.",
    teishu: { output: "Review complete.", needsMoreFromMizuya: false },
    mizuya,
    degraded: false,
    phases: [],
  };
}

// ── Tests ──────────────────────────────────────────────

describe("formatSarif", () => {
  it("produces valid SARIF 2.1.0 structure with $schema, version, runs", () => {
    const sarif = JSON.parse(formatSarif(makeResult([finding1])));

    expect(sarif.$schema).toContain("sarif-schema-2.1.0");
    expect(sarif.version).toBe("2.1.0");
    expect(sarif.runs).toBeInstanceOf(Array);
    expect(sarif.runs).toHaveLength(1);
    expect(sarif.runs[0].tool.driver.name).toBe("rikyu");
  });

  it("maps findings to results with ruleId, level, message", () => {
    const sarif = JSON.parse(formatSarif(makeResult([finding1, finding2])));
    const results = sarif.runs[0].results;

    expect(results).toHaveLength(2);
    expect(results[0].ruleId).toBe("null-check");
    expect(results[0].level).toBe("warning");
    expect(results[0].message.text).toBe("Missing null handling");

    expect(results[1].ruleId).toBe("unused-import");
    expect(results[1].level).toBe("note");
    expect(results[1].message.text).toBe("Unused import detected");
  });

  it("maps location to physicalLocation with artifactLocation and region", () => {
    const sarif = JSON.parse(formatSarif(makeResult([finding1])));
    const loc = sarif.runs[0].results[0].locations[0].physicalLocation;

    expect(loc.artifactLocation.uri).toBe("src/foo.ts");
    expect(loc.region.startLine).toBe(10);
  });

  it("deduplicates rules by ruleId", () => {
    const sarif = JSON.parse(
      formatSarif(makeResult([finding1, finding3DuplicateRule])),
    );
    const rules = sarif.runs[0].tool.driver.rules;

    expect(rules).toHaveLength(1);
    expect(rules[0].id).toBe("null-check");

    // But results are still 2 (one per finding)
    expect(sarif.runs[0].results).toHaveLength(2);
  });

  it("empty findings produce empty results array", () => {
    const sarif = JSON.parse(formatSarif(makeResult([])));

    expect(sarif.runs[0].results).toEqual([]);
    expect(sarif.runs[0].tool.driver.rules).toEqual([]);
  });
});
