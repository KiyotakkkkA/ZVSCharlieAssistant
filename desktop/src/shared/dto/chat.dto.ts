import { z } from "zod";

export const chatModeSchema = z.enum(["chat", "planner", "agent", "scenario"]);
export type ChatMode = z.infer<typeof chatModeSchema>;
export interface ChatUsage {
  mode: ChatMode;
  modelId?: number;
  agentId?: string;
  scenarioId?: string;
}
export const chatUsageDtoSchema: z.ZodType<ChatUsage> = z.object({
  mode: chatModeSchema,
  modelId: z
    .int()
    .positive()
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
  conversationId: z.int().positive().optional(),
  mode: chatModeSchema,
  modelId: z.int().positive().optional(),
  agentId: z.string().optional(),
  scenarioId: z.string().optional(),
  text: z.string(),
});

export type ChatMessageContentPart = z.infer<
  typeof chatMessageContentPartDtoSchema
>;
export type StartRunInput = z.infer<typeof startRunDtoSchema>;
