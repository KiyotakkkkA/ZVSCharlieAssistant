import { z } from "zod";
import { entityIdSchema } from "../../dto/ipc-dto";
import { mainOutput, type ScenarioNodeDescriptor } from "../node-descriptor";

const manualConfigSchema = z.object({
  fromEditor: z.boolean().default(true),
  fromChat: z.boolean().default(true),
  inputFields: z
    .array(
      z.object({
        name: z.string().min(1).max(80),
        label: z.string().max(120).default(""),
        type: z.enum(["string", "number", "boolean", "json"]).default("string"),
        required: z.boolean().default(false),
        defaultValue: z.string().default(""),
      }),
    )
    .default([]),
});

export const manualTriggerDescriptor: ScenarioNodeDescriptor<
  z.infer<typeof manualConfigSchema>
> = {
  kind: "trigger.manual",
  label: "Ручной запуск",
  category: "trigger",
  description: "Запуск из редактора или из чата",
  icon: "play",
  accent: "#475569",
  configSchema: manualConfigSchema,
  defaultConfig: () => ({ fromEditor: true, fromChat: true, inputFields: [] }),
  inputs: [],
  outputs: [mainOutput({ label: "Запуск" })],
  itemMode: "collection",
  isTrigger: true,
};

const intervalConfigSchema = z.object({
  intervalSeconds: z.int().min(60).max(31_536_000).default(3_600),
  timezone: z.string().default("Europe/Moscow"),
  misfirePolicy: z.enum(["skip", "run_once", "catch_up"]).default("run_once"),
  catchUpLimit: z.int().min(1).max(50).default(3),
  preventOverlap: z.boolean().default(true),
});

export const intervalTriggerDescriptor: ScenarioNodeDescriptor<
  z.infer<typeof intervalConfigSchema>
> = {
  kind: "trigger.interval",
  label: "По расписанию",
  category: "trigger",
  description: "Запуск через равные промежутки времени",
  documentation:
    "Если приложение было выключено и время запуска прошло: «Пропустить» — не навёрстывать, «Один раз» — выполнить один раз, «Догнать» — выполнить пропущенные запуски, но не больше указанного количества за одну проверку.",
  icon: "clock",
  accent: "#475569",
  configSchema: intervalConfigSchema,
  defaultConfig: () => ({
    intervalSeconds: 3_600,
    timezone: "Europe/Moscow",
    misfirePolicy: "run_once",
    catchUpLimit: 3,
    preventOverlap: true,
  }),
  inputs: [],
  outputs: [mainOutput({ label: "Срабатывание" })],
  itemMode: "collection",
  isTrigger: true,
};

const telegramConfigSchema = z.object({
  integrationProfileId: entityIdSchema,
  allowedChatIds: z.array(z.string()).default([]),
  allowAnyChat: z.boolean().default(false),
  command: z.string().max(64).default(""),
  includeAttachments: z.boolean().default(true),
  ignoreBots: z.boolean().default(true),
});

export const telegramTriggerDescriptor: ScenarioNodeDescriptor<
  z.infer<typeof telegramConfigSchema>
> = {
  kind: "trigger.telegram",
  label: "Сообщение в Telegram",
  category: "trigger",
  description: "Запуск по входящему сообщению бота",
  icon: "telegram",
  accent: "#475569",
  configSchema: telegramConfigSchema,
  defaultConfig: () => ({
    integrationProfileId: "",
    allowedChatIds: [],
    allowAnyChat: false,
    command: "",
    includeAttachments: true,
    ignoreBots: true,
  }),
  inputs: [],
  outputs: [mainOutput({ label: "Сообщение" })],
  itemMode: "collection",
  isTrigger: true,
  validate: ({ node }) => {
    const config = node.config as {
      integrationProfileId?: string;
      allowedChatIds?: string[];
      allowAnyChat?: boolean;
    };
    const issues = [];
    if (!config.integrationProfileId)
      issues.push({
        nodeId: node.id,
        severity: "error" as const,
        message: `У узла «${node.name}» не выбрано подключение Telegram`,
      });
    if (!config.allowAnyChat && !(config.allowedChatIds?.length ?? 0))
      issues.push({
        nodeId: node.id,
        severity: "warning" as const,
        message: `У узла «${node.name}» не задан ни один разрешённый чат — триггер не сработает ни разу. Добавьте чат или включите «разрешить любой чат».`,
      });
    return issues;
  },
};

const emailConfigSchema = z.object({
  integrationProfileId: entityIdSchema,
  mailbox: z.string().default("INBOX"),
  from: z.string().max(320).default(""),
  subjectContains: z.string().max(320).default(""),
  unreadOnly: z.boolean().default(true),
  includeAttachments: z.boolean().default(true),
  markAsRead: z.boolean().default(false),
});

export const emailTriggerDescriptor: ScenarioNodeDescriptor<
  z.infer<typeof emailConfigSchema>
> = {
  kind: "trigger.email",
  label: "Входящее письмо",
  category: "trigger",
  description: "Запуск по письму в почтовом ящике",
  icon: "mail",
  accent: "#475569",
  configSchema: emailConfigSchema,
  defaultConfig: () => ({
    integrationProfileId: "",
    mailbox: "INBOX",
    from: "",
    subjectContains: "",
    unreadOnly: true,
    includeAttachments: true,
    markAsRead: false,
  }),
  inputs: [],
  outputs: [mainOutput({ label: "Письмо" })],
  itemMode: "collection",
  isTrigger: true,
  validate: ({ node }) => {
    if (
      !(node.config as { integrationProfileId?: string }).integrationProfileId
    )
      return [
        {
          nodeId: node.id,
          severity: "error",
          message: `У узла «${node.name}» не выбрано почтовое подключение`,
        },
      ];
    return [];
  },
};

export const TRIGGER_DESCRIPTORS = [
  manualTriggerDescriptor,
  intervalTriggerDescriptor,
  telegramTriggerDescriptor,
  emailTriggerDescriptor,
] as unknown as Array<ScenarioNodeDescriptor<never>>;
