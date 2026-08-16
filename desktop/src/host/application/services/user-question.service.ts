import { randomBytes } from "node:crypto";
import type {
  QuestionChannel,
  QuestionMode,
  QuestionOption,
  UserQuestion,
} from "../../../shared/models/user-question";
import type { UserQuestionRepository } from "../../infrastructure/database/user-question.repository";
import type { IntegrationRepository } from "../../infrastructure/database/integration.repository";
import type { SecretStorageRepository } from "../../infrastructure/database/secret-storage.repository";
import type { ScenarioDeliveryRepository } from "../../infrastructure/database/scenario-delivery.repository";
import type { AutomationJobRepository } from "../../infrastructure/database/automation-job.repository";

export class ScenarioSuspended extends Error {
  constructor(readonly questionId: number) {
    super("Запуск приостановлен до ответа пользователя");
    this.name = "ScenarioSuspended";
  }
}

export interface AskInput {
  mode: QuestionMode;
  header: string;
  question: string;
  options: QuestionOption[];
  multiSelect: boolean;
  defaultAnswer?: string | null;
  timeoutSeconds?: number | null;
}

export interface ScenarioAskContext {
  executionId: number;
  nodeId: string;
  nodeRunId: number;
  triggerInput: unknown;
}

type PendingChatQuestion = {
  resolve: (answer: string[]) => void;
  timer: NodeJS.Timeout;
};

const CHAT_DEFAULT_TIMEOUT_SECONDS = 300;

export class UserQuestionService {
  private readonly chatWaiters = new Map<number, PendingChatQuestion>();
  private listener?: (question: UserQuestion) => void;

  constructor(
    private readonly data: UserQuestionRepository,
    private readonly integrations: IntegrationRepository,
    private readonly secrets: SecretStorageRepository,
    private readonly deliveries: ScenarioDeliveryRepository,
    private readonly jobs: AutomationJobRepository,
  ) {}

  watch(listener: (question: UserQuestion) => void): void {
    this.listener = listener;
  }

  pendingForConversation(conversationId: number) {
    return this.data.pendingForConversation(conversationId);
  }

  forExecution(executionId: number) {
    return this.data.forExecution(executionId);
  }

  async askInChat(
    input: AskInput,
    context: { conversationId: number; runId: number },
  ): Promise<string[]> {
    const timeoutMs =
      Math.min(
        Math.max(input.timeoutSeconds ?? CHAT_DEFAULT_TIMEOUT_SECONDS, 10),
        3_600,
      ) * 1_000;
    const question = this.data.create({
      scope: "chat",
      conversationId: context.conversationId,
      runId: context.runId,
      mode: input.mode,
      header: input.header,
      question: input.question,
      options: input.options,
      multiSelect: input.multiSelect,
      defaultAnswer: input.defaultAnswer ?? null,
      channel: "ui",
      expiresAt: new Date(Date.now() + timeoutMs).toISOString(),
    });
    this.listener?.(question);
    return new Promise<string[]>((resolve) => {
      const timer = setTimeout(() => {
        this.chatWaiters.delete(question.id);
        this.data.close(question.id, "timed_out");
        const fallback = this.data.find(question.id);
        if (fallback) this.listener?.(fallback);
        resolve([input.defaultAnswer ?? "Ответ не получен"]);
      }, timeoutMs);
      timer.unref();
      this.chatWaiters.set(question.id, { resolve, timer });
    });
  }

  askInScenario(input: AskInput, context: ScenarioAskContext): string[] {
    const existing = this.data.forNode(context.executionId, context.nodeId);
    if (existing?.status === "answered") return existing.answer ?? [];
    if (existing?.status === "timed_out")
      return [existing.defaultAnswer ?? "Ответ не получен"];
    if (existing?.status === "pending")
      throw new ScenarioSuspended(existing.id);

    const target = resolveTarget(context.triggerInput);
    const expiresAt = input.timeoutSeconds
      ? new Date(Date.now() + input.timeoutSeconds * 1_000).toISOString()
      : null;
    const question = this.data.create({
      scope: "scenario",
      executionId: context.executionId,
      nodeId: context.nodeId,
      nodeRunId: context.nodeRunId,
      mode: input.mode,
      header: input.header,
      question: input.question,
      options: input.options,
      multiSelect: input.multiSelect,
      defaultAnswer: input.defaultAnswer ?? null,
      channel: target.channel,
      integrationProfileId: target.integrationProfileId,
      recipient: target.recipient,
      expectedAuthor: target.author,
      correlationId: target.channel === "email" ? emailToken() : null,
      expiresAt,
    });
    this.dispatch(question, target);
    this.listener?.(question);
    throw new ScenarioSuspended(question.id);
  }

  answer(
    id: number,
    answer: string[],
    via: NonNullable<UserQuestion["answeredVia"]>,
    answeredBy?: string | null,
  ): UserQuestion {
    const question = this.data.answer(id, answer, via, answeredBy);
    this.listener?.(question);
    const waiter = this.chatWaiters.get(id);
    if (waiter) {
      clearTimeout(waiter.timer);
      this.chatWaiters.delete(id);
      waiter.resolve(answer);
      return question;
    }
    if (question.scope === "scenario" && question.executionId)
      this.scheduleResume(question.executionId);
    return question;
  }

  cancelForExecution(executionId: number): void {
    this.data.cancelForExecution(executionId);
  }

  sweepTimeouts(): void {
    for (const question of this.data.dueForTimeout(new Date().toISOString())) {
      this.data.close(question.id, "timed_out");
      const closed = this.data.find(question.id);
      if (closed) this.listener?.(closed);
      if (question.scope === "scenario" && question.executionId)
        this.scheduleResume(question.executionId);
    }
  }

