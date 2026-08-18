import { z } from "zod";

export const textProviderKindSchema = z.enum([
  "ollama",
  "openrouter",
  "mistral",
]);
export const textProviderTypeSchema = z.enum(["text", "embedding"]);
export const textProviderGenerationSettingsDtoSchema = z.object({
  maxOutputTokens: z.int().positive(),
  temperature: z.number(),
  topP: z.number(),
});
export const textProviderModelDetailsDtoSchema = z.object({
  parentModel: z.string(),
  format: z.string(),
  family: z.string(),
  families: z.array(z.string()).nullable(),
  parameterSize: z.string(),
  quantizationLevel: z.string(),
  contextLength: z.number().nullable().optional(),
  maxCompletionTokens: z.number().nullable().optional(),
  inputModalities: z.array(z.string()).optional(),
  outputModalities: z.array(z.string()).optional(),
  tokenizer: z.string().optional(),
  instructType: z.string().nullable().optional(),
  isModerated: z.boolean().optional(),
  doesNotTrain: z.boolean().optional(),
  zeroDataRetention: z.boolean().optional(),
  promptPrice: z.string().optional(),
  completionPrice: z.string().optional(),
  requestPrice: z.string().optional(),
  supportedParameters: z.array(z.string()).optional(),
  description: z.string().optional(),
});
export const textProviderLimitsDtoSchema = z.object({
  limit: z.number().nullable(),
  limitRemaining: z.number().nullable(),
  limitReset: z.string().nullable(),
  usage: z.number(),
  usageDaily: z.number(),
  usageWeekly: z.number(),
  usageMonthly: z.number(),
  isFreeTier: z.boolean(),
  expiresAt: z.string().nullable(),
});
export const testTextProviderConnectionDtoSchema = z.object({
  kind: textProviderKindSchema,
  providerType: textProviderTypeSchema,
  baseUrl: z.string(),
  apiKeySecretId: z.int().positive().optional(),
});
export const upsertTextProviderDtoSchema =
  testTextProviderConnectionDtoSchema.extend({
    id: z.int().positive().optional(),
    name: z.string(),
    enabled: z.boolean(),
    enabledModelIds: z.array(z.string()),
    generationSettings: textProviderGenerationSettingsDtoSchema,
  });

export type TextProviderKind = z.infer<typeof textProviderKindSchema>;
export type TextProviderType = z.infer<typeof textProviderTypeSchema>;
export type TextProviderGenerationSettings = z.infer<
  typeof textProviderGenerationSettingsDtoSchema
>;
export type TextProviderModelDetails = z.infer<
  typeof textProviderModelDetailsDtoSchema
>;
export type TextProviderLimits = z.infer<typeof textProviderLimitsDtoSchema>;
export type TestTextProviderConnectionInput = z.infer<
  typeof testTextProviderConnectionDtoSchema
>;
export type UpsertTextProviderInput = z.infer<
  typeof upsertTextProviderDtoSchema
>;
