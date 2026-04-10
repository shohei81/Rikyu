import { describe, expect, it } from "vitest";

import {
  mizuyaResponseToSarif,
  renderSarifOutput,
  sarifLogSchema,
} from "../src/output/sarif.js";
import type { CollaborationResult } from "../src/collaboration/flow.js";
import type { MizuyaResponse } from "../src/mizuya/schema.js";

const mizuyaResponse: MizuyaResponse = {
  requestId: "req-sarif",
  findings: [
    {
      ruleId: "rikyu.security.token",
      level: "warning",
      message: "Do not expose token=secret-value.",
      location: { file: "src/app.ts", startLine: 12 },
      evidence: ["token=secret-value"],
      suggestedAction: "Move the token to configuration.",
      confidence: "high",
    },
  ],
  summary: "Review found one token issue.",
  doubts: [],
  contextUsed: ["git-diff:working-tree"],
};

describe("SARIF output", () => {
  it("converts MizuyaResponse findings to SARIF v2.1.0", () => {
    const sarif = mizuyaResponseToSarif(mizuyaResponse);

    expect(sarifLogSchema.parse(sarif)).toEqual(sarif);
    expect(sarif.version).toBe("2.1.0");
    expect(sarif.$schema).toBe("https://json.schemastore.org/sarif-2.1.0.json");
    expect(sarif.runs[0]?.tool.driver.name).toBe("Rikyu");
    expect(sarif.runs[0]?.results[0]).toMatchObject({
      ruleId: "rikyu.security.token",
      level: "warning",
      message: { text: "Do not expose token=secret-value." },
      locations: [
        {
          physicalLocation: {
            artifactLocation: { uri: "src/app.ts" },
            region: { startLine: 12 },
          },
        },
      ],
    });
  });

  it("redacts secrets in rendered SARIF JSON", () => {
    const rendered = renderSarifOutput(result({ mizuyaResponse }));
    const parsed = JSON.parse(rendered);

    expect(rendered).not.toContain("secret-value");
    expect(parsed.runs[0].results[0].message.text).toBe("Do not expose token=[REDACTED]");
    expect(parsed.runs[0].results[0].properties.evidence).toEqual(["token=[REDACTED]"]);
  });
});

function result(overrides: Partial<CollaborationResult> = {}): CollaborationResult {
  return {
    requestId: "req-sarif",
    output: "Review output",
    teishuResponse: {
      output: "Review output",
      needsMoreFromMizuya: false,
    },
    degraded: false,
    stderr: [],
    ...overrides,
  };
}
