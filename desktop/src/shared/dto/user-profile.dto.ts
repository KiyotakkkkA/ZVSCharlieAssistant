import { z } from "zod";

export const upsertUserProfileDtoSchema = z.object({
  displayName: z.string().trim().max(120).default(""),
  instructions: z.string().trim().max(4000).default(""),
  style: z.string().trim().max(2000).default(""),
});

export type UpsertUserProfileInput = z.infer<typeof upsertUserProfileDtoSchema>;
