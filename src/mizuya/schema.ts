import { z } from "zod";

export const mizuyaFindingSchema = z
  .object({
    ruleId: z.string().min(1),
    level: z.enum(["error", "warning", "note"]),
    message: z.string().min(1),
    location: z
      .object({
        file: z.string().min(1),
        startLine: z.number().int().positive().optional(),
      })
      .strict()
      .optional(),
    evidence: z.array(z.string()),
    inference: z.string().optional(),
    suggestedAction: z.string().optional(),
    confidence: z.enum(["high", "medium", "low"]),
  })
  .strict();

export const mizuyaResponseSchema = z
  .object({
    requestId: z.string().min(1),
    findings: z.array(mizuyaFindingSchema),
    summary: z.string(),
    doubts: z.array(z.string()),
    contextUsed: z.array(z.string()),
  })
  .strict();

export type MizuyaFinding = z.infer<typeof mizuyaFindingSchema>;
export type MizuyaResponse = z.infer<typeof mizuyaResponseSchema>;
