import type { SecretStorageRepository } from "../../application/ports/secret-storage.repository";
import type { AutomationJobDataSource } from "../database/automation-job.data-source";
import type { IntegrationDataSource } from "../database/integration.data-source";
import type { TelegramMessageEntity } from "../../../shared/dto/scenario-trigger-event.dto";

type TelegramUpdate = {
  update_id: number;
  message?: {
    message_id: number;
    date: number;
    text?: string;
    caption?: string;
    chat: { id: number; type: string; title?: string; username?: string };
    from?: { id: number; username?: string; first_name?: string; last_name?: string; is_bot?: boolean };
    reply_to_message?: { message_id: number };
    photo?: Array<{ file_id: string; file_unique_id?: string; file_size?: number }>;
    document?: TelegramFile;
    video?: TelegramFile;
    audio?: TelegramFile;
    voice?: TelegramFile;
  };
};

type TelegramFile = {
  file_id: string;
  file_unique_id?: string;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
};

export class TelegramTriggerPoller {
  constructor(
    private readonly integrations: IntegrationDataSource,
    private readonly jobs: AutomationJobDataSource,
    private readonly secrets: SecretStorageRepository,
  ) {}

  async poll(): Promise<void> {
    const profiles = new Map(this.integrations.snapshot().profiles.map((item) => [item.id, item]));
    for (const binding of this.integrations.bindings("telegram")) {
      const profile = profiles.get(binding.integrationProfileId!);
      const secretId = profile?.secretBindings.botToken;
      const token = secretId ? this.secrets.getSecret(secretId)?.content : undefined;
      if (!profile || !token) continue;
      const cursor = this.integrations.cursor(binding.id);
      const offset = Number(cursor.updateId ?? 0) + 1;
      try {
        const response = await fetch(
          `https://api.telegram.org/bot${token}/getUpdates?timeout=0&limit=50&offset=${offset}`,
          { signal: AbortSignal.timeout(10_000) },
        );
        const payload = await response.json() as { ok?: boolean; result?: TelegramUpdate[]; description?: string };
        if (!response.ok || !payload.ok) throw new Error(payload.description ?? `Telegram HTTP ${response.status}`);
        let lastUpdateId = Number(cursor.updateId ?? 0);
        for (const update of payload.result ?? []) {
          lastUpdateId = Math.max(lastUpdateId, update.update_id);
          const message = update.message;
          if (!message) continue;
          const allowed = binding.config.allowedChatIds as string[] | undefined;
          if (allowed?.length && !allowed.includes(String(message.chat.id))) continue;
          const text = message.text ?? message.caption ?? "";
          const command = String(binding.config.command ?? "").trim();
          if (command && !text.startsWith(command)) continue;
          this.jobs.enqueue(
            "scenario_run",
            `telegram:${profile.id}:${update.update_id}`,
            {
              scenarioId: binding.scenarioId,
              scenarioRevisionId: binding.scenarioRevisionId,
              triggerBindingId: binding.id,
              input: {
                trigger: "telegram",
                integrationProfileId: profile.id,
                triggerBindingId: binding.id,
                entity: toTelegramMessageEntity(update, message, text),
              },
            },
          );
        }
        this.integrations.setCursor(binding.id, { updateId: lastUpdateId });
      } catch (error) {
        this.integrations.setCursor(binding.id, cursor, error instanceof Error ? error.message : "Ошибка Telegram");
      }
    }
  }
}

function toTelegramMessageEntity(
  update: TelegramUpdate,
  message: NonNullable<TelegramUpdate["message"]>,
  text: string,
): TelegramMessageEntity {
  const attachments: TelegramMessageEntity["attachments"] = [];
  const photo = message.photo?.at(-1);
  if (photo)
    attachments.push({
      kind: "photo",
      id: photo.file_id,
      uniqueId: photo.file_unique_id ?? null,
      fileName: null,
      mimeType: "image/jpeg",
      size: photo.file_size ?? null,
    });
  for (const [kind, file] of [
    ["document", message.document],
    ["video", message.video],
    ["audio", message.audio],
    ["voice", message.voice],
  ] as const) {
    if (!file) continue;
    attachments.push({
      kind,
      id: file.file_id,
      uniqueId: file.file_unique_id ?? null,
      fileName: file.file_name ?? null,
      mimeType: file.mime_type ?? null,
      size: file.file_size ?? null,
    });
  }
  return {
    type: "telegram_message",
    updateId: update.update_id,
    messageId: message.message_id,
    sentAt: new Date(message.date * 1000).toISOString(),
    text,
    chat: {
      id: String(message.chat.id),
      type: message.chat.type,
      title: message.chat.title ?? null,
      username: message.chat.username ?? null,
    },
    sender: message.from
      ? {
          id: String(message.from.id),
          username: message.from.username ?? null,
          firstName: message.from.first_name ?? null,
          lastName: message.from.last_name ?? null,
          isBot: Boolean(message.from.is_bot),
        }
      : null,
    replyToMessageId: message.reply_to_message?.message_id ?? null,
    attachments,
  };
}
