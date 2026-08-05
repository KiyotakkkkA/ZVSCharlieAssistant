import { z } from "zod";

export const chatModeSchema = z.enum(["chat", "planner", "agent", "scenario"]);
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

export type ChatMode = z.infer<typeof chatModeSchema>;
export type ChatMessageContentPart = z.infer<
  typeof chatMessageContentPartDtoSchema
>;
export type StartRunInput = z.infer<typeof startRunDtoSchema>;
