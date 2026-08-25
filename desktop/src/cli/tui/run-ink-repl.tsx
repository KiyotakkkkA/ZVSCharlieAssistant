import { useCallback, useReducer, useRef, useState } from "react";
import { render } from "ink";
import type {
  ChatConversation,
  RecentChatSession,
  RunEvent,
} from "../../shared/models/chat";
import type { ChatMode } from "../../shared/dto";
import type { UserQuestion } from "../../shared/models/user-question";
import type { CliOptions } from "../args";
import type { BridgeClient } from "../client";
import { compactValue } from "./output";
import { commandCatalog } from "./commands";
import { ZvsTui, type TuiMenu } from "./organisms/ZvsTui";
import { initialTuiState, reduceTuiState, type TuiAction } from "./state";

interface Named {
  id: string;
  name: string;
}

interface ProjectOption extends Named {
  rootPath: string | null;
}

export async function runInkRepl(
  client: BridgeClient,
  options: CliOptions,
  version: string,
): Promise<number> {
  const models = (await client.request("models.list")) as Named[];
  const agents = (await client.request("agents.list")) as Named[];
  const projects = (await client.request("projects.list")) as ProjectOption[];
  const recentSessions = (await client.request(
    "sessions.recent",
  )) as RecentChatSession[];
  const modelId = options.model ?? models[0]?.id;
  let finish: (code: number) => void = () => undefined;
  let settled = false;
  const completion = new Promise<number>((resolve) => {
    finish = (code) => {
      if (settled) return;
      settled = true;
      resolve(code);
    };
  });
  let instance: ReturnType<typeof render>;
  instance = render(
    <InkRuntime
      client={client}
      options={options}
      version={version}
      modelId={modelId}
      models={models}
      agents={agents}
      projects={projects}
      recentSessions={recentSessions}
      onExit={(code) => {
        instance.unmount();
        finish(code);
      }}
    />,
    { exitOnCtrlC: false },
  );
  void instance.waitUntilExit().then(() => finish(0));
  return completion;
}

