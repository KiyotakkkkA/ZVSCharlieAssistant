import { scenarioResponseConfigDtoSchema } from "../../../shared/dto";
import { scenarioMessageTriggerInputDtoSchema } from "../../../shared/dto/scenario-trigger-event.dto";
import type { ScenarioDeliveryRepository } from "../database/scenario-delivery.repository";

export class ScenarioResponseService {
  constructor(private readonly deliveries: ScenarioDeliveryRepository) {}

  enqueue(input: {
    executionId: number;
    nodeRunId: number;
    config: unknown;
    triggerInput: unknown;
    output: unknown;
  }) {
    const parsedConfig = scenarioResponseConfigDtoSchema.safeParse(
      input.config,
    );
    if (!parsedConfig.success) return;
    const trigger = scenarioMessageTriggerInputDtoSchema.safeParse(
      input.triggerInput,
    );
    const text = outputText(input.output);
    if (!text) return;

    for (const channel of parsedConfig.data.channels.filter(
      (item) => item.enabled,
    )) {
      let profileId = channel.integrationProfileId;
      let recipient = channel.recipient.trim();
      const payload: Record<string, unknown> = { text };
      if (channel.mode === "reply_to_trigger") {
        if (!trigger.success || trigger.data.trigger !== channel.channel)
          continue;
        profileId = trigger.data.integrationProfileId;
        if (trigger.data.trigger === "telegram") {
          recipient = trigger.data.entity.chat.id;
          payload.replyToMessageId = trigger.data.entity.messageId;
        } else {
          recipient = trigger.data.entity.from[0]?.address ?? "";
          payload.subject = replySubject(trigger.data.entity.subject);
          payload.inReplyTo = trigger.data.entity.messageId;
        }
      } else if (channel.channel === "email")
        payload.subject = "Ответ ZVS Assistant";
      if (!profileId || !recipient) continue;
      this.deliveries.enqueue({
        executionId: input.executionId,
        nodeRunId: input.nodeRunId,
        channel: channel.channel,
        integrationProfileId: profileId,
        recipient,
        payload,
        idempotencyKey: `${input.executionId}:${input.nodeRunId}:${channel.channel}:${profileId}:${recipient}`,
      });
    }
  }
}

function outputText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (
    value &&
    typeof value === "object" &&
    "text" in value &&
    typeof value.text === "string"
  )
    return value.text.trim();
  return value === undefined || value === null ? "" : JSON.stringify(value);
}

function replySubject(value: string | null) {
  const subject = value?.trim() || "Сообщение";
  return /^re:/i.test(subject) ? subject : `Re: ${subject}`;
}