  resolveExternal(input: {
    channel: QuestionChannel;
    recipient: string;
    authorId?: string | null;
    replyToId?: string | null;
    text: string;
  }): boolean {
    const byCorrelation = input.replyToId
      ? this.data.pendingByCorrelation(input.channel, input.replyToId)
      : undefined;
    const question =
      byCorrelation ??
      (input.channel === "email"
        ? this.matchEmailToken(input.text)
        : undefined) ??
      this.data.pendingByRecipient(input.channel, input.recipient);
    if (!question) return false;
    if (
      question.scope === "scenario" &&
      question.expectedAuthor &&
      input.authorId &&
      question.expectedAuthor !== input.authorId
    )
      return false;
    const answer = normalizeExternalAnswer(question, input.text);
    if (!answer.length) return false;
    this.answer(
      question.id,
      answer,
      input.channel === "telegram" ? "telegram" : "email",
      input.authorId ?? null,
    );
    return true;
  }

  private scheduleResume(executionId: number): void {
    this.jobs.enqueue("scenario_run", `question-resume:${executionId}`, {
      executionId,
      scenarioId: String(executionId),
    });
  }

  private dispatch(question: UserQuestion, target: AskTarget): void {
    if (target.channel === "ui") return;
    if (target.channel === "telegram") {
      void this.sendTelegram(question, target).catch(() => {
        this.data.close(question.id, "timed_out");
        if (question.executionId) this.scheduleResume(question.executionId);
      });
      return;
    }
    this.deliveries.enqueue({
      executionId: question.executionId!,
      nodeRunId: 0,
      channel: "email",
      integrationProfileId: target.integrationProfileId!,
      recipient: target.recipient!,
      payload: {
        subject: `${question.header || "Вопрос"} [${question.correlationId}]`,
        text: renderQuestionText(question),
      },
      idempotencyKey: `question:${question.id}`,
    });
  }

  private async sendTelegram(
    question: UserQuestion,
    target: AskTarget,
  ): Promise<void> {
    const profile = this.integrations.findProfile(target.integrationProfileId!);
    const tokenId = profile?.secretBindings.botToken;
    const token = tokenId
      ? this.secrets.findSecret(tokenId)?.content
      : undefined;
    if (!token) throw new Error("Не найден токен Telegram-бота");
    const response = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(20_000),
        body: JSON.stringify({
          chat_id: target.recipient,
          text: renderQuestionText(question),
          ...(question.options.length
            ? {
                reply_markup: {
                  keyboard: question.options.map((option) => [
                    { text: option.label },
                  ]),
                  one_time_keyboard: true,
                  resize_keyboard: true,
                  selective: true,
                },
              }
            : {}),
        }),
      },
    );
    const payload = (await response.json()) as {
      ok?: boolean;
      result?: { message_id?: number };
      description?: string;
    };
    if (!response.ok || !payload.ok)
      throw new Error(
        payload.description ?? `Telegram HTTP ${response.status}`,
      );
    const messageId = payload.result?.message_id;
    if (messageId) this.data.setCorrelation(question.id, String(messageId));
  }

  private matchEmailToken(text: string): UserQuestion | undefined {
    const token = /\[(Q[a-z0-9]{6})\]/i.exec(text)?.[1];
    return token ? this.data.pendingByCorrelation("email", token) : undefined;
  }
}

interface AskTarget {
  channel: QuestionChannel;
  integrationProfileId: number | null;
  recipient: string | null;
  author: string | null;
}

function resolveTarget(triggerInput: unknown): AskTarget {
  const input = triggerInput as
    | {
        trigger?: string;
        integrationProfileId?: number;
        entity?: {
          chat?: { id?: string };
          sender?: { id?: string };
          from?: Array<{ address?: string }>;
        };
      }
    | undefined;
  if (input?.trigger === "telegram" && input.entity?.chat?.id)
    return {
      channel: "telegram",
      integrationProfileId: input.integrationProfileId ?? null,
      recipient: String(input.entity.chat.id),
      author: input.entity.sender?.id ? String(input.entity.sender.id) : null,
    };
  if (input?.trigger === "email" && input.entity?.from?.[0]?.address)
    return {
      channel: "email",
      integrationProfileId: input.integrationProfileId ?? null,
      recipient: String(input.entity.from[0].address),
      author: String(input.entity.from[0].address),
    };
  return {
    channel: "ui",
    integrationProfileId: null,
    recipient: null,
    author: null,
  };
}

function renderQuestionText(question: UserQuestion): string {
  const options = question.options.length
    ? `\n\n${question.options
        .map(
          (option, index) =>
            `${index + 1}. ${option.label}${option.description ? ` — ${option.description}` : ""}`,
        )
        .join("\n")}\n\nОтветьте номером или текстом варианта.`
    : "";
  const header = question.header ? `${question.header}\n\n` : "";
  return `${header}${question.question}${options}`;
}

function normalizeExternalAnswer(
  question: UserQuestion,
  text: string,
): string[] {
  const value = text.trim();
  if (!value) return [];
  if (!question.options.length) return [value];
  const byIndex = Number.parseInt(value, 10);
  if (
    Number.isInteger(byIndex) &&
    byIndex >= 1 &&
    byIndex <= question.options.length
  )
    return [question.options[byIndex - 1]!.label];
  const lowered = value.toLocaleLowerCase();
  const exact = question.options.find(
    (option) => option.label.toLocaleLowerCase() === lowered,
  );
  if (exact) return [exact.label];
  const partial = question.options.find((option) =>
    lowered.includes(option.label.toLocaleLowerCase()),
  );
  if (partial) return [partial.label];
  return question.mode === "text" ? [value] : [];
}

const emailToken = () => `Q${randomBytes(3).toString("hex")}`;
