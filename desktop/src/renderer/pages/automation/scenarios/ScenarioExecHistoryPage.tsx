import type {
  ScenarioNodeRun,
  ScenarioRun,
  UserQuestion,
} from "@ipc/contracts";
import {
  Alert,
  Button,
  CodeView,
  EmptyState,
  ScrollArea,
} from "@kiyotakkkka/zvs-uikit-lib";
import { APP_PATHS } from "@renderer/app/routes";
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  GraphIcon,
  TasksIcon,
} from "@renderer/components/atoms";
import { PageHeader } from "@renderer/components/organisms";
import { useAppNavigation } from "@renderer/hooks";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";

type Execution = { run: ScenarioRun; nodes: ScenarioNodeRun[] };

const RUN_STATUS: Record<
  ScenarioRun["status"],
  { label: string; tone: string; dot: string }
> = {
  queued: { label: "В очереди", tone: "text-main-400", dot: "bg-main-500" },
  running: {
    label: "Выполняется",
    tone: "text-accent-light",
    dot: "bg-accent-light animate-pulse",
  },
  waiting_for_approval: {
    label: "Ждёт ответа",
    tone: "text-amber-300",
    dot: "bg-amber-300 animate-pulse",
  },
  completed: {
    label: "Завершён",
    tone: "text-emerald-300",
    dot: "bg-emerald-400",
  },
  failed: { label: "Ошибка", tone: "text-red-300", dot: "bg-red-400" },
  cancelled: { label: "Отменён", tone: "text-main-500", dot: "bg-main-600" },
};

const NODE_LABELS: Record<ScenarioNodeRun["nodeKind"], string> = {
  trigger: "Триггер",
  orchestrator: "Оркестратор",
  agent: "Агент",
  knowledge_store: "Хранилище знаний",
  download_files: "Скачивание файлов",
  read_files: "Чтение файлов",
  condition: "Условие",
  approval: "Вопрос",
  output: "Результат",
};

const ORIGIN_LABELS: Record<ScenarioRun["origin"], string> = {
  manual: "Ручной запуск",
  chat: "Из чата",
  background: "Фоновый запуск",
};

const ACTIVE_STATUSES = new Set(["queued", "running", "waiting_for_approval"]);

const formatMs = (ms: number): string => {
  if (ms < 1_000) return `${Math.max(0, Math.round(ms))} мс`;
  if (ms < 60_000) return `${(ms / 1_000).toFixed(1)} с`;
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.round((ms % 60_000) / 1_000);
  return `${minutes} мин ${seconds} с`;
};

const spanMs = (
  from: string | null,
  to: string | null,
  now: number,
): number | null => {
  if (!from) return null;
  const start = new Date(from).getTime();
  if (!Number.isFinite(start)) return null;
  return (to ? new Date(to).getTime() : now) - start;
};

const asText = (value: unknown): string =>
  typeof value === "string" ? value : JSON.stringify(value, null, 2);

