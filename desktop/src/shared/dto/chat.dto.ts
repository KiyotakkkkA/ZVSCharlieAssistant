import { z } from "zod";
import { entityIdSchema, jsonValueSchema } from "./ipc-dto";

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

export const chatTextPartDtoSchema = z.object({
  type: z.literal("text"),
  text: z.string(),
});
export const chatReasoningPartDtoSchema = z.object({
  type: z.literal("reasoning"),
  text: z.string(),
});
export const chatToolCallPartDtoSchema = z.object({
  type: z.literal("tool-call"),
  toolCallId: z.string(),
  toolName: z.string(),
  input: jsonValueSchema,
});
export const chatToolResultPartDtoSchema = z.object({
  type: z.literal("tool-result"),
  toolCallId: z.string(),
  toolName: z.string(),
  output: jsonValueSchema,
  isError: z.boolean().optional(),
  truncated: z.boolean().optional(),
});
export const chatSummaryPartDtoSchema = z.object({
  type: z.literal("summary"),
  text: z.string(),
  segmentId: z.string(),
  messageCount: z.int().nonnegative(),
  tokensBefore: z.int().nonnegative(),
  tokensAfter: z.int().nonnegative(),
});

export const chatMessageContentPartDtoSchema = z.discriminatedUnion("type", [
  chatTextPartDtoSchema,
  chatReasoningPartDtoSchema,
  chatToolCallPartDtoSchema,
  chatToolResultPartDtoSchema,
  chatSummaryPartDtoSchema,
]);
export const chatMessageContentDtoSchema = z.array(
  chatMessageContentPartDtoSchema,
);

export const runUsageDtoSchema = z.object({
  inputTokens: z.int().nonnegative(),
  outputTokens: z.int().nonnegative(),
  reasoningTokens: z.int().nonnegative(),
  cachedInputTokens: z.int().nonnegative(),
  costUsd: z.number().nonnegative(),
});

export const contextWindowDtoSchema = z.object({
  conversationId: entityIdSchema,
  modelId: z.string(),
  usedTokens: z.int().nonnegative(),
  usableTokens: z.int().nonnegative(),
  compactAtTokens: z.int().nonnegative(),
  contextLength: z.int().nonnegative(),
  estimated: z.boolean(),
});

export const modelSwitchReasonSchema = z.enum([
  "provider_error",
  "rate_limit",
  "auth",
  "context_overflow",
  "output_limit",
  "manual",
]);
export const modelSwitchDtoSchema = z.object({
  from: z.string(),
  to: z.string(),
  reason: modelSwitchReasonSchema,
  detail: z.string(),
  at: z.string(),
});

export const permissionModeSchema = z.enum(["plan", "edit", "deny"]);

export const startRunDtoSchema = z.object({
  conversationId: entityIdSchema.optional(),
  mode: chatModeSchema,
  modelId: entityIdSchema.optional(),
  agentId: z.string().optional(),
  scenarioId: z.string().optional(),
  projectId: entityIdSchema.optional(),
  text: z.string(),
  permissionMode: permissionModeSchema.optional(),
});

export type ChatTextPart = z.infer<typeof chatTextPartDtoSchema>;
export type ChatReasoningPart = z.infer<typeof chatReasoningPartDtoSchema>;
export type ChatToolCallPart = z.infer<typeof chatToolCallPartDtoSchema>;
export type ChatToolResultPart = z.infer<typeof chatToolResultPartDtoSchema>;
export type ChatSummaryPart = z.infer<typeof chatSummaryPartDtoSchema>;
export type ChatMessageContentPart = z.infer<
  typeof chatMessageContentPartDtoSchema
>;
export type RunUsage = z.infer<typeof runUsageDtoSchema>;
export type ModelSwitchReason = z.infer<typeof modelSwitchReasonSchema>;
export type ModelSwitch = z.infer<typeof modelSwitchDtoSchema>;
export type PermissionMode = z.infer<typeof permissionModeSchema>;
export type ContextWindow = z.infer<typeof contextWindowDtoSchema>;
export type StartRunInput = z.infer<typeof startRunDtoSchema>;
