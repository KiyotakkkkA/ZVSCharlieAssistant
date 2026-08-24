import type { RunEvent } from "../shared/models/chat";
import type { BridgeClient } from "./client";
import type { CliOptions } from "./args";
import { palette, style, symbols } from "./theme";
import {
  Spinner,
  assistantHeading,
  compactValue,
  errorMessage,
  line,
  reasoningHeading,
} from "./ui";

const EXIT_OK = 0;
const EXIT_ERROR = 1;
const EXIT_DENIED = 2;

interface ChatOutcome {
  runId: string;
  conversationId: string;
  text: string;
  toolCalls: Array<{ toolId: string; error?: string }>;
  files: string[];
  switches: Array<{ from: string; to: string; reason: string }>;
  compactions: number;
  failure?: string;
}

export async function runChat(
  client: BridgeClient,
  options: CliOptions,
): Promise<number> {
  const prompt = options.prompt?.trim();
  if (!prompt) {
    errorMessage("Укажите задачу", 'Например: zvs -p "проверь проект"');
    return EXIT_ERROR;
  }

  const mode = options.agent ? "agent" : "chat";
  const modelId =
    options.model ?? (mode === "chat" ? await firstModelId(client) : undefined);
  if (mode === "chat" && !modelId) {
    process.stderr.write("Не найдено ни одной включённой модели\n");
    return EXIT_ERROR;
  }

  const outcome: ChatOutcome = {
    runId: "",
    conversationId: options.conversation ?? "",
    text: "",
    toolCalls: [],
    files: [],
    switches: [],
    compactions: 0,
  };

  const streaming = options.output === "text";
  const done = createDeferred();
  const spinner = new Spinner("думаю");
  let section: "none" | "reasoning" | "answer" = "none";
  let activeRunId: string | undefined;
  let cancelRequested = false;
  let cancellationSent = false;
  const sendCancellation = () => {
    if (cancellationSent || !activeRunId) return;
    cancellationSent = true;
    void client.request("chat.cancel", { runId: activeRunId });
  };
  const onSigint = () => {
    if (cancelRequested) return;
    cancelRequested = true;
    spinner.stop();
    process.stderr.write(`${palette.danger("  отменяю генерацию…")}\n`);
    sendCancellation();
  };
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
  if (streaming) spinner.start();
  process.on("SIGINT", onSigint);

  let started: { runId: string; conversationId: string };
  try {
    started = (await client.request(
      "chat.start",
      {
        conversationId: options.conversation,
        mode,
        modelId,
        agentId: options.agent,
        projectId: options.project,
        text: prompt,
        permissionMode: options.permissionMode,
      },
      (_name, payload) => {
        const event = payload as RunEvent;
        if (event.type === "run.started") {
          activeRunId = event.runId;
          sendCancellation();
        }
        if (streaming) {
          if (event.type === "reasoning.delta") openSection("reasoning");
          else if (event.type === "text.delta") openSection("answer");
          else if (
            event.type === "tool.requested" ||
            event.type === "tool.running" ||
            event.type === "tool.completed" ||
            event.type === "file.changed" ||
            event.type === "run.model.switched" ||
            event.type === "context.compacted" ||
            event.type === "run.completed" ||
            event.type === "run.failed" ||
            event.type === "run.cancelled"
          )
            closeSection();
        }
        if (options.output === "stream-json") {
          process.stdout.write(`${JSON.stringify(event)}\n`);
        }
        apply(event, outcome, streaming);
        if (
          event.type === "run.completed" ||
          event.type === "run.failed" ||
          event.type === "run.cancelled"
        )
          done.resolve();
        else if (
          streaming &&
          event.type !== "reasoning.delta" &&
          event.type !== "text.delta"
        )
          spinner.start();
      },
    )) as { runId: string; conversationId: string };

    outcome.runId = started.runId;
    outcome.conversationId = started.conversationId;

    await done.promise;
  } finally {
    process.off("SIGINT", onSigint);
    spinner.stop();
  }

  if (options.output === "json")
    process.stdout.write(`${JSON.stringify(outcome, null, 2)}\n`);
  else if (options.output === "text") {
    if (!outcome.text.endsWith("\n")) process.stdout.write("\n");
    writeSummary(outcome);
  }

  if (!outcome.failure) return EXIT_OK;
  return /запрещ|не разрешен|вне разрешённых|политик/i.test(outcome.failure)
    ? EXIT_DENIED
    : EXIT_ERROR;
}

