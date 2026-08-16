import { z } from "zod";

export const memoryKindSchema = z.enum([
  "fact",
  "preference",
  "instruction",
  "episode",
]);

export const upsertMemoryEntryDtoSchema = z.object({
  id: z.int().positive().optional(),
  kind: memoryKindSchema,
  title: z.string().trim().min(1).max(200),
  content: z.string().trim().min(1).max(20_000),
  tags: z.array(z.string().trim().min(1).max(40)).max(12).default([]),
  pinned: z.boolean().optional(),
});

export const upsertMemoryPolicyDtoSchema = z.object({
  enabled: z.boolean(),
  autosave: z.boolean(),
  allowScenarioWrites: z.boolean(),
  maxEntries: z.int().positive(),
  maxContentChars: z.int().positive(),
  injectedEntries: z.int().nonnegative(),
});

export type UpsertMemoryEntryInput = z.infer<typeof upsertMemoryEntryDtoSchema>;
export type UpsertMemoryPolicyInput = z.infer<
  typeof upsertMemoryPolicyDtoSchema
>;
