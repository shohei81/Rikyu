/**
 * 亭主 (Teishu) response schema.
 *
 * The teishu synthesizes mizuya findings with independent judgment
 * and produces the final response for the shokyaku (user).
 */

import { z } from "zod";

export const TeishuResponseSchema = z.object({
  output: z.string(),
  needsMoreFromMizuya: z.boolean(),
  followUpQuestion: z.string().nullish(),
  sessionId: z.string().nullish(),
});

export type TeishuResponse = z.infer<typeof TeishuResponseSchema>;
