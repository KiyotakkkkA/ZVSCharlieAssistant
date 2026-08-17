import type {
  DueTriggerBinding,
  IntegrationRepository,
} from "../../database/integration.repository";
import type { TelegramMessageEntity } from "../../../../shared/dto/scenario-trigger-event.dto";
import { AutomationJobRepository } from "@host/infrastructure/database/automation-job.repository";
import { SecretStorageRepository } from "@host/infrastructure/database/secret-storage.repository";
import type { UserQuestionService } from "@host/application/services/user-question.service";

type TelegramUpdate = {
  update_id: number;
  message?: {
    message_id: number;
    date: number;
    text?: string;
    caption?: string;
    chat: { id: number; type: string; title?: string; username?: string };
    from?: {
      id: number;
      username?: string;
      first_name?: string;
      last_name?: string;
      is_bot?: boolean;
    };
    reply_to_message?: { message_id: number };
    photo?: Array<{
      file_id: string;
      file_unique_id?: string;
      file_size?: number;
    }>;
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

type WatchHandle = { controller: AbortController; task: Promise<void> };

export class TelegramWatchListener {
  private readonly watches = new Map<number, WatchHandle>();
  private reconcileTimer?: NodeJS.Timeout;
  private stopped = true;

  constructor(
    private readonly integrations: IntegrationRepository,
    private readonly jobs: AutomationJobRepository,
    private readonly secrets: SecretStorageRepository,
    private readonly questions: UserQuestionService,
  ) {}

  start(): void {
    if (!this.stopped) return;
    this.stopped = false;
    this.reconcile();
    this.reconcileTimer = setInterval(() => this.reconcile(), 5_000);
    this.reconcileTimer.unref();
  }

  stop(): void {
    this.stopped = true;
    if (this.reconcileTimer) clearInterval(this.reconcileTimer);
    this.reconcileTimer = undefined;
    for (const watch of this.watches.values()) watch.controller.abort();
    this.watches.clear();
  }

  private reconcile(): void {
    if (this.stopped) return;
    const profileIds = new Set(
      this.integrations
        .bindings("telegram")
        .map((binding) => binding.integrationProfileId)
        .filter((id): id is number => id !== null),
    );
    for (const [profileId, watch] of this.watches) {
      if (profileIds.has(profileId)) continue;
      watch.controller.abort();
      this.watches.delete(profileId);
    }
    for (const profileId of profileIds) {
      if (this.watches.has(profileId)) continue;
      const controller = new AbortController();
      const task = this.watchProfile(profileId, controller.signal).finally(
        () => {
          if (this.watches.get(profileId)?.controller === controller)
            this.watches.delete(profileId);
        },
      );
      this.watches.set(profileId, { controller, task });
    }
  }

  private async watchProfile(
    profileId: number,
    signal: AbortSignal,
  ): Promise<void> {
    let retryDelay = 1_000;
    while (!signal.aborted && !this.stopped) {
      const bindings = this.profileBindings(profileId);
      if (!bindings.length) return;
      const profile = this.integrations
        .snapshot()
        .profiles.find((item) => item.id === profileId);
      const secretId = profile?.secretBindings.botToken;
      const token = secretId
        ? this.secrets.findSecret(secretId)?.content
        : undefined;
      if (!profile || !token) {
        this.setBindingsError(bindings, "Не настроен токен Telegram-бота");
        await abortableDelay(5_000, signal);
        continue;
      }
      const offset = Math.min(
        ...bindings.map(
          (binding) =>
            Number(this.integrations.cursor(binding.id).updateId ?? 0) + 1,
        ),
      );
      try {
        const response = await fetch(
          `https://api.telegram.org/bot${token}/getUpdates?timeout=50&limit=100&offset=${offset}`,
          { signal: AbortSignal.any([signal, AbortSignal.timeout(60_000)]) },
        );
        const payload = (await response.json()) as {
          ok?: boolean;
          result?: TelegramUpdate[];
          description?: string;
        };
        if (!response.ok || !payload.ok)
          throw new Error(
            payload.description ?? `Telegram HTTP ${response.status}`,
          );
        this.dispatch(profileId, bindings, payload.result ?? [], token);
        retryDelay = 1_000;
      } catch (error) {
        if (signal.aborted) return;
        this.setBindingsError(
          bindings,
          error instanceof Error ? error.message : "Ошибка Telegram",
        );
        await abortableDelay(retryDelay, signal);
        retryDelay = Math.min(retryDelay * 2, 30_000);
      }
    }
  }

  private dispatch(
    profileId: number,
    bindings: DueTriggerBinding[],
    updates: TelegramUpdate[],
    token: string,
  ): void {
    const consumed = new Set<number>();
    for (const update of updates) {
      const message = update.message;
      const text = (message?.text ?? message?.caption ?? "").trim();
      if (!message || !text) continue;
      const answered = this.questions.resolveExternal({
        channel: "telegram",
        recipient: String(message.chat.id),
        authorId: message.from?.id ? String(message.from.id) : null,
        replyToId: message.reply_to_message?.message_id
          ? String(message.reply_to_message.message_id)
          : null,
        text,
      });
      if (answered) consumed.add(update.update_id);
    }
    for (const binding of bindings) {
      let lastUpdateId = Number(
        this.integrations.cursor(binding.id).updateId ?? 0,
      );
      for (const update of updates) {
        if (update.update_id <= lastUpdateId) continue;
        lastUpdateId = update.update_id;
        if (consumed.has(update.update_id)) continue;
        const message = update.message;
        if (!message || !matchesBinding(binding, message)) continue;
        const text = message.text ?? message.caption ?? "";
        this.jobs.enqueue(
          "scenario_run",
          `telegram:${profileId}:${binding.id}:${update.update_id}`,
          {
            scenarioId: binding.scenarioId,
            scenarioRevisionId: binding.scenarioRevisionId,
            triggerBindingId: binding.id,
            input: {
              trigger: "telegram",
              integrationProfileId: profileId,
              triggerBindingId: binding.id,
              entity: toTelegramMessageEntity(update, message, text),
            },
          },
        );
      }
      this.integrations.setCursor(binding.id, { updateId: lastUpdateId });
    }
  }

  private profileBindings(profileId: number): DueTriggerBinding[] {
    return this.integrations
      .bindings("telegram")
      .filter((binding) => binding.integrationProfileId === profileId);
  }

  private setBindingsError(
    bindings: DueTriggerBinding[],
    message: string,
  ): void {
    for (const binding of bindings)
      this.integrations.setCursor(
        binding.id,
        this.integrations.cursor(binding.id),
        message,
      );
  }
}

function matchesBinding(
  binding: DueTriggerBinding,
  message: NonNullable<TelegramUpdate["message"]>,
): boolean {
  const config = binding.config as {
    allowedChatIds?: string[];
    allowAnyChat?: boolean;
    command?: string;
    ignoreBots?: boolean;
  };
  if (config.ignoreBots !== false && message.from?.is_bot) return false;
  if (!config.allowAnyChat) {
    const allowed = config.allowedChatIds ?? [];
    if (!allowed.includes(String(message.chat.id))) return false;
  }
  const command = String(config.command ?? "").trim();
  return (
    !command || (message.text ?? message.caption ?? "").startsWith(command)
  );
}

function abortableDelay(ms: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
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
