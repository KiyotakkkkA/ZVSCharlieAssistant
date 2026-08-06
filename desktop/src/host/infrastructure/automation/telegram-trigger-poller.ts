import type { SecretStorageRepository } from "../../application/ports/secret-storage.repository";
import type { AutomationJobDataSource } from "../database/automation-job.data-source";
import type { IntegrationDataSource } from "../database/integration.data-source";

type TelegramUpdate = {
  update_id: number;
  message?: {
    message_id: number;
    text?: string;
    caption?: string;
    chat: { id: number; type: string };
    from?: { id: number; username?: string; first_name?: string };
  };
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
                text,
                chatId: message.chat.id,
                messageId: message.message_id,
                sender: message.from ?? null,
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
