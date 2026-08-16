import { z } from "zod";
import { jsonValueSchema } from "./ipc-dto";

export const attachmentReferenceDtoSchema = z.object({
  kind: z.enum(["photo", "document", "video", "audio", "voice", "file"]),
  id: z.string(),
  uniqueId: z.string().nullable(),
  fileName: z.string().nullable(),
  mimeType: z.string().nullable(),
  size: z.number().int().nonnegative().nullable(),
});

export const telegramMessageEntityDtoSchema = z.object({
  type: z.literal("telegram_message"),
  updateId: z.number().int().nonnegative(),
  messageId: z.number().int().positive(),
  sentAt: z.string(),
  text: z.string(),
  chat: z.object({
    id: z.string(),
    type: z.string(),
    title: z.string().nullable(),
    username: z.string().nullable(),
  }),
  sender: z
    .object({
      id: z.string(),
      username: z.string().nullable(),
      firstName: z.string().nullable(),
      lastName: z.string().nullable(),
      isBot: z.boolean(),
    })
    .nullable(),
  replyToMessageId: z.number().int().positive().nullable(),
  attachments: z.array(attachmentReferenceDtoSchema),
});

const emailAddressSchema = z.object({
  name: z.string().nullable(),
  address: z.string(),
});

export const emailMessageEntityDtoSchema = z.object({
  type: z.literal("email_message"),
  uid: z.number().int().positive(),
  messageId: z.string().nullable(),
  sentAt: z.string().nullable(),
  subject: z.string(),
  from: z.array(emailAddressSchema),
  to: z.array(emailAddressSchema),
  cc: z.array(emailAddressSchema),
  text: z.string(),
  inReplyTo: z.string().nullable(),
  attachments: z.array(attachmentReferenceDtoSchema),
});

export const chatMessageEntityDtoSchema = z.object({
  type: z.literal("chat_message"),
  conversationId: z.number().int().positive(),
  messageId: z.number().int().positive(),
  text: z.string(),
  attachments: z.array(attachmentReferenceDtoSchema),
});

export const scenarioMessageTriggerInputDtoSchema = z.discriminatedUnion(
  "trigger",
  [
    z.object({
      trigger: z.literal("telegram"),
      integrationProfileId: z.number().int().positive(),
      triggerBindingId: z.string(),
      entity: telegramMessageEntityDtoSchema,
    }),
    z.object({
      trigger: z.literal("email"),
      integrationProfileId: z.number().int().positive(),
      triggerBindingId: z.string(),
      entity: emailMessageEntityDtoSchema,
    }),
    z.object({
      trigger: z.literal("chat"),
      triggerBindingId: z.string(),
      entity: chatMessageEntityDtoSchema,
    }),
  ],
);

/**
 * Полезная нагрузка запуска сценария. Триггеры из почты и Telegram имеют
 * строгую форму; ручной запуск из редактора присылает произвольный объект,
 * поэтому он проверяется только на то, что это безопасный JSON.
 */
export const scenarioTriggerInputDtoSchema = z.union([
  scenarioMessageTriggerInputDtoSchema,
  jsonValueSchema,
]);
export type ScenarioTriggerInput = z.infer<typeof scenarioTriggerInputDtoSchema>;

export type TelegramMessageEntity = z.infer<
  typeof telegramMessageEntityDtoSchema
>;
export type EmailMessageEntity = z.infer<typeof emailMessageEntityDtoSchema>;
export type ChatMessageEntity = z.infer<typeof chatMessageEntityDtoSchema>;
export type ScenarioMessageTriggerInput = z.infer<
  typeof scenarioMessageTriggerInputDtoSchema
>;
export type AttachmentReference = z.infer<typeof attachmentReferenceDtoSchema>;

export const scenarioFileReferenceDtoSchema = z.object({
  id: z.number().int().positive(),
  fileName: z.string(),
  mimeType: z.string().nullable(),
  size: z.number().int().nonnegative(),
  sha256: z.string(),
  storageKey: z.string(),
});
export type ScenarioFileReference = z.infer<
  typeof scenarioFileReferenceDtoSchema
>;
