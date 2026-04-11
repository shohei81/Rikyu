/**
 * 水屋 (Mizuya) response schemas.
 *
 * The mizuya produces structured findings — observations,
 * evidence, and inferences — for the teishu to evaluate.
 */

import { z } from "zod";

export const MizuyaFindingSchema = z.object({
  ruleId: z.string(),
  level: z.enum(["error", "warning", "note"]),
  message: z.string(),
  location: z
    .object({
      file: z.string(),
      startLine: z.number().optional(),
    })
    .optional(),
  evidence: z.array(z.string()),
  inference: z.string().optional(),
  suggestedAction: z.string().optional(),
  confidence: z.enum(["high", "medium", "low"]),
});

export type MizuyaFinding = z.infer<typeof MizuyaFindingSchema>;

export const MizuyaResponseSchema = z.object({
  requestId: z.string(),
  findings: z.array(MizuyaFindingSchema),
  summary: z.string(),
  doubts: z.array(z.string()),
  contextUsed: z.array(z.string()),
});

export type MizuyaResponse = z.infer<typeof MizuyaResponseSchema>;