function apply(event: RunEvent, outcome: ChatOutcome, streaming: boolean) {
  switch (event.type) {
    case "text.delta":
      outcome.text += event.delta;
      if (streaming) process.stdout.write(palette.text(event.delta));
      break;
    case "reasoning.delta":
      if (streaming)
        process.stdout.write(style.italic(palette.faint(event.delta)));
      break;
    case "tool.requested":
      outcome.toolCalls.push({ toolId: event.toolId });
      if (streaming)
        process.stderr.write(
          `  ${palette.faint(symbols.tool)} ${palette.muted(event.toolId)}${event.input === undefined ? "" : ` ${palette.faint(compactValue(event.input))}`}\n`,
        );
      break;
    case "tool.running":
      if (streaming)
        process.stderr.write(
          `  ${palette.faint(symbols.arrow)} ${palette.muted(`${event.toolId} · выполняется`)}\n`,
        );
      break;
    case "tool.completed":
      if (event.error) {
        const last = outcome.toolCalls[outcome.toolCalls.length - 1];
        if (last) last.error = event.error;
        if (streaming)
          process.stderr.write(
            `  ${palette.danger(symbols.fail)} ${palette.danger(`${event.toolId}: ${event.error}`)}\n`,
          );
      } else if (streaming)
        process.stderr.write(
          `  ${palette.success(symbols.ok)} ${palette.success(event.toolId)}${event.output === undefined ? "" : ` ${palette.faint(compactValue(event.output))}`}\n`,
        );
      break;
    case "file.changed":
      outcome.files.push(event.edit.path);
      if (streaming)
        process.stderr.write(
          `  ${palette.success(symbols.edit)} ${palette.muted(`${event.edit.operation} ${event.edit.path}`)}\n`,
        );
      break;
    case "run.model.switched":
      outcome.switches.push({
        from: event.change.from,
        to: event.change.to,
        reason: event.change.reason,
      });
      if (streaming)
        process.stderr.write(
          `  ${palette.warning(symbols.switched)} ${palette.muted(`модель переключена: ${event.change.reason}`)}\n`,
        );
      break;
    case "context.compacted":
      outcome.compactions += 1;
      if (streaming)
        process.stderr.write(
          `  ${palette.info(symbols.compacted)} ${palette.muted(`контекст сжат: ${event.segment.messageCount} сообщений`)}\n`,
        );
      break;
    case "run.failed":
      outcome.failure = event.message;
      break;
    case "run.cancelled":
      outcome.failure = "Выполнение прервано";
      break;
    default:
      break;
  }
}

function writeSummary(outcome: ChatOutcome) {
  const parts: string[] = [];
  if (outcome.files.length) parts.push(`файлов изменено: ${outcome.files.length}`);
  if (outcome.toolCalls.length)
    parts.push(`вызовов инструментов: ${outcome.toolCalls.length}`);
  if (outcome.compactions) parts.push(`сжатий контекста: ${outcome.compactions}`);
  if (outcome.switches.length)
    parts.push(`переключений модели: ${outcome.switches.length}`);
  if (parts.length) process.stderr.write(`${palette.faint(parts.join(", "))}\n`);
  if (outcome.failure) process.stderr.write(`${palette.danger(outcome.failure)}\n`);
  if (outcome.runId)
    process.stderr.write(`${palette.faint(`задача ${outcome.runId}`)}\n`);
}

async function firstModelId(client: BridgeClient): Promise<string | undefined> {
  const models = (await client.request("models.list")) as Array<{ id: string }>;
  return models[0]?.id;
}

function createDeferred() {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
