import { z } from "zod";
import { entityIdSchema } from "./ipc-dto";

export const vectorSearchModeSchema = z.enum(["vector", "hybrid"]);
export const upsertVectorStoreDtoSchema = z.object({
  id: entityIdSchema.optional(),
  name: z.string(),
  description: z.string(),
  embeddingModelId: entityIdSchema.nullable(),
  searchMode: vectorSearchModeSchema,
  chunkSizeTokens: z.int().positive(),
  chunkOverlapTokens: z.int().nonnegative(),
});
export const uploadVectorDocumentDtoSchema = z.object({
  vectorStoreId: entityIdSchema,
  fileName: z.string(),
  mimeType: z.string(),
  data: z.instanceof(ArrayBuffer),
});
export const uploadVectorDirectoryDtoSchema = z.object({
  vectorStoreId: entityIdSchema,
  directoryPath: z.string().trim().min(1).max(4096),
});
export const vectorSearchDtoSchema = z.object({
  vectorStoreIds: z.array(entityIdSchema),
  query: z.string(),
  limit: z.int().positive().optional(),
  scoreThreshold: z.number().optional(),
});

export type VectorSearchMode = z.infer<typeof vectorSearchModeSchema>;
export type UpsertVectorStoreInput = z.infer<typeof upsertVectorStoreDtoSchema>;
export type UploadVectorDocumentInput = z.infer<
  typeof uploadVectorDocumentDtoSchema
>;
export type UploadVectorDirectoryInput = z.infer<
  typeof uploadVectorDirectoryDtoSchema
>;
export type VectorSearchInput = z.infer<typeof vectorSearchDtoSchema>;
