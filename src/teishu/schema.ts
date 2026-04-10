import { z } from "zod";

export const teishuResponseSchema = z
  .object({
    output: z.string(),
    needsMoreFromMizuya: z.boolean(),
    followUpQuestion: z.string().optional(),
  })
  .strict();

export type TeishuResponse = z.infer<typeof teishuResponseSchema>;
