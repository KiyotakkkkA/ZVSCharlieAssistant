import { z } from "zod";
import { entityIdSchema } from "./ipc-dto";

export const upsertSecretCategoryDtoSchema = z.object({
  id: entityIdSchema.optional(),
  label: z.string(),
});
export const upsertSecretDtoSchema = z.object({
  id: entityIdSchema.optional(),
  categoryId: entityIdSchema,
  label: z.string(),
  content: z.string().optional(),
});

export type UpsertSecretCategoryInput = z.infer<
  typeof upsertSecretCategoryDtoSchema
>;
export type UpsertSecretInput = z.infer<typeof upsertSecretDtoSchema>;
