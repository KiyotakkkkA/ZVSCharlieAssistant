import { createInterface, type Interface } from "node:readline";
import type { RunEvent } from "../shared/models/chat";
import type { BridgeClient } from "./client";
import type { CliOptions } from "./args";
import { ANSI, palette, style, symbols } from "./theme";
import {
  Spinner,
  assistantHeading,
  banner,
  bullet,
  captureRunCancellation,
  compactValue,
  divider,
  heading,
  line,
  note,
  progressBar,
  promptText,
  reasoningHeading,
  select,
  statusLine,
  table,
  write,
} from "./ui";

interface Named {
  id: string;
  name: string;
}

interface ModelOption {
  id: string;
  name: string;
}

interface ProjectOption {
  id: string;
  name: string;
  rootPath: string | null;
}

const COMMANDS: Array<[string, string]> = [
  ["/help", "список команд"],
  ["/model", "выбрать модель"],
  ["/agent", "выбрать агента или отключить его"],
  ["/project", "привязать диалог к проекту"],
  ["/permission", "режим разрешений: plan, edit, deny"],
  ["/chats", "переключиться на другой диалог"],
  ["/new", "начать новый диалог"],
  ["/context", "заполнение контекстного окна"],
  ["/status", "текущая модель, проект и режим"],
  ["/compact", "сжать историю диалога"],
  ["/diff", "правки файлов в диалоге"],
  ["/undo", "откатить правки последней задачи"],
  ["/clear", "очистить экран"],
  ["/exit", "выйти"],
];

const PERMISSION_LABELS: Record<CliOptions["permissionMode"], string> = {
  plan: "plan · только чтение",
  edit: "edit · правки разрешены",
  deny: "deny · без инструментов",
};