function InkRuntime(props: {
  client: BridgeClient;
  options: CliOptions;
  version: string;
  modelId?: string;
  models: Named[];
  agents: Named[];
  projects: ProjectOption[];
  recentSessions: RecentChatSession[];
  onExit: (code: number) => void;
}) {
  const [state, dispatch] = useReducer(reduceTuiState, undefined, initialTuiState);
  const initialSession = props.recentSessions.find(
    (session) => session.conversationId === props.options.conversation,
  );
  const [settings, setSettings] = useState<{
    mode: ChatMode;
    modelId?: string;
    agentId?: string;
    scenarioId?: string;
    projectId?: string;
    permission: CliOptions["permissionMode"];
  }>({
    mode:
      props.options.agent
        ? "agent"
        : (initialSession?.usage.mode ?? "chat"),
    modelId:
      props.options.model ?? initialSession?.usage.modelId ?? props.modelId,
    agentId: props.options.agent ?? initialSession?.usage.agentId,
    scenarioId: initialSession?.usage.scenarioId,
    projectId: props.options.project ?? initialSession?.project?.id,
    permission:
      initialSession?.usage.permissionMode ?? props.options.permissionMode,
  });
  const [recentSessions, setRecentSessions] = useState(props.recentSessions);
  const [menu, setMenu] = useState<(TuiMenu & { kind: string }) | undefined>();
  const [inputPrompt, setInputPrompt] = useState<"rename" | undefined>();
  const conversationId = useRef(props.options.conversation);
  const activeRunId = useRef<string | undefined>(undefined);
  const lastRunId = useRef<string | undefined>(undefined);
  const runStarting = useRef(false);
  const queuedMessages = useRef<string[]>([]);
  const startRunRef = useRef<(message: string) => Promise<void>>(async () => undefined);
  const sequence = useRef(0);

  const appendSystem = useCallback((text: string, error = false) => {
    dispatch({
      type: "transcript.append",
      entry: {
        id: `local-${sequence.current++}`,
        kind: error ? "error" : "system",
        text,
      },
    });
  }, []);

  const showMenu = useCallback(
    (kind: string, title: string, items: TuiMenu["items"]) => {
      if (!items.length) {
        appendSystem(`${title}: список пуст`, true);
        return;
      }
      setMenu({ kind, title, items });
    },
    [appendSystem],
  );

  const runCommand = useCallback(
    async (message: string): Promise<boolean> => {
      if (!message.startsWith("/")) return false;
      const [name, ...parts] = message.trim().split(/\s+/);
      const argument = parts.join(" ");
      switch (name) {
        case "/help":
          appendSystem(
            [
              "# Команды",
              ...commandCatalog.map(
                (command) =>
                  `- \`${command.name}${command.usage ? ` ${command.usage}` : ""}\` — ${command.description}`,
              ),
              "",
              "# Горячие клавиши",
              "- `Tab` — дополнить команду или поставить сообщение в очередь",
              "- `Shift+Enter` — новая строка",
              "- `Ctrl+C` — отменить задачу или выйти",
              "- `Esc` — закрыть меню или очистить ввод",
            ].join("\n"),
          );
          return true;
        case "/model":
          showMenu(
            "model",
            "Модель",
            props.models.map((item) => ({ label: item.name, value: item.id })),
          );
          return true;
        case "/agent":
          showMenu("agent", "Агент", [
            { label: "без агента", hint: "обычный чат", value: "" },
            ...props.agents.map((item) => ({ label: item.name, value: item.id })),
          ]);
          return true;
        case "/project":
          showMenu("project", "Проект", [
            { label: "без проекта", value: "" },
            ...props.projects.map((item) => ({
              label: item.name,
              hint: item.rootPath ?? "",
              value: item.id,
            })),
          ]);
          return true;
        case "/permission":
          showMenu("permission", "Режим разрешений", [
            { label: "plan", hint: "только чтение", value: "plan" },
            { label: "edit", hint: "правки разрешены", value: "edit" },
            { label: "deny", hint: "без инструментов", value: "deny" },
          ]);
          return true;
        case "/chats": {
          const conversations = (await props.client.request(
            "conversations.list",
          )) as ChatConversation[];
          const query = argument.toLocaleLowerCase("ru-RU");
          const filtered = query
            ? conversations.filter((item) =>
                item.title.toLocaleLowerCase("ru-RU").includes(query),
              )
            : conversations;
          showMenu(
            "conversation",
            "Диалог",
            filtered.map((item) => ({
              label: item.title,
              hint: new Date(item.updatedAt).toLocaleString("ru-RU"),
              value: item.id,
            })),
          );
          return true;
        }
        case "/resume": {
          const sessions = (await props.client.request(
            "sessions.recent",
          )) as RecentChatSession[];
          setRecentSessions(sessions);
          const query = argument.toLocaleLowerCase("ru-RU");
          const filtered = query
            ? sessions.filter((session) =>
                session.title.toLocaleLowerCase("ru-RU").includes(query),
              )
            : sessions;
          showMenu(
            "session",
            "Последние сессии",
            filtered.map((session) => ({
              label: session.title,
              hint: sessionHint(session, props.models, props.agents),
              value: session.conversationId,
            })),
          );
          return true;
        }
        case "/rename":
          if (!conversationId.current) {
            appendSystem("Сначала начните или выберите диалог", true);
          } else if (argument) {
            await props.client.request("conversations.rename", {
              conversationId: conversationId.current,
              title: argument,
            });
            appendSystem(`Диалог переименован: ${argument}`);
          } else setInputPrompt("rename");
          return true;
        case "/new":
          conversationId.current = undefined;
          lastRunId.current = undefined;
          queuedMessages.current = [];
          dispatch({ type: "session.reset" });
          appendSystem("Начат новый диалог");
          return true;
        case "/context": {
          if (!conversationId.current || !settings.modelId) {
            appendSystem("Контекст пока пуст");
            return true;
          }
          const context = (await props.client.request("chat.context", {
            conversationId: conversationId.current,
            modelId: settings.modelId,
          })) as { usedTokens: number; usableTokens: number };
          const percent = Math.round(
            (context.usedTokens / Math.max(1, context.usableTokens)) * 100,
          );
          appendSystem(
            `Контекст ${percent}% · ${context.usedTokens.toLocaleString("ru-RU")} / ${context.usableTokens.toLocaleString("ru-RU")} токенов`,
          );
          return true;
        }
        case "/status":
          appendSystem(
            [
              "# Текущая сессия",
              `- Модель: **${props.models.find((item) => item.id === settings.modelId)?.name ?? settings.modelId ?? "не выбрана"}**`,
              `- Агент: **${props.agents.find((item) => item.id === settings.agentId)?.name ?? "без агента"}**`,
              `- Проект: **${props.projects.find((item) => item.id === settings.projectId)?.name ?? "без проекта"}**`,
              `- Доступ: \`${settings.permission}\``,
              `- Диалог: \`${conversationId.current ?? "новый"}\``,
            ].join("\n"),
          );
          return true;
        case "/compact": {
          if (!conversationId.current || !settings.modelId) {
            appendSystem("Нечего сжимать", true);
            return true;
          }
          const segment = (await props.client.request("chat.compact", {
            conversationId: conversationId.current,
            modelId: settings.modelId,
            focus: argument || undefined,
          })) as { messageCount: number } | null;
          appendSystem(
            segment
              ? `Сжато ${segment.messageCount} сообщений`
              : "Сжимать пока нечего",
          );
          return true;
        }
        case "/diff": {
          if (!conversationId.current) {
            appendSystem("В этом диалоге ещё нет правок");
            return true;
          }
          const edits = (await props.client.request("files.edits", {
            conversationId: conversationId.current,
          })) as Array<{ path: string; operation: string; reverted: boolean; diff: string }>;
          appendSystem(
            edits.length
              ? edits
                  .map(
                    (edit) =>
                      `# ${edit.path}\n${edit.operation}${edit.reverted ? " · откачен" : ""}\n\`\`\`diff\n${edit.diff}\n\`\`\``,
                  )
                  .join("\n\n")
              : "Правок файлов пока нет",
          );
          return true;
        }
        case "/undo": {
          const runId = argument || lastRunId.current;
          if (!runId) {
            appendSystem("Нет задачи для отката", true);
            return true;
          }
          const result = (await props.client.request("files.revert", {
            runId,
          })) as { restored: string[]; failed: string[] };
          appendSystem(
            `Восстановлено файлов: ${result.restored.length}${result.failed.length ? `, не удалось: ${result.failed.length}` : ""}`,
            result.failed.length > 0,
          );
          return true;
        }
        case "/clear":
          queuedMessages.current = [];
          dispatch({ type: "session.reset" });
          return true;
        case "/exit":
        case "/quit":
          props.onExit(0);
          return true;
        default:
          appendSystem(`Неизвестная команда ${name}; используйте /help`, true);
          return true;
      }
    }, [appendSystem, props, settings, showMenu],
  );

  const startRun = useCallback(
    async (message: string) => {
      if (runStarting.current || activeRunId.current) {
        queuedMessages.current.push(message);
        dispatch({ type: "message.queued", value: message });
        return;
      }
      if (inputPrompt === "rename") {
        if (conversationId.current)
          await props.client.request("conversations.rename", {
            conversationId: conversationId.current,
            title: message,
          });
        setInputPrompt(undefined);
        dispatch({ type: "draft.changed", value: "" });
        appendSystem(`Диалог переименован: ${message}`);
        return;
      }
      if (await runCommand(message)) return;
      if (
        settings.mode !== "scenario" &&
        !settings.modelId &&
        !settings.agentId
      ) {
        appendSystem("Не выбрана модель", true);
        return;
      }

      const localId = `run-${sequence.current++}`;
      runStarting.current = true;
      dispatch({ type: "run.started", id: localId, message });
      let finished = false;
      const finishAndContinue = () => {
        if (finished) return;
        finished = true;
        activeRunId.current = undefined;
        runStarting.current = false;
        const next = queuedMessages.current.shift();
        if (!next) return;
        dispatch({ type: "queue.shifted" });
        setTimeout(() => void startRunRef.current(next), 0);
      };
      const handle = (event: RunEvent) => {
        switch (event.type) {
          case "run.started":
            activeRunId.current = event.runId;
            lastRunId.current = event.runId;
            break;
          case "reasoning.delta":
            dispatch({ type: "reasoning.delta", delta: event.delta });
            break;
          case "text.delta":
            dispatch({ type: "answer.delta", delta: event.delta });
            break;
          case "tool.requested":
            dispatch({
              type: "tool.changed",
              tool: {
                callId: event.toolCallId,
                toolId: event.toolId,
                status: "requested",
                summary: `${event.toolId}${event.input === undefined ? "" : ` · ${compactValue(event.input)}`}`,
              },
            });
            break;
          case "tool.running":
            dispatch({
              type: "tool.changed",
              tool: {
                callId: event.toolCallId,
                toolId: event.toolId,
                status: "running",
                summary: `${event.toolId} · выполняется`,
              },
            });
            if (event.toolId === "ask_user")
              void loadQuestion(props.client, conversationId.current, activeRunId.current).then(
                (question) => {
                  if (question) {
                    dispatch({ type: "question.requested", question });
                    return;
                  }
                  appendSystem("Не удалось получить вопрос агента через CLI-мост", true);
                  const runId = activeRunId.current;
                  if (runId) void props.client.request("chat.cancel", { runId });
                },
                (error: unknown) => {
                  appendSystem(
                    error instanceof Error ? error.message : String(error),
                    true,
                  );
                },
              );
            break;
          case "tool.completed":
            dispatch({
              type: "tool.changed",
              tool: {
                callId: event.toolCallId,
                toolId: event.toolId,
                status: event.error ? "failed" : "completed",
                summary: event.error
                  ? `${event.toolId} · ${event.error}`
                  : `${event.toolId}${event.output === undefined ? "" : ` · ${compactValue(event.output)}`}`,
              },
            });
            break;
          case "file.changed":
            dispatch({
              type: "transcript.append",
              entry: {
                id: `${localId}:file:${sequence.current++}`,
                kind: "tool",
                text: `${event.edit.operation} · ${event.edit.path}`,
              },
            });
            break;
          case "run.model.switched":
            appendSystem(
              `Модель переключена: ${event.change.from} → ${event.change.to} · ${event.change.reason}`,
            );
            break;
          case "context.compacted":
            appendSystem(
              `Контекст сжат: ${event.segment.messageCount} сообщений`,
            );
            break;
          case "run.failed":
            dispatch({ type: "run.failed", id: localId, error: event.message });
            finishAndContinue();
            break;
          case "run.cancelled":
            dispatch({ type: "run.failed", id: localId, error: "Прервано пользователем" });
            finishAndContinue();
            break;
          case "run.completed":
            dispatch({ type: "run.completed", id: localId });
            finishAndContinue();
            break;
        }
      };

      try {
        const result = (await props.client.request(
          "chat.start",
          {
            conversationId: conversationId.current,
            mode: settings.mode,
            modelId:
              settings.mode === "agent" || settings.mode === "scenario"
                ? undefined
                : settings.modelId,
            agentId: settings.mode === "agent" ? settings.agentId : undefined,
            scenarioId:
              settings.mode === "scenario" ? settings.scenarioId : undefined,
            projectId: settings.projectId,
            text: message,
            permissionMode: settings.permission,
          },
          (_name, payload) => handle(payload as RunEvent),
        )) as { runId: string; conversationId: string };
        activeRunId.current = result.runId;
        lastRunId.current = result.runId;
        conversationId.current = result.conversationId;
      } catch (error) {
        dispatch({
          type: "run.failed",
          id: localId,
          error: error instanceof Error ? error.message : String(error),
        });
        finishAndContinue();
      }
    }, [appendSystem, inputPrompt, props.client, runCommand, settings]);
  startRunRef.current = startRun;

  const cancel = useCallback(() => {
    const runId = activeRunId.current;
    if (!runId) return;
    dispatch({ type: "run.cancelling" });
    void props.client.request("chat.cancel", { runId });
  }, [props.client]);

  const answer = useCallback(
    (question: UserQuestion, values: string[]) => {
      void props.client
        .request("questions.answer", { questionId: question.id, answer: values })
        .then(
          () => dispatch({ type: "question.answered" }),
          (error: unknown) =>
            appendSystem(
              error instanceof Error ? error.message : String(error),
              true,
            ),
        );
    },
    [appendSystem, props.client],
  );

  const externalDispatch = useCallback((action: TuiAction) => dispatch(action), []);
  const selectMenuItem = useCallback(
    (value: string) => {
      const kind = menu?.kind;
      setMenu(undefined);
      if (kind === "model") {
        setSettings((current) => ({
          ...current,
          mode: "chat",
          modelId: value,
          agentId: undefined,
          scenarioId: undefined,
        }));
        appendSystem(`Модель: ${props.models.find((item) => item.id === value)?.name ?? value}`);
      } else if (kind === "agent") {
        setSettings((current) => ({
          ...current,
          mode: value ? "agent" : "chat",
          agentId: value || undefined,
          scenarioId: undefined,
        }));
        appendSystem(`Агент: ${props.agents.find((item) => item.id === value)?.name ?? "без агента"}`);
      } else if (kind === "project") {
        setSettings((current) => ({ ...current, projectId: value || undefined }));
        if (conversationId.current)
          void props.client.request("projects.assign", {
            conversationId: conversationId.current,
            projectId: value || null,
          }).catch((error: unknown) =>
            appendSystem(
              error instanceof Error ? error.message : String(error),
              true,
            ),
          );
        appendSystem(`Проект: ${props.projects.find((item) => item.id === value)?.name ?? "без проекта"}`);
      } else if (kind === "permission") {
        setSettings((current) => ({
          ...current,
          permission: value as CliOptions["permissionMode"],
        }));
        appendSystem(`Режим доступа: ${value}`);
      } else if (kind === "conversation") {
        conversationId.current = value;
        appendSystem("Диалог переключён");
      } else if (kind === "session") {
        const session = recentSessions.find(
          (item) => item.conversationId === value,
        );
        if (!session) {
          appendSystem("Сессия больше недоступна", true);
          return;
        }
        conversationId.current = session.conversationId;
        setSettings({
          mode: session.usage.mode,
          modelId: session.usage.modelId,
          agentId: session.usage.agentId,
          scenarioId: session.usage.scenarioId,
          projectId: session.project?.id,
          permission: session.usage.permissionMode ?? "edit",
        });
        dispatch({ type: "session.reset" });
        appendSystem(
          `Продолжена сессия **${session.title}**\n- Режим: \`${session.usage.mode}\`\n- Проект: **${session.project?.name ?? "без проекта"}**`,
        );
      }
    },
    [
      appendSystem,
      menu?.kind,
      props.agents,
      props.client,
      props.models,
      props.projects,
      recentSessions,
    ],
  );
  const currentModel = settings.mode === "scenario"
    ? `сценарий · ${settings.scenarioId ?? "не выбран"}`
    : settings.agentId
    ? `${props.agents.find((item) => item.id === settings.agentId)?.name ?? settings.agentId} · агент`
    : props.models.find((item) => item.id === settings.modelId)?.name ??
      settings.modelId ??
      "не выбрана";
  const currentProject =
    props.projects.find((item) => item.id === settings.projectId)?.name ??
    "без проекта";
  return (
    <ZvsTui
      version={props.version}
      model={currentModel}
      project={currentProject}
      permission={settings.permission}
      recentSessions={recentSessions}
      fileRoot={
        props.projects.find((item) => item.id === settings.projectId)?.rootPath ??
        process.cwd()
      }
      state={state}
      dispatch={externalDispatch}
      menu={menu}
      inputPrompt={inputPrompt === "rename" ? "Новое название диалога" : undefined}
      onSubmit={(value) => void startRun(value)}
      onQueue={(value) => queuedMessages.current.push(value)}
      onCancel={cancel}
      onExit={() => props.onExit(0)}
      onAnswer={answer}
      onMenuSelect={selectMenuItem}
      onEscape={() => {
        setMenu(undefined);
        setInputPrompt(undefined);
        dispatch({ type: "draft.changed", value: "" });
      }}
    />
  );
}

function sessionHint(
  session: RecentChatSession,
  models: Named[],
  agents: Named[],
): string {
  const actor = session.usage.agentId
    ? agents.find((item) => item.id === session.usage.agentId)?.name ??
      session.usage.agentId
    : session.usage.modelId
      ? models.find((item) => item.id === session.usage.modelId)?.name ??
        session.usage.modelId
      : session.usage.scenarioId ?? session.usage.mode;
  return `${actor} · ${session.project?.name ?? "без проекта"} · ${session.usage.permissionMode ?? "edit"}`;
}

async function loadQuestion(
  client: BridgeClient,
  conversationId: string | undefined,
  runId: string | undefined,
): Promise<UserQuestion | undefined> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (conversationId) {
      const questions = (await client.request("questions.pending", {
        conversationId,
      })) as UserQuestion[];
      const question = questions.find((item) => !runId || item.runId === runId);
      if (question) return question;
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 50));
  }
  return undefined;
}
