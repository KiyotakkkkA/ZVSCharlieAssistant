import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { observer } from "mobx-react-lite";
import {
  Alert,
  Button,
  EmptyState,
  InputSmall,
  ScrollArea,
  useToasts,
} from "@kiyotakkkka/zvs-uikit-lib";
import { APP_PATHS } from "../../app/routes";
import {
  ChevronLeftIcon,
  OpenInNewIcon,
  TasksIcon,
} from "../../components/atoms";
import { ChatAssistantMsgBlock } from "../../components/molecules/ChatAssistantMsgBlock";
import { ChatUserMsgBlock } from "../../components/molecules/ChatUserMsgBlock";
import { PageHeader } from "../../components/organisms";
import { useAppNavigation } from "../../hooks";
import { entityGenerationStore, textProviderStore } from "../../stores";
import type { ChatMessageContentPart } from "../../../shared/dto";
import type {
  EntityGenerationRun,
  GenerationTranscriptMessage,
} from "../../../ipc/contracts";

const KIND_LABELS: Record<EntityGenerationRun["kind"], string> = {
  agent: "Агент",
  skill: "Навык",
  scenario: "Сценарий",
};

const STATUS_META: Record<
  EntityGenerationRun["status"],
  { label: string; tone: string; dot: string }
> = {
  queued: { label: "В очереди", tone: "text-main-400", dot: "bg-main-500" },
  running: {
    label: "Генерируется",
    tone: "text-accent-light",
    dot: "bg-accent-light animate-pulse",
  },
  clarification_requested: {
    label: "Запрошено уточнение",
    tone: "text-warning-light",
    dot: "bg-warning-light animate-pulse",
  },
  completed: {
    label: "Готово",
    tone: "text-success-light",
    dot: "bg-success-light",
  },
  failed: {
    label: "Ошибка",
    tone: "text-danger-light",
    dot: "bg-danger-light",
  },
  cancelled: { label: "Отменена", tone: "text-main-500", dot: "bg-main-600" },
};

const ACTIVE_STATUSES = new Set([
  "queued",
  "running",
  "clarification_requested",
]);
const FALLBACK_POLL_MS = 5_000;

const ENTITY_ROUTE_BY_KIND: Record<EntityGenerationRun["kind"], string> = {
  agent: APP_PATHS.automation.agents.edit,
  skill: APP_PATHS.automation.skills.edit,
  scenario: APP_PATHS.automation.scenarios.edit,
};

interface LiveToolCall {
  toolCallId: string;
  toolName: string;
  input: unknown;
}

interface LiveToolResult {
  toolCallId: string;
  toolName: string;
  output: unknown;
  isError?: boolean;
}