export function ScenarioExecHistoryPage() {
  const { runId } = useParams<{ runId: string }>();
  const { goBack, goTo } = useAppNavigation();
  const numericRunId = Number(runId);

  const [execution, setExecution] = useState<Execution | null>(null);
  const [questions, setQuestions] = useState<UserQuestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [answering, setAnswering] = useState(false);
  const [liveOutput, setLiveOutput] = useState<Map<string, string>>(new Map());
  const [now, setNow] = useState(() => Date.now());
  const feedRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    try {
      const [value, pending] = await Promise.all([
        window.desktop.automation.getScenarioRun(numericRunId),
        window.desktop.assistant.questions.forExecution(numericRunId),
      ]);
      setExecution(value);
      setQuestions(pending);
      setError(null);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Не удалось загрузить запуск",
      );
    }
  }, [numericRunId]);

  useEffect(() => {
    if (!Number.isInteger(numericRunId) || numericRunId <= 0) {
      setError("Некорректный идентификатор запуска");
      return;
    }
    void refresh();
    const stopRuns = window.desktop.automation.subscribeScenarioRuns(
      (event) => {
        if ("runId" in event && event.runId !== numericRunId) return;
        if ("run" in event && event.run.id !== numericRunId) return;
        if (event.type === "node.output.delta") {
          setLiveOutput((current) => {
            const next = new Map(current);
            next.set(
              event.nodeId,
              (next.get(event.nodeId) ?? "") + event.delta,
            );
            return next;
          });
          return;
        }
        void refresh();
      },
    );
    const stopQuestions = window.desktop.assistant.questions.subscribe(
      (question) => {
        if (question.executionId !== numericRunId) return;
        void refresh();
      },
    );
    return () => {
      stopRuns();
      stopQuestions();
    };
  }, [numericRunId, refresh]);

  const active = execution ? ACTIVE_STATUSES.has(execution.run.status) : false;

  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [active]);

  useEffect(() => {
    if (active)
      feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight });
  }, [execution?.nodes.length, active]);

  const stats = useMemo(() => {
    if (!execution) return null;
    const nodes = execution.nodes;
    return {
      total: nodes.length,
      completed: nodes.filter((node) => node.status === "completed").length,
      failed: nodes.filter((node) => node.status === "failed").length,
      retries: nodes.reduce(
        (sum, node) => sum + Math.max(0, node.attempt - 1),
        0,
      ),
      elapsed: spanMs(
        execution.run.startedAt ?? execution.run.createdAt,
        execution.run.completedAt,
        now,
      ),
      slowest: nodes.reduce<{ node: ScenarioNodeRun; ms: number } | null>(
        (slowest, node) => {
          const ms = spanMs(node.startedAt, node.completedAt, now);
          if (ms === null) return slowest;
          return !slowest || ms > slowest.ms ? { node, ms } : slowest;
        },
        null,
      ),
    };
  }, [execution, now]);

  const pendingQuestion = questions.find((item) => item.status === "pending");

  const answer = async (value: string[]) => {
    if (!pendingQuestion) return;
    setAnswering(true);
    try {
      await window.desktop.assistant.questions.answer({
        questionId: pendingQuestion.id,
        answer: value,
      });
      await refresh();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Не удалось отправить ответ",
      );
    } finally {
      setAnswering(false);
    }
  };

  if (!execution) {
    return (
      <div className="grid h-full place-items-center p-4">
        {error ? (
          <EmptyState
            icon={<TasksIcon className="size-8" />}
            title="Запуск недоступен"
            description={error}
            action={
              <Button onClick={() => goBack(APP_PATHS.tasks)}>Назад</Button>
            }
          />
        ) : (
          <p className="text-sm text-main-500">Загрузка запуска…</p>
        )}
      </div>
    );
  }

  const { run } = execution;
  const status = RUN_STATUS[run.status];

  return (
    <div className="flex h-full min-h-0 flex-col p-4">
      <PageHeader
        title={run.scenarioName}
        description={`${ORIGIN_LABELS[run.origin]} · запуск #${run.id}`}
        breadcrumbs={[{ label: "Задачи" }, { label: `Запуск #${run.id}` }]}
      >
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            onClick={() => goBack(APP_PATHS.tasks)}
            title="Назад к задачам"
          >
            <ChevronLeftIcon className="size-4" />
          </Button>
          <Button
            variant="ghost"
            onClick={() =>
              goTo(
                APP_PATHS.automation.scenarios.edit.replace(
                  ":scenarioId",
                  run.scenarioId,
                ),
              )
            }
          >
            <GraphIcon className="mr-1.5 size-4" />
            Открыть сценарий
          </Button>
          {active ? (
            <Button
              variant="danger"
              onClick={() =>
                void window.desktop.automation.cancelScenarioRun(run.id)
              }
            >
              Остановить
            </Button>
          ) : null}
        </div>
      </PageHeader>

      <div className="mb-4 grid shrink-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Состояние"
          value={
            <span className={`flex items-center gap-2 ${status.tone}`}>
              <span className={`size-2 rounded-full ${status.dot}`} />
              {status.label}
            </span>
          }
        />
        <Metric
          label="Прогресс"
          value={`${stats?.completed ?? 0} из ${stats?.total ?? 0} узлов`}
        />
        <Metric
          label="Идёт"
          value={
            stats?.elapsed !== null && stats?.elapsed !== undefined
              ? formatMs(stats.elapsed)
              : "—"
          }
        />
        <Metric
          label="Дольше всего"
          value={
            stats?.slowest
              ? `${NODE_LABELS[stats.slowest.node.nodeKind]} · ${formatMs(stats.slowest.ms)}`
              : "—"
          }
        />
      </div>

      {run.error ? (
        <Alert
          variant="danger"
          title="Запуск завершился ошибкой"
          className="mb-3 shrink-0"
        >
          {run.error}
        </Alert>
      ) : null}

      {pendingQuestion ? (
        <Alert
          variant="warning"
          title={pendingQuestion.header || "Сценарий ждёт ответа"}
          className="mb-3 shrink-0"
        >
          <p className="mb-2 whitespace-pre-wrap">{pendingQuestion.question}</p>
          <p className="mb-3 text-xs text-main-400">
            Канал: {CHANNEL_LABELS[pendingQuestion.channel]}
            {pendingQuestion.recipient ? ` · ${pendingQuestion.recipient}` : ""}
            {pendingQuestion.expiresAt
              ? ` · до ${new Date(pendingQuestion.expiresAt).toLocaleTimeString()}`
              : ""}
          </p>
          <div className="flex flex-wrap gap-2">
            {pendingQuestion.options.length ? (
              pendingQuestion.options.map((option) => (
                <Button
                  key={option.label}
                  disabled={answering}
                  onClick={() => void answer([option.label])}
                >
                  {option.label}
                </Button>
              ))
            ) : (
              <FreeTextAnswer disabled={answering} onSubmit={answer} />
            )}
          </div>
        </Alert>
      ) : null}

      <ScrollArea className="min-h-0 flex-1" ref={feedRef}>
        <ol className="space-y-2.5 pb-5 pr-1">
          {execution.nodes.map((node) => {
            const nodeStatus = RUN_STATUS[node.status];
            const duration = spanMs(node.startedAt, node.completedAt, now);
            const streaming = liveOutput.get(node.nodeId);
            const isOpen = expanded.has(node.id);
            return (
              <li
                key={node.id}
                className={`overflow-hidden rounded-2xl border bg-main-800/35 transition-[border-color,background-color,box-shadow] duration-300 ${
                  isOpen
                    ? "border-main-600/80 bg-main-800/55 shadow-[0_12px_32px_rgba(0,0,0,0.14)]"
                    : "border-main-700/55 hover:border-main-600/70 hover:bg-main-800/50"
                }`}
              >
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={`scenario-node-${node.id}-details`}
                  className="flex w-full items-center gap-3.5 px-4 py-3.5 text-left outline-none transition-colors focus-visible:bg-main-700/30 sm:px-5"
                  onClick={() =>
                    setExpanded((current) => {
                      const next = new Set(current);
                      if (next.has(node.id)) next.delete(node.id);
                      else next.add(node.id);
                      return next;
                    })
                  }
                >
                  <span
                    className={`size-2 shrink-0 rounded-full ring-4 ring-main-900/35 ${nodeStatus.dot}`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-main-100">
                      {NODE_LABELS[node.nodeKind]}
                      <span className="ml-2 text-xs text-main-500">
                        {node.nodeId}
                      </span>
                    </span>
                    <span className={`text-xs ${nodeStatus.tone}`}>
                      {nodeStatus.label}
                      {node.attempt > 1 ? ` · попытка ${node.attempt}` : ""}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-main-500">
                    {duration === null ? "—" : formatMs(duration)}
                  </span>
                  <ChevronDownIcon
                    className={`size-4 shrink-0 text-main-500 transition-transform duration-300 ease-out ${isOpen ? "rotate-180 text-main-300" : "rotate-0"}`}
                  />
                </button>

                {streaming && node.status === "running" ? (
                  <pre className="mx-4 mb-3 max-h-40 overflow-auto whitespace-pre-wrap rounded-xl border border-main-700/50 bg-main-900/55 p-3 text-xs leading-5 text-main-300 sm:mx-5">
                    {streaming}
                  </pre>
                ) : null}

                {node.error ? (
                  <p className="mx-4 mb-3 rounded-xl border border-danger-medium/20 bg-danger-medium/10 p-3 text-xs leading-5 text-danger-light sm:mx-5">
                    {node.error}
                  </p>
                ) : null}

                <div
                  id={`scenario-node-${node.id}-details`}
                  aria-hidden={!isOpen}
                  className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
                    isOpen
                      ? "grid-rows-[1fr] opacity-100"
                      : "grid-rows-[0fr] opacity-0"
                  }`}
                >
                  <div className="min-h-0 overflow-hidden">
                    <div
                      className={`space-y-4 border-t border-main-700/45 px-4 py-4 transition-transform duration-300 ease-out sm:px-5 ${isOpen ? "translate-y-0" : "-translate-y-2"}`}
                    >
                      <LabelledCode label="Вход" value={node.input} />
                      <LabelledCode label="Выход" value={node.output} />
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>

        {run.output !== null && run.output !== undefined ? (
          <div className="mb-4 overflow-hidden rounded-2xl border border-main-700/60 bg-main-800/20 p-4 sm:p-5">
            <p className="mb-3 text-xs font-medium text-main-300">
              Результат запуска
            </p>
            <CodeView
              code={asText(run.output)}
              language="json"
              fileName="output.json"
              copyable
              maxContentHeight={320}
            />
          </div>
        ) : null}
      </ScrollArea>
    </div>
  );
}

const CHANNEL_LABELS: Record<UserQuestion["channel"], string> = {
  ui: "окно приложения",
  telegram: "Telegram",
  email: "почта",
};

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-main-700/55 bg-main-800/35 px-4 py-3.5 transition-colors hover:border-main-600/60 hover:bg-main-800/45">
      <p className="text-[11px] uppercase tracking-wide text-main-500">
        {label}
      </p>
      <p className="mt-1.5 text-sm font-medium text-main-100">{value}</p>
    </div>
  );
}

function LabelledCode({ label, value }: { label: string; value: unknown }) {
  if (value === null || value === undefined)
    return (
      <div>
        <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-main-500">
          {label}
        </p>
        <p className="text-xs text-main-600">пусто</p>
      </div>
    );
  return (
    <div>
      <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-main-500">
        {label}
      </p>
      <CodeView
        code={asText(value)}
        language="json"
        fileName={`${label.toLowerCase()}.json`}
        copyable
        maxContentHeight={220}
      />
    </div>
  );
}

function FreeTextAnswer({
  disabled,
  onSubmit,
}: {
  disabled: boolean;
  onSubmit: (answer: string[]) => void | Promise<void>;
}) {
  const [value, setValue] = useState("");
  return (
    <form
      className="flex w-full gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (value.trim()) void onSubmit([value.trim()]);
      }}
    >
      <input
        aria-label="Ответ сценарию"
        className="min-w-0 flex-1 rounded-lg bg-main-900/60 px-3 py-2 text-sm text-main-100 ring-1 ring-main-700/40 outline-none focus:ring-accent-medium/50"
        value={value}
        placeholder="Ваш ответ"
        onChange={(event) => setValue(event.target.value)}
      />
      <Button type="submit" disabled={disabled || !value.trim()}>
        Ответить
      </Button>
    </form>
  );
}
