import { z } from "zod";
import { entityIdSchema, entityTitleSchema } from "./ipc-dto";
import { directoryGrantDtoSchema } from "./directory-policy.dto";

export const projectGrantDtoSchema = directoryGrantDtoSchema;

export const upsertProjectDtoSchema = z.object({
  id: entityIdSchema.optional(),
  name: entityTitleSchema,
  rootPath: z.string().trim().max(4096).nullable(),
  instructions: z.string().max(20_000),
  defaultAgentId: entityIdSchema.nullable(),
  defaultModelId: entityIdSchema.nullable(),
  compactThreshold: z.number().min(0.4).max(0.95),
  compactModelId: entityIdSchema.nullable(),
  archived: z.boolean(),
  grants: z.array(projectGrantDtoSchema).max(50),
});

export const assignConversationProjectDtoSchema = z.object({
  conversationId: entityIdSchema,
  projectId: entityIdSchema.nullable(),
});

export type UpsertProjectInput = z.infer<typeof upsertProjectDtoSchema>;
export type AssignConversationProjectInput = z.infer<
  typeof assignConversationProjectDtoSchema
>;
