/**
 * SARIF v2.1.0 output — for CI/CD code scanning integration.
 */

import type { ChajiResult } from "../hanto/orchestrator.js";
import type { MizuyaFinding } from "../mizuya/schema.js";
import { redactJsonValues } from "./redaction.js";

interface SarifLog {
  $schema: string;
  version: string;
  runs: SarifRun[];
}

interface SarifRun {
  tool: { driver: { name: string; version: string; rules: SarifRule[] } };
  results: SarifResult[];
}

interface SarifRule {
  id: string;
  shortDescription: { text: string };
  properties?: Record<string, unknown>;
}

interface SarifResult {
  ruleId: string;
  level: string;
  message: { text: string };
  locations?: SarifLocation[];
  properties?: Record<string, unknown>;
}

interface SarifLocation {
  physicalLocation: {
    artifactLocation: { uri: string };
    region?: { startLine: number };
  };
}

export function formatSarif(result: ChajiResult): string {
  const findings = result.mizuya?.findings ?? [];

  const sarif: SarifLog = {
    $schema:
      "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/main/sarif-2.1/schema/sarif-schema-2.1.0.json",
    version: "2.1.0",
    runs: [
      {
        tool: {
          driver: {
            name: "rikyu",
            version: "0.0.0",
            rules: deduplicateRules(findings),
          },
        },
        results: findings.map(toSarifResult),
      },
    ],
  };

  return JSON.stringify(redactJsonValues(sarif), null, 2) + "\n";
}

function deduplicateRules(findings: MizuyaFinding[]): SarifRule[] {
  const seen = new Map<string, SarifRule>();
  for (const f of findings) {
    if (!seen.has(f.ruleId)) {
      seen.set(f.ruleId, {
        id: f.ruleId,
        shortDescription: { text: f.message },
        properties: { confidence: f.confidence },
      });
    }
  }
  return [...seen.values()];
}

function toSarifResult(finding: MizuyaFinding): SarifResult {
  const result: SarifResult = {
    ruleId: finding.ruleId,
    level: finding.level,
    message: { text: finding.message },
    properties: {
      confidence: finding.confidence,
      ...(finding.evidence.length > 0 ? { evidence: finding.evidence } : {}),
      ...(finding.inference ? { inference: finding.inference } : {}),
      ...(finding.suggestedAction
        ? { suggestedAction: finding.suggestedAction }
        : {}),
    },
  };

  if (finding.location) {
    result.locations = [
      {
        physicalLocation: {
          artifactLocation: { uri: finding.location.file },
          ...(finding.location.startLine !== undefined
            ? { region: { startLine: finding.location.startLine } }
            : {}),
        },
      },
    ];
  }

  return result;
}
