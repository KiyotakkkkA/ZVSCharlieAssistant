import { z } from "zod";

export const terminalConfirmationModeSchema = z.enum([
  "always",
  "risky",
  "policy",
]);
export const agentTerminalPolicyDtoSchema = z.object({
  enabled: z.boolean(),
  confirmationMode: terminalConfirmationModeSchema,
  timeoutSeconds: z.int().positive(),
  allowedCommands: z.array(z.string()),
});
export const upsertTerminalPolicyDtoSchema = z.object({
  enabled: z.boolean(),
  confirmationMode: terminalConfirmationModeSchema,
  maxConcurrentSessions: z.int().positive(),
  defaultTimeoutSeconds: z.int().positive(),
  maxTimeoutSeconds: z.int().positive(),
  maxOutputBytes: z.int().positive(),
  allowNetwork: z.boolean(),
  allowedCommands: z.array(z.string()),
});
export const terminalPolicyDtoSchema = upsertTerminalPolicyDtoSchema.extend({
  updatedAt: z.string(),
});

export type TerminalConfirmationMode = z.infer<
  typeof terminalConfirmationModeSchema
>;
export type AgentTerminalPolicy = z.infer<typeof agentTerminalPolicyDtoSchema>;
export type UpsertTerminalPolicyInput = z.infer<
  typeof upsertTerminalPolicyDtoSchema
>;
