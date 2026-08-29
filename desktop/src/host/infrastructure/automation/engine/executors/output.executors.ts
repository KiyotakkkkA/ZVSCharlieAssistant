import { toText } from "../../../../../shared/expressions";
import {
  isRecord,
  type ScenarioBinaryRef,
} from "../../../../../shared/scenario/items";
import type { NodeExecutor } from "../../../../../shared/scenario/node-descriptor";
import type { ScenarioEngineServices } from "../services";

interface ResponseChannelConfig {
  channel: "telegram" | "email";
  enabled: boolean;
  mode: "reply_to_trigger" | "explicit_recipient";
  integrationProfileId: string | null;
  recipient: string;
  subject: string;
  attachFiles: boolean;
}

interface OutputConfig {
  text: string;
  channels: ResponseChannelConfig[];
  saveArtifact: boolean;
  artifactFileName: string;
}

export function createOutputExecutor(
  services: ScenarioEngineServices,
): NodeExecutor<OutputConfig, unknown> {
  return {
    kind: "output",
    async execute(context) {
      const config = context.config;
      const text = config.text.trim() || defaultText(context.items[0]?.json);
      const attachments: ScenarioBinaryRef[] = [];
      for (const item of context.inputs.files ?? [])
        if (item.binary) attachments.push(...Object.values(item.binary));

      services.deliverResponse({
        executionId: context.executionId,
        nodeRunId: context.nodeRunId,
        config: { channels: config.channels },
        triggerInput: context.scope().$trigger,
        output: text,
        attachments,
      });

      if (config.saveArtifact) {
        const fileName =
          config.artifactFileName.trim() ||
          `run-${context.executionId}-${context.node.id}.txt`;
        context.logger.info("scenario.output.artifact_requested", { fileName });
      }

      return {
        items: [{ json: { text } }],
        diagnostics: {
          textLength: text.length,
          channels: config.channels.filter((channel) => channel.enabled).length,
        },
      };
    },
  };
}

function defaultText(value: unknown): string {
  if (typeof value === "string") return value;
  if (isRecord(value) && typeof value.text === "string") return value.text;
  return toText(value);
}
