import { z } from "zod";

export const upsertSecretCategoryDtoSchema = z.object({
  id: z.int().positive().optional(),
  label: z.string(),
});
export const upsertSecretDtoSchema = z.object({
  id: z.int().positive().optional(),
  categoryId: z.int().positive(),
  label: z.string(),
  content: z.string().optional(),
});

export type UpsertSecretCategoryInput = z.infer<
  typeof upsertSecretCategoryDtoSchema
>;
export type UpsertSecretInput = z.infer<typeof upsertSecretDtoSchema>;
