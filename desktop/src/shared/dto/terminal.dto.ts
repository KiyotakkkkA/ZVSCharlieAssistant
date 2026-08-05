import { z } from "zod";

export const terminalConfirmationModeSchema = z.enum([
  "always",
  "risky",
  "policy",
]);
export const terminalPermissionSchema = z.enum([
  "read",
  "create",
  "modify",
  "delete",
  "execute",
]);
export const terminalDirectoryGrantDtoSchema = z.object({
  id: z.int().positive().optional(),
  path: z.string(),
  recursive: z.boolean(),
  permissions: z.array(terminalPermissionSchema),
});
export const agentTerminalPolicyDtoSchema = z.object({
  enabled: z.boolean(),
  confirmationMode: terminalConfirmationModeSchema,
  timeoutSeconds: z.int().positive(),
  allowedCommands: z.array(z.string()),
  directoryGrants: z.array(terminalDirectoryGrantDtoSchema),
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
  directoryGrants: z.array(terminalDirectoryGrantDtoSchema),
});
export const terminalPolicyDtoSchema = upsertTerminalPolicyDtoSchema.extend({
  updatedAt: z.string(),
});

export type TerminalConfirmationMode = z.infer<
  typeof terminalConfirmationModeSchema
>;
export type TerminalPermission = z.infer<typeof terminalPermissionSchema>;
export type TerminalDirectoryGrant = z.infer<
  typeof terminalDirectoryGrantDtoSchema
>;
export type AgentTerminalPolicy = z.infer<typeof agentTerminalPolicyDtoSchema>;
export type UpsertTerminalPolicyInput = z.infer<
  typeof upsertTerminalPolicyDtoSchema
>;
