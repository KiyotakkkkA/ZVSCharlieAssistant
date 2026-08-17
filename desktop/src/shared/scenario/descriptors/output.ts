import { z } from "zod";
import { exprText } from "../config-fields";
import { mainInput, type ScenarioNodeDescriptor } from "../node-descriptor";

export const responseChannelSchema = z.object({
  channel: z.enum(["telegram", "email"]),
  enabled: z.boolean().default(true),
  mode: z
    .enum(["reply_to_trigger", "explicit_recipient"])
    .default("reply_to_trigger"),
  integrationProfileId: z.int().positive().nullable().default(null),
  recipient: exprText(),
  subject: exprText(),
  attachFiles: z.boolean().default(false),
});

const outputConfigSchema = z.object({
  text: exprText(),
  channels: z.array(responseChannelSchema).default([]),
  saveArtifact: z.boolean().default(false),
  artifactFileName: exprText(),
});

export const outputDescriptor: ScenarioNodeDescriptor<
  z.infer<typeof outputConfigSchema>
> = {
  kind: "output",
  label: "Результат",
  category: "output",
  description: "Завершает ветку и отправляет ответ по выбранным каналам",
  documentation:
    "Отправка идёт через очередь с ключом идемпотентности, привязанным к узлу, а не к попытке. " +
    "Поэтому повтор узла после сбоя не приводит к повторному письму.",
  icon: "output",
  accent: "#be123c",
  configSchema: outputConfigSchema,
  defaultConfig: () => ({
    text: "{{ $json.text }}",
    channels: [],
    saveArtifact: false,
    artifactFileName: "",
  }),
  inputs: [mainInput({ label: "Результат" })],
  outputs: [],
  itemMode: "collection",
  isTerminal: true,
  validate: ({ node }) => {
    const config = node.config as { channels?: Array<Record<string, unknown>> };
    const issues = [];
    for (const channel of config.channels ?? []) {
      if (channel.enabled === false) continue;
      if (
        channel.mode === "explicit_recipient" &&
        (!channel.integrationProfileId ||
          !String(channel.recipient ?? "").trim())
      )
        issues.push({
          nodeId: node.id,
          severity: "error" as const,
          message: `Для канала «${String(channel.channel)}» узла «${node.name}» нужно выбрать подключение и получателя`,
        });
    }
    return issues;
  },
};

const noopConfigSchema = z.object({ label: z.string().max(200).default("") });

export const noopDescriptor: ScenarioNodeDescriptor<
  z.infer<typeof noopConfigSchema>
> = {
  kind: "noop",
  label: "Заглушка",
  category: "output",
  description: "Ничего не делает, пропускает данные насквозь",
  documentation:
    "Удобна как точка сборки веток и как временная затычка при отладке.",
  icon: "dot",
  accent: "#64748b",
  configSchema: noopConfigSchema,
  defaultConfig: () => ({ label: "" }),
  inputs: [mainInput()],
  outputs: [
    {
      id: "main",
      label: "Выход",
      dataKind: "main",
      side: "right",
      multiple: true,
    },
  ],
  itemMode: "collection",
  idempotent: true,
};

export const OUTPUT_DESCRIPTORS = [
  outputDescriptor,
  noopDescriptor,
] as unknown as Array<ScenarioNodeDescriptor<never>>;
