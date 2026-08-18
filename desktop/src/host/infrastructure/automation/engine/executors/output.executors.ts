import { toText } from "../../../../../shared/expressions";
import { isRecord } from "../../../../../shared/scenario/items";
import type { NodeExecutor } from "../../../../../shared/scenario/node-descriptor";
import type { ScenarioEngineServices } from "../services";

interface ResponseChannelConfig {
  channel: "telegram" | "email";
  enabled: boolean;
  mode: "reply_to_trigger" | "explicit_recipient";
  integrationProfileId: number | null;
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

      services.deliverResponse({
        executionId: context.executionId,
        nodeRunId: context.nodeRunId,
        config: { channels: config.channels },
        triggerInput: context.scope().$trigger,
        output: text,
      });

      if (config.saveArtifact) {
        const fileName =
          config.artifactFileName.trim() ||
          `run-${context.executionId}-${context.node.id}.txt`;
        context.logger.info("scenario.output.artifact_requested", { fileName });
      }

      // The node is terminal, so nothing downstream consumes these items —
      // they are what gets recorded as the result of the run. Report the text
      // that was actually delivered, not the raw input that produced it.
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
