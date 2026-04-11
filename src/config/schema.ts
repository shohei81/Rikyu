import { z } from "zod";

export const RikyuConfigSchema = z.object({
  mode: z.enum(["auto", "quick", "standard", "deep"]).default("auto"),
  verbose: z.boolean().default(false),
  json: z.boolean().default(false),
  progress: z.boolean().default(true),
  policyProfile: z.string().default("balanced"),
});

export type RikyuConfig = z.infer<typeof RikyuConfigSchema>;

export const defaultConfig: RikyuConfig = RikyuConfigSchema.parse({});
