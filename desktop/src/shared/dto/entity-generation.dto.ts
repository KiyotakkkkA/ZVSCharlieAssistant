import { z } from "zod";
import { entityIdSchema } from "./ipc-dto";

export const generatedEntityKindSchema = z.enum(["agent", "skill"]);

export const startEntityGenerationDtoSchema = z.object({
  kind: generatedEntityKindSchema,
  modelId: entityIdSchema,
  prompt: z.string().trim().min(10).max(4000),
});

export const generatedAgentDraftDtoSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().min(2).max(400),
  instructions: z.string().trim().min(40).max(20_000),
  allowedToolIds: z.array(z.string().trim().min(1)).max(40).default([]),
  memoryRead: z.boolean().default(false),
  memoryWrite: z.boolean().default(false),
  maxToolCalls: z.int().min(1).max(20).default(8),
  timeoutSeconds: z.int().min(30).max(1800).default(180),
  retrievalLimit: z.int().min(1).max(25).default(5),
});

export const generatedSkillDraftDtoSchema = z.object({
  slug: z.string().trim().min(2).max(64),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().min(2).max(400),
  instructions: z.string().trim().min(80).max(40_000),
  requiredToolIds: z.array(z.string().trim().min(1)).max(40).default([]),
  version: z.string().trim().max(20).default("1.0.0"),
});

export type GeneratedEntityKind = z.infer<typeof generatedEntityKindSchema>;
export type StartEntityGenerationInput = z.infer<
  typeof startEntityGenerationDtoSchema
>;
export type GeneratedAgentDraft = z.infer<typeof generatedAgentDraftDtoSchema>;
export type GeneratedSkillDraft = z.infer<typeof generatedSkillDraftDtoSchema>;
