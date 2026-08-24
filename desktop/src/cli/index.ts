import { defaultUserDataPath } from "../shared/bridge/bridge-paths";
import { BridgeClient, BridgeUnavailableError } from "./client";
import { HELP_TEXT, parseArgs, type CliOptions } from "./args";
import { runChat } from "./render";

const EXIT_OK = 0;
const EXIT_ERROR = 1;
const EXIT_DENIED = 2;
const EXIT_UNAVAILABLE = 3;

async function main(): Promise<number> {
  let options: CliOptions;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${messageOf(error)}\n`);
    return EXIT_ERROR;
  }

  if (options.command === "help") {
    process.stdout.write(`${HELP_TEXT}\n`);
    return EXIT_OK;
  }

  const client = new BridgeClient(options.home ?? defaultUserDataPath());
  try {
    await client.connect();
    return await dispatch(client, options);
  } catch (error) {
    if (error instanceof BridgeUnavailableError) {
      process.stderr.write(`${error.message}\n`);
      return EXIT_UNAVAILABLE;
    }
    const message = messageOf(error);
    process.stderr.write(`${message}\n`);
    return /запрещ|не разрешен|вне разрешённых|политик/i.test(message)
      ? EXIT_DENIED
      : EXIT_ERROR;
  } finally {
    client.disconnect();
  }
}

async function dispatch(
  client: BridgeClient,
  options: CliOptions,
): Promise<number> {
  switch (options.command) {
    case "status":
      return print(await client.request("status"), options);
    case "projects":
      return print(await client.request("projects.list"), options);
    case "models":
      return print(await client.request("models.list"), options);
    case "agents":
      return print(await client.request("agents.list"), options);
    case "compact": {
      const conversationId = await resolveConversation(client, options);
      if (!conversationId) return EXIT_ERROR;
      const modelId = options.model ?? (await firstModelId(client));
      if (!modelId) {
        process.stderr.write("Не найдено ни одной включённой модели\n");
        return EXIT_ERROR;
      }
      return print(
        await client.request("chat.compact", {
          conversationId,
          modelId,
          focus: options.focus,
        }),
        options,
      );
    }
    case "diff": {
      const conversationId = await resolveConversation(client, options);
      if (!conversationId) return EXIT_ERROR;
      return print(
        await client.request("files.edits", { conversationId }),
        options,
      );
    }
    case "undo": {
      if (!options.runId) {
        process.stderr.write("Укажите идентификатор задачи: zvs undo <runId>\n");
        return EXIT_ERROR;
      }
      return print(
        await client.request("files.revert", { runId: options.runId }),
        options,
      );
    }
    case "chat":
      return runChat(client, options);
    default:
      process.stdout.write(`${HELP_TEXT}\n`);
      return EXIT_OK;
  }
}

async function resolveConversation(
  client: BridgeClient,
  options: CliOptions,
): Promise<string | undefined> {
  if (options.conversation) return options.conversation;
  const conversations = (await client.request("conversations.list")) as Array<{
    id: string;
  }>;
  const latest = conversations[0]?.id;
  if (!latest) process.stderr.write("Нет ни одного диалога\n");
  return latest;
}

async function firstModelId(client: BridgeClient): Promise<string | undefined> {
  const models = (await client.request("models.list")) as Array<{ id: string }>;
  return models[0]?.id;
}

function print(value: unknown, options: CliOptions): number {
  if (options.output === "text") {
    process.stdout.write(`${formatText(value)}\n`);
    return EXIT_OK;
  }
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
  return EXIT_OK;
}

function formatText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value))
    return value.map((item) => formatRow(item)).join("\n");
  return formatRow(value);
}

function formatRow(item: unknown): string {
  if (item === null || typeof item !== "object") return String(item);
  const record = item as Record<string, unknown>;
  const id = record.id;
  const label = record.name ?? record.title ?? record.path ?? "";
  if (id && label) return `${String(id)}  ${String(label)}`;
  return Object.entries(record)
    .map(([key, entry]) => `${key}: ${String(entry)}`)
    .join("  ");
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    process.stderr.write(`${messageOf(error)}\n`);
    process.exitCode = EXIT_ERROR;
  });
