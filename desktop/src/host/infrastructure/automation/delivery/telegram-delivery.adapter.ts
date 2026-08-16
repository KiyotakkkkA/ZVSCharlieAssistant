import type { IntegrationRepository } from "../../database/integration.repository";
import type { SecretStorageRepository } from "../../database/secret-storage.repository";
import type { ScenarioDeliveryJob } from "../../database/scenario-delivery.repository";
import type { ScenarioDeliveryAdapter } from "./scenario-delivery.adapter";

export class TelegramDeliveryAdapter implements ScenarioDeliveryAdapter {
  readonly channel = "telegram" as const;
  constructor(
    private integrations: IntegrationRepository,
    private secrets: SecretStorageRepository,
  ) {}

  async deliver(job: ScenarioDeliveryJob) {
    const profile = this.integrations.findProfile(job.integrationProfileId);
    if (
      !profile ||
      profile.kind !== "telegram_bot" ||
      !profile.enabled ||
      profile.status !== "connected"
    )
      throw new Error("Telegram-интеграция недоступна");
    const tokenId = profile.secretBindings.botToken;
    const token = tokenId
      ? this.secrets.findSecret(tokenId)?.content
      : undefined;
    if (!token) throw new Error("Не найден токен Telegram-бота");
    const telegramHtml = this.sanitizeMarkdownToTelegramHtml(
      String(job.payload.text ?? ""),
    );
    const chunks = splitTelegram(telegramHtml);
    await this.sendTypingStatus(token, job.recipient);
    for (let index = 0; index < chunks.length; index++) {
      if (index > 0) {
        await this.sendTypingStatus(token, job.recipient);
      }
      const response = await fetch(
        `https://api.telegram.org/bot${token}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: AbortSignal.timeout(20_000),
          body: JSON.stringify({
            chat_id: job.recipient,
            text: chunks[index],
            parse_mode: "HTML",
            ...(index === 0 && Number(job.payload.replyToMessageId)
              ? {
                  reply_parameters: {
                    message_id: Number(job.payload.replyToMessageId),
                  },
                }
              : {}),
          }),
        },
      );
      const result = (await response.json()) as {
        ok?: boolean;
        description?: string;
      };
      if (!response.ok || !result.ok)
        throw new Error(
          redactToken(
            result.description ?? `Telegram HTTP ${response.status}`,
            token,
          ),
        );
    }
  }

  private async sendTypingStatus(token: string, chatId: string) {
    await fetch(`https://api.telegram.org/bot${token}/sendChatAction`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(5_000),
      body: JSON.stringify({
        chat_id: chatId,
        action: "typing",
      }),
    });
  }

  private sanitizeMarkdownToTelegramHtml(md: string): string {
    let text = md
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    const lines = text.split("\n");
    const processedLines = lines.map((line) => {
      const trimmed = line.trim();
      if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
        if (/^[\s\|\-\:]+$/.test(trimmed)) return "";
        return trimmed
          .replace(/^\||\|$/g, "")
          .split("|")
          .map((c) => c.trim())
          .join(" | ");
      }
      return line;
    });
    text = processedLines.join("\n");
    text = text.replace(/^#+\s+(.+)$/gm, "<b>$1</b>");
    text = text.replace(/^---+$/gm, "\n");
    text = text.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
    text = text.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, "<i>$1</i>");
    text = text.replace(
      /```[\s\S]*?\n([\s\S]*?)```/g,
      "<pre><code>$1</code></pre>",
    );
    text = text.replace(/`([^`]+)`/g, "<code>$1</code>");
    text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
    text = text.replace(/^[\s]*[-*]\s+/gm, "• ");
    return text;
  }
}

function redactToken(message: string, token: string) {
  return token ? message.split(token).join("***") : message;
}

function splitTelegram(text: string) {
  const result: string[] = [];
  for (let rest = text; rest.length;) {
    if (rest.length <= 4000) {
      result.push(rest);
      break;
    }
    let end = rest.lastIndexOf("\n", 4000);
    if (end < 1000) end = 4000;
    result.push(rest.slice(0, end));
    rest = rest.slice(end).trimStart();
  }
  return result.length ? result : [" "];
}
