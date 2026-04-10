import { z } from "zod";

import type { CollaborationResult } from "../collaboration/flow.js";
import type { MizuyaFinding, MizuyaResponse } from "../mizuya/schema.js";
import { redactJsonValue } from "./redaction.js";

export const sarifLogSchema = z
  .object({
    version: z.literal("2.1.0"),
    $schema: z.literal("https://json.schemastore.org/sarif-2.1.0.json"),
    runs: z
      .array(
        z
          .object({
            tool: z.object({
              driver: z.object({
                name: z.string().min(1),
                informationUri: z.string().url().optional(),
                rules: z.array(z.unknown()),
              }),
            }),
            results: z.array(z.unknown()),
          })
          .passthrough(),
      )
      .min(1),
  })
  .passthrough();

export interface SarifOutputOptions {
  toolName?: string;
  informationUri?: string;
}

export type SarifLog = z.infer<typeof sarifLogSchema>;

export function mizuyaResponseToSarif(
  response: MizuyaResponse | undefined,
  options: SarifOutputOptions = {},
): SarifLog {
  const findings = response?.findings ?? [];
  const rules = [...new Map(findings.map((finding) => [finding.ruleId, finding])).values()].map(
    findingToRule,
  );
  const log = {
    version: "2.1.0",
    $schema: "https://json.schemastore.org/sarif-2.1.0.json",
    runs: [
      {
        tool: {
          driver: {
            name: options.toolName ?? "Rikyu",
            informationUri: options.informationUri ?? "https://github.com/shohei81/Rikyu",
            rules,
          },
        },
        results: findings.map((finding) => findingToResult(finding, response)),
      },
    ],
  } satisfies SarifLog;

  return sarifLogSchema.parse(log);
}

export function renderSarifOutput(result: CollaborationResult): string {
  return `${JSON.stringify(redactJsonValue(mizuyaResponseToSarif(result.mizuyaResponse)), null, 2)}\n`;
}

export function writeSarifOutput(
  result: CollaborationResult,
  writer: (text: string) => void,
): void {
  writer(renderSarifOutput(result));
}

function findingToRule(finding: MizuyaFinding) {
  return {
    id: finding.ruleId,
    shortDescription: { text: finding.ruleId },
    fullDescription: { text: finding.message },
    properties: {
      confidence: finding.confidence,
    },
  };
}

function findingToResult(finding: MizuyaFinding, response: MizuyaResponse | undefined) {
  return {
    ruleId: finding.ruleId,
    level: finding.level,
    message: { text: finding.message },
    locations: finding.location ? [findingToLocation(finding)] : [],
    properties: {
      evidence: finding.evidence,
      ...(finding.inference ? { inference: finding.inference } : {}),
      ...(finding.suggestedAction ? { suggestedAction: finding.suggestedAction } : {}),
      confidence: finding.confidence,
      ...(response ? { requestId: response.requestId, summary: response.summary } : {}),
    },
  };
}

function findingToLocation(finding: MizuyaFinding) {
  return {
    physicalLocation: {
      artifactLocation: {
        uri: finding.location?.file,
      },
      ...(finding.location?.startLine
        ? {
            region: {
              startLine: finding.location.startLine,
            },
          }
        : {}),
    },
  };
}
