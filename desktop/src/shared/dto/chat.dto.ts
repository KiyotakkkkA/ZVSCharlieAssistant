import { z } from "zod";
import { entityIdSchema } from "./ipc-dto";

export const chatModeSchema = z.enum(["chat", "planner", "agent", "scenario"]);
export type ChatMode = z.infer<typeof chatModeSchema>;
export interface ChatUsage {
  mode: ChatMode;
  modelId?: string;
  agentId?: string;
  scenarioId?: string;
}
export const chatUsageDtoSchema: z.ZodType<ChatUsage> = z.object({
  mode: chatModeSchema,
  modelId: entityIdSchema
    .nullable()
    .optional()
    .transform((value) => value ?? undefined),
  agentId: z
    .string()
    .nullable()
    .optional()
    .transform((value) => value ?? undefined),
  scenarioId: z
    .string()
    .nullable()
    .optional()
    .transform((value) => value ?? undefined),
});
export const chatMessageContentPartDtoSchema = z.object({
  type: z.enum(["text", "reasoning"]),
  text: z.string(),
});
export const chatMessageContentDtoSchema = z.array(
  chatMessageContentPartDtoSchema,
);
export const startRunDtoSchema = z.object({
  conversationId: entityIdSchema.optional(),
  mode: chatModeSchema,
  modelId: entityIdSchema.optional(),
  agentId: z.string().optional(),
  scenarioId: z.string().optional(),
  text: z.string(),
});

export type ChatMessageContentPart = z.infer<
  typeof chatMessageContentPartDtoSchema
>;
export type StartRunInput = z.infer<typeof startRunDtoSchema>;