export const GenerationRunDetailPage = observer(
  function GenerationRunDetailPage() {
    const { runId } = useParams();
    const { goTo } = useAppNavigation();
    const toasts = useToasts();
    const [transcript, setTranscript] = useState<GenerationTranscriptMessage[]>(
      [],
    );
    const [selected, setSelected] = useState<string[]>([]);
    const [freeText, setFreeText] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [liveText, setLiveText] = useState("");
    const [liveReasoning, setLiveReasoning] = useState("");
    const [liveToolCalls, setLiveToolCalls] = useState<LiveToolCall[]>([]);
    const [liveToolResults, setLiveToolResults] = useState<LiveToolResult[]>(
      [],
    );

    useEffect(() => {
      void entityGenerationStore.bootstrap();
    }, []);

    const run = entityGenerationStore.runs.find((item) => item.id === runId);

    const resetLiveStep = () => {
      setLiveText("");
      setLiveReasoning("");
      setLiveToolCalls([]);
      setLiveToolResults([]);
    };

    useEffect(() => {
      if (!runId) return;
      let cancelled = false;
      const refreshTranscript = async () => {
        const messages =
          await window.desktop.entityGeneration.getTranscript(runId);
        if (!cancelled) setTranscript(messages);
      };
      void refreshTranscript();
      resetLiveStep();

      const unsubscribe = window.desktop.entityGeneration.subscribeRunEvents(
        (event) => {
          if (event.type === "run.updated") return;
          if (event.runId !== runId) return;
          if (event.type === "text.delta")
            setLiveText((current) => current + event.delta);
          else if (event.type === "reasoning.delta")
            setLiveReasoning((current) => current + event.delta);
          else if (event.type === "tool.call")
            setLiveToolCalls((current) => [
              ...current,
              {
                toolCallId: event.toolCallId,
                toolName: event.toolName,
                input: event.input,
              },
            ]);
          else if (event.type === "tool.result")
            setLiveToolResults((current) => [
              ...current,
              {
                toolCallId: event.toolCallId,
                toolName: event.toolName,
                output: event.output,
                isError: event.isError,
              },
            ]);
          else if (event.type === "step.completed") {
            resetLiveStep();
            void refreshTranscript();
          }
        },
      );

      return () => {
        cancelled = true;
        unsubscribe();
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [runId]);

    useEffect(() => {
      if (!runId || !run || !ACTIVE_STATUSES.has(run.status)) return;
      const timer = window.setInterval(() => {
        void window.desktop.entityGeneration
          .getTranscript(runId)
          .then(setTranscript);
      }, FALLBACK_POLL_MS);
      return () => window.clearInterval(timer);
    }, [runId, run?.status]);

    useEffect(() => {
      setSelected([]);
      setFreeText("");
    }, [run?.pendingQuestion?.id]);

    if (!run)
      return (
        <div className="grid h-full min-h-0 place-items-center p-4">
          <EmptyState
            icon={<TasksIcon className="size-6" />}
            title="Генерация не найдена"
            description="Возможно, она была удалена или ещё загружается."
          />
        </div>
      );

    const question = run.pendingQuestion;
    const toggle = (label: string) =>
      setSelected((current) =>
        question?.multiSelect
          ? current.includes(label)
            ? current.filter((item) => item !== label)
            : [...current, label]
          : [label],
      );

    const submitAnswer = async (answer: string[]) => {
      if (!question || !answer.length) return;
      setSubmitting(true);
      try {
        await entityGenerationStore.answerQuestion(question.id, answer);
      } catch (error) {
        toasts.danger({
          title: "Не удалось отправить ответ",
          description:
            error instanceof Error ? error.message : "Неизвестная ошибка",
        });
      } finally {
        setSubmitting(false);
      }
    };

    const meta = STATUS_META[run.status];
    const showLive = run.status === "running";
    const liveParts = showLive
      ? buildLiveParts(liveReasoning, liveText, liveToolCalls, liveToolResults)
      : [];
    const segments = groupTranscript(transcript, liveParts);

    return (
      <div className="flex h-full min-h-0 flex-col p-4">
        <PageHeader
          title={run.entityName ?? `${KIND_LABELS[run.kind]} · генерация`}
          leading={
            <Button
              variant="ghost"
              label="Назад"
              rounded="rounded-lg"
              className="size-7 shrink-0 p-0 text-main-400 hover:bg-main-600/50"
              onClick={() => goTo(APP_PATHS.tasks)}
            >
              <ChevronLeftIcon className="size-4" />
            </Button>
          }
          description={`${KIND_LABELS[run.kind]} · ${textProviderStore.modelLabel(run.modelId)}`}
          breadcrumbs={[{ label: "Задачи" }, { label: "Создание" }]}
        >
          <div className="flex items-center gap-2">
            <span className={`flex items-center gap-2 text-xs ${meta.tone}`}>
              <span className={`size-1.5 rounded-full ${meta.dot}`} />
              {meta.label}
            </span>
            {run.entityId ? (
              <Button
                variant="secondary"
                className="gap-1.5 px-3"
                onClick={() =>
                  goTo(
                    ENTITY_ROUTE_BY_KIND[run.kind].replace(
                      run.kind === "agent"
                        ? ":agentId"
                        : run.kind === "skill"
                          ? ":skillId"
                          : ":scenarioId",
                      run.entityId!,
                    ),
                  )
                }
              >
                <OpenInNewIcon className="size-4" />
                Перейти
              </Button>
            ) : null}
          </div>
        </PageHeader>

        <ScrollArea className="min-h-0 flex-1 py-4">
          <div className="mx-auto flex max-w-3xl flex-col gap-4">
            {segments.map((segment, index) =>
              segment.kind === "user" ? (
                <ChatUserMsgBlock
                  key={`user-${index}`}
                  text={segment.text}
                  showControls={false}
                />
              ) : (
                <ChatAssistantMsgBlock
                  key={`assistant-${index}`}
                  text=""
                  parts={segment.parts}
                  status={
                    showLive && index === segments.length - 1
                      ? "streaming"
                      : undefined
                  }
                  showControls={false}
                />
              ),
            )}

            {run.status === "failed" && run.error ? (
              <Alert variant="danger" title="Генерация завершилась ошибкой">
                {run.error}
              </Alert>
            ) : null}

            {question ? (
              <section className="rounded-2xl bg-main-800/45 p-4 ring-1 ring-main-700/40">
                <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.08em] text-warning-light">
                  {question.header || "Уточнение от модели"}
                </p>
                <p className="mb-3 text-sm leading-6 text-main-100">
                  {question.question}
                </p>
                {question.options.length ? (
                  <div className="flex flex-wrap gap-2">
                    {question.options.map((option) => {
                      const active = selected.includes(option.label);
                      return (
                        <button
                          key={option.label}
                          type="button"
                          aria-pressed={active}
                          title={option.description}
                          disabled={submitting}
                          onClick={() =>
                            question.multiSelect
                              ? toggle(option.label)
                              : void submitAnswer([option.label])
                          }
                          className={`inline-flex min-h-9 items-center gap-2 rounded-xl border px-3 py-2 text-left text-[13px] leading-5 transition-all duration-200 disabled:cursor-wait disabled:opacity-60 ${
                            active
                              ? "border-accent-medium/50 bg-accent-medium/15 text-main-50"
                              : "border-main-700/70 bg-main-900/45 text-main-200 hover:border-main-600 hover:bg-main-700/45"
                          }`}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                    {question.multiSelect ? (
                      <Button
                        variant="primary"
                        loading={submitting}
                        disabled={!selected.length}
                        onClick={() => void submitAnswer(selected)}
                      >
                        Ответить
                      </Button>
                    ) : null}
                  </div>
                ) : (
                  <form
                    className="flex gap-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void submitAnswer([freeText.trim()].filter(Boolean));
                    }}
                  >
                    <InputSmall
                      autoFocus
                      aria-label="Ответ на вопрос"
                      className="min-w-0 flex-1"
                      value={freeText}
                      placeholder="Ваш ответ"
                      onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                        setFreeText(event.target.value)
                      }
                    />
                    <Button
                      type="submit"
                      loading={submitting}
                      disabled={!freeText.trim()}
                    >
                      Ответить
                    </Button>
                  </form>
                )}
              </section>
            ) : null}
          </div>
        </ScrollArea>
      </div>
    );
  },
);

function buildLiveParts(
  reasoning: string,
  text: string,
  toolCalls: LiveToolCall[],
  toolResults: LiveToolResult[],
): ChatMessageContentPart[] {
  const parts: ChatMessageContentPart[] = [];
  if (reasoning) parts.push({ type: "reasoning", text: reasoning });
  if (text) parts.push({ type: "text", text });
  for (const call of toolCalls)
    parts.push({
      type: "tool-call",
      toolCallId: call.toolCallId,
      toolName: call.toolName,
      input: call.input,
    } as ChatMessageContentPart);
  for (const result of toolResults)
    parts.push({
      type: "tool-result",
      toolCallId: result.toolCallId,
      toolName: result.toolName,
      output: result.output,
      isError: result.isError,
    } as ChatMessageContentPart);
  return parts;
}

type TranscriptSegment =
  | { kind: "user"; text: string }
  | { kind: "assistant"; parts: ChatMessageContentPart[] };

function groupTranscript(
  messages: GenerationTranscriptMessage[],
  liveParts: ChatMessageContentPart[],
): TranscriptSegment[] {
  const segments: TranscriptSegment[] = [];
  for (const message of messages) {
    if (message.role === "user") {
      const text = message.parts
        .filter(
          (part): part is Extract<typeof part, { type: "text" }> =>
            part.type === "text",
        )
        .map((part) => part.text)
        .join("");
      segments.push({ kind: "user", text });
      continue;
    }
    const last = segments.at(-1);
    if (last?.kind === "assistant") last.parts.push(...message.parts);
    else segments.push({ kind: "assistant", parts: [...message.parts] });
  }

  if (liveParts.length) {
    const last = segments.at(-1);
    if (last?.kind === "assistant") last.parts.push(...liveParts);
    else segments.push({ kind: "assistant", parts: liveParts });
  }

  return segments;
}
