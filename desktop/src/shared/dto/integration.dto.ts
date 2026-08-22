import { z } from "zod";
import { entityIdSchema } from "./ipc-dto";

export const integrationKindSchema = z.enum([
  "telegram_bot",
  "email_imap",
  "github_connector",
  "gitlab_connector",
]);

export const upsertIntegrationProfileDtoSchema = z.object({
  id: entityIdSchema.optional(),
  kind: integrationKindSchema,
  name: z.string().trim().min(1).max(120),
  enabled: z.boolean(),
  config: z.object({
    botProvider: z.literal("telegram").optional(),
    connectorProvider: z.enum(["github", "gitlab"]).optional(),
    repositoryUrl: z.url().max(500).optional(),
    host: z.string().trim().max(500).optional(),
    port: z.int().positive().max(65535).optional(),
    secure: z.boolean().optional(),
    username: z.string().trim().max(320).optional(),
    mailbox: z.string().trim().max(255).optional(),
    smtpHost: z.string().trim().max(500).optional(),
    smtpPort: z.int().positive().max(65535).optional(),
    smtpSecure: z.boolean().optional(),
    smtpFrom: z.string().trim().email().max(320).optional(),
  }),
  secretBindings: z.record(z.string(), entityIdSchema),
});

export type IntegrationKind = z.infer<typeof integrationKindSchema>;
export type UpsertIntegrationProfileInput = z.infer<
  typeof upsertIntegrationProfileDtoSchema
>;