export async function runRepl(
  client: BridgeClient,
  options: CliOptions,
  version: string,
): Promise<number> {
  const state = {
    conversationId: options.conversation,
    modelId: options.model,
    agentId: options.agent,
    projectId: options.project,
    permission: options.permissionMode,
    lastRunId: undefined as string | undefined,
    running: false,
  };

  const models = (await client.request("models.list")) as ModelOption[];
  const agents = (await client.request("agents.list")) as Named[];
  const projects = (await client.request("projects.list")) as ProjectOption[];
  if (!state.modelId) state.modelId = models[0]?.id;

  const modelName = (id: string | undefined) =>
    models.find((model) => model.id === id)?.name ?? id ?? "не выбрана";
  const projectName = (id: string | undefined) =>
    projects.find((project) => project.id === id)?.name ?? "не выбран";
  const agentName = (id: string | undefined) =>
    agents.find((agent) => agent.id === id)?.name ?? "без агента";

  const renderBanner = () =>
    banner({
      version,
      model: state.agentId
        ? `${agentName(state.agentId)} · агент`
        : modelName(state.modelId),
      project: projectName(state.projectId),
      permission: PERMISSION_LABELS[state.permission],
    });
  const refreshBanner = (message?: string) => {
    write(ANSI.clearScreen);
    renderBanner();
    if (message) bullet(message, "success");
  };

  renderBanner();

  const rl: Interface = createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: promptText(),
    historySize: 200,
    removeHistoryDuplicates: true,
    terminal: true,
    completer: (input: string) => {
      if (!input.startsWith("/")) return [[], input];
      const matches = COMMANDS.map(([name]) => name).filter((name) =>
        name.startsWith(input),
      );
      return [matches.length ? matches : COMMANDS.map(([name]) => name), input];
    },
  });

  let cancelRequested = false;
  let closed = false;
  let cancelActiveRun: (() => void) | undefined;
  rl.on("SIGINT", () => {
    if (state.running) {
      cancelActiveRun?.();
      return;
    }
    rl.close();
  });

  const runTask = async (text: string) => {
    if (!state.modelId && !state.agentId) {
      bullet("Не выбрана модель: /model", "danger");
      return;
    }
    const spinner = new Spinner("думаю");
    const files: string[] = [];
    let failure: string | undefined;
    let section: "none" | "reasoning" | "answer" = "none";
    let cancellationSent = false;
    let activeRunId: string | undefined;
    let done: () => void = () => undefined;
    const completion = new Promise<void>((resolve) => {
      done = resolve;
    });

    state.running = true;
    cancelRequested = false;
    spinner.start();

    const sendCancellation = () => {
      if (!cancelRequested || cancellationSent || !activeRunId) return;
      cancellationSent = true;
      void client.request("chat.cancel", { runId: activeRunId });
    };
    const requestCancellation = () => {
      if (cancelRequested) return;
      cancelRequested = true;
      spinner.stop();
      bullet("отменяю генерацию…", "danger");
      sendCancellation();
    };
    cancelActiveRun = requestCancellation;
    const releaseCancellation = captureRunCancellation(requestCancellation);
    const openSection = (next: "reasoning" | "answer") => {
      spinner.stop();
      if (section === next) return;
      if (section !== "none") line();
      line();
      if (next === "reasoning") reasoningHeading();
      else assistantHeading();
      section = next;
    };
    const closeSection = () => {
      spinner.stop();
      if (section !== "none") line();
      section = "none";
    };

    const handle = (event: RunEvent) => {
      switch (event.type) {
        case "run.started":
          activeRunId = event.runId;
          state.lastRunId = event.runId;
          sendCancellation();
          break;
        case "reasoning.delta":
          openSection("reasoning");
          write(style.italic(palette.faint(event.delta)));
          break;
        case "text.delta":
          openSection("answer");
          write(palette.text(event.delta));
          break;
        case "tool.requested":
          closeSection();
          bullet(
            `${symbols.tool} ${event.toolId}${event.input === undefined ? "" : ` ${compactValue(event.input)}`}`,
          );
          spinner.start();
          break;
        case "tool.running":
          closeSection();
          bullet(`${symbols.arrow} ${event.toolId} · выполняется`);
          spinner.start();
          break;
        case "tool.completed":
          closeSection();
          if (event.error) {
            bullet(`${symbols.fail} ${event.toolId}: ${event.error}`, "danger");
          } else
            bullet(
              `${symbols.ok} ${event.toolId}${event.output === undefined ? "" : ` ${compactValue(event.output)}`}`,
              "success",
            );
          spinner.start();
          break;
        case "file.changed":
          files.push(event.edit.path);
          closeSection();
          bullet(
            `${symbols.edit} ${event.edit.operation} ${event.edit.path}`,
            "success",
          );
          spinner.start();
          break;
        case "run.model.switched":
          closeSection();
          bullet(
            `${symbols.switched} ${modelName(event.change.from)} ${symbols.arrow} ${modelName(event.change.to)}: ${event.change.reason}`,
          );
          spinner.start();
          break;
        case "context.compacted":
          closeSection();
          bullet(
            `${symbols.compacted} контекст сжат: ${event.segment.messageCount} сообщений`,
          );
          spinner.start();
          break;
        case "run.failed":
          failure = event.message;
          done();
          break;
        case "run.cancelled":
          failure = "прервано";
          done();
          break;
        case "run.completed":
          done();
          break;
        default:
          break;
      }
    };

    try {
      const result = (await client.request(
        "chat.start",
        {
          conversationId: state.conversationId,
          mode: state.agentId ? "agent" : "chat",
          modelId: state.agentId ? undefined : state.modelId,
          agentId: state.agentId,
          projectId: state.projectId,
          text,
          permissionMode: state.permission,
        },
        (_name, payload) => handle(payload as RunEvent),
      )) as { runId: string; conversationId: string };

      state.lastRunId = result.runId;
      if (!state.conversationId) {
        state.conversationId = result.conversationId;
      }
      await completion;
    } catch (error) {
      failure = error instanceof Error ? error.message : String(error);
    } finally {
      cancelActiveRun = undefined;
      releaseCancellation();
      spinner.stop();
      state.running = false;
    }

    if (section !== "none") line();
    if (failure)
      bullet(
        cancelRequested ? "прервано пользователем" : failure,
        cancelRequested ? "muted" : "danger",
      );

    const context = await contextSummary(
      client,
      state.conversationId,
      state.modelId,
    );
    statusLine([
      [
        state.agentId ? "агент" : "модель",
        state.agentId ? agentName(state.agentId) : modelName(state.modelId),
      ],
      ["проект", projectName(state.projectId)],
      ["режим", state.permission],
      ...(files.length
        ? ([["файлов", String(files.length)]] as Array<[string, string]>)
        : []),
      ...(context
        ? ([["контекст", context.label]] as Array<[string, string]>)
        : []),
    ]);
    line();
  };

  const command = async (input: string) => {
    const [name, ...rest] = input.trim().split(/\s+/);
    const argument = rest.join(" ");
    switch (name) {
      case "/help":
        heading("Команды");
        table(COMMANDS);
        line();
        return;
      case "/model": {
        const picked = await select(
          "Модель",
          models.map((model) => ({ label: model.name, value: model.id })),
          Math.max(
            0,
            models.findIndex((model) => model.id === state.modelId),
          ),
        );
        if (picked) {
          state.modelId = picked;
          refreshBanner(`модель: ${modelName(picked)}`);
        }
        return;
      }
      case "/agent": {
        const picked = await select<string | null>("Агент", [
          { label: "без агента", hint: "обычный чат", value: null },
          ...agents.map((agent) => ({ label: agent.name, value: agent.id })),
        ]);
        if (picked !== undefined) {
          state.agentId = picked ?? undefined;
          refreshBanner(`агент: ${agentName(state.agentId)}`);
        }
        return;
      }
      case "/project": {
        const picked = await select<string | null>("Проект", [
          { label: "без проекта", value: null },
          ...projects.map((project) => ({
            label: project.name,
            hint: project.rootPath ?? "",
            value: project.id,
          })),
        ]);
        if (picked === undefined) return;
        state.projectId = picked ?? undefined;
        if (state.conversationId)
          await client.request("projects.assign", {
            conversationId: state.conversationId,
            projectId: picked,
          });
        refreshBanner(`проект: ${projectName(state.projectId)}`);
        return;
      }
      case "/permission": {
        const picked = await select<CliOptions["permissionMode"]>(
          "Режим разрешений",
          (["plan", "edit", "deny"] as const).map((value) => ({
            label: value,
            hint: PERMISSION_LABELS[value],
            value,
          })),
        );
        if (picked) {
          state.permission = picked;
          refreshBanner(`режим: ${PERMISSION_LABELS[picked]}`);
        }
        return;
      }
      case "/chats": {
        const conversations = (await client.request(
          "conversations.list",
        )) as Array<{ id: string; title: string }>;
        const picked = await select(
          "Диалог",
          conversations.map((item) => ({ label: item.title, value: item.id })),
        );
        if (picked) {
          state.conversationId = picked;
          bullet("диалог переключён");
        }
        return;
      }
      case "/new":
        state.conversationId = undefined;
        state.lastRunId = undefined;
        bullet("начат новый диалог");
        return;
      case "/context": {
        const context = await contextSummary(
          client,
          state.conversationId,
          state.modelId,
        );
        if (context)
          bullet(
            `контекст ${progressBar(context.percent)} · ${context.usedTokens.toLocaleString("ru-RU")} / ${context.usableTokens.toLocaleString("ru-RU")} токенов`,
          );
        else bullet("контекст пока пуст");
        return;
      }
      case "/status": {
        const context = await contextSummary(
          client,
          state.conversationId,
          state.modelId,
        );
        heading("Текущая сессия");
        table([
          ["модель", modelName(state.modelId)],
          ["агент", agentName(state.agentId)],
          ["проект", projectName(state.projectId)],
          ["доступ", PERMISSION_LABELS[state.permission]],
          ["диалог", state.conversationId ?? "новый"],
          ["контекст", context?.label ?? "пуст"],
        ]);
        line();
        return;
      }
      case "/compact": {
        if (!state.conversationId || !state.modelId) {
          bullet("нечего сжимать", "danger");
          return;
        }
        const spinner = new Spinner("сжимаю контекст");
        spinner.start();
        try {
          const segment = (await client.request("chat.compact", {
            conversationId: state.conversationId,
            modelId: state.modelId,
            focus: argument || undefined,
          })) as { messageCount: number } | null;
          spinner.stop();
          bullet(
            segment
              ? `сжато ${segment.messageCount} сообщений`
              : "сжимать пока нечего",
          );
        } finally {
          spinner.stop();
        }
        return;
      }
      case "/diff": {
        if (!state.conversationId) {
          bullet("в этом диалоге ещё нет правок");
          return;
        }
        const edits = (await client.request("files.edits", {
          conversationId: state.conversationId,
        })) as Array<{ path: string; operation: string; reverted: boolean }>;
        if (!edits.length) {
          bullet("правок файлов пока нет");
          return;
        }
        heading("Правки файлов");
        table(
          edits.map((edit) => [
            edit.path,
            `${edit.operation}${edit.reverted ? " · откачен" : ""}`,
          ]),
        );
        line();
        return;
      }
      case "/undo": {
        const runId = argument || state.lastRunId;
        if (!runId) {
          bullet("нет задачи для отката", "danger");
          return;
        }
        const result = (await client.request("files.revert", { runId })) as {
          restored: string[];
          failed: string[];
        };
        bullet(
          `восстановлено файлов: ${result.restored.length}${result.failed.length ? `, не удалось: ${result.failed.length}` : ""}`,
          result.failed.length ? "danger" : "success",
        );
        return;
      }
      case "/clear":
        write(ANSI.clearScreen);
        renderBanner();
        return;
      case "/exit":
      case "/quit":
        rl.close();
        return;
      default:
        bullet(`неизвестная команда ${name}, попробуйте /help`, "danger");
    }
  };

  return new Promise<number>((resolve) => {
    rl.prompt();
    rl.on("line", (input) => {
      const value = input.trim();
      if (!value) {
        rl.prompt();
        return;
      }
      rl.pause();
      const task = value.startsWith("/") ? command(value) : runTask(value);
      void task
        .catch((error: unknown) =>
          bullet(
            error instanceof Error ? error.message : String(error),
            "danger",
          ),
        )
        .finally(() => {
          if (closed) return;
          rl.resume();
          rl.prompt();
        });
    });
    rl.on("close", () => {
      closed = true;
      divider();
      note(`${palette.accent(symbols.mark)} ${style.dim("до встречи")}`);
      resolve(0);
    });
  });
}

async function contextSummary(
  client: BridgeClient,
  conversationId: string | undefined,
  modelId: string | undefined,
): Promise<
  | {
      label: string;
      percent: number;
      usedTokens: number;
      usableTokens: number;
    }
  | undefined
> {
  if (!conversationId || !modelId) return undefined;
  try {
    const window = (await client.request("chat.context", {
      conversationId,
      modelId,
    })) as { usedTokens: number; usableTokens: number };
    const percent = Math.round(
      (window.usedTokens / Math.max(1, window.usableTokens)) * 100,
    );
    return {
      label: `${percent}% · ${window.usedTokens.toLocaleString("ru-RU")}/${window.usableTokens.toLocaleString("ru-RU")}`,
      percent,
      usedTokens: window.usedTokens,
      usableTokens: window.usableTokens,
    };
  } catch {
    return undefined;
  }
}
