export type CliCommand =
  | "chat"
  | "status"
  | "projects"
  | "models"
  | "agents"
  | "compact"
  | "diff"
  | "undo"
  | "help";

export interface CliOptions {
  command: CliCommand;
  prompt?: string;
  model?: string;
  agent?: string;
  project?: string;
  projectDirectory: boolean;
  conversation?: string;
  runId?: string;
  focus?: string;
  permissionMode: "plan" | "edit" | "deny";
  output: "text" | "json" | "stream-json";
  home?: string;
  positional: string[];
}

const COMMANDS = new Set<CliCommand>([
  "chat",
  "status",
  "projects",
  "models",
  "agents",
  "compact",
  "diff",
  "undo",
  "help",
]);

export function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    command: "chat",
    permissionMode: "edit",
    output: "text",
    projectDirectory: false,
    positional: [],
  };

  let index = 0;
  const first = argv[0];
  if (first && !first.startsWith("-") && COMMANDS.has(first as CliCommand)) {
    options.command = first as CliCommand;
    index = 1;
  }

  for (; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === undefined) break;
    const next = () => {
      index += 1;
      const value = argv[index];
      if (value === undefined)
        throw new Error(`Для параметра ${argument} не указано значение`);
      return value;
    };

    switch (argument) {
      case "-p":
      case "--prompt":
        options.prompt = next();
        break;
      case "--model":
        options.model = next();
        break;
      case "--agent":
        options.agent = next();
        break;
      case "--project":
        options.project = next();
        break;
      case "--pd":
      case "--project-dir":
        options.projectDirectory = true;
        break;
      case "--conversation":
        options.conversation = next();
        break;
      case "--run":
        options.runId = next();
        break;
      case "--focus":
        options.focus = next();
        break;
      case "--home":
        options.home = next();
        break;
      case "--permission-mode": {
        const value = next();
        if (value !== "plan" && value !== "edit" && value !== "deny")
          throw new Error(
            `Неизвестный режим разрешений «${value}». Доступны: plan, edit, deny`,
          );
        options.permissionMode = value;
        break;
      }
      case "--json":
        options.output = "json";
        break;
      case "--stream-json":
        options.output = "stream-json";
        break;
      case "-h":
      case "--help":
        options.command = "help";
        break;
      default:
        if (argument.startsWith("-"))
          throw new Error(`Неизвестный параметр ${argument}`);
        options.positional.push(argument);
    }
  }

  if (
    !options.prompt &&
    options.command === "chat" &&
    options.positional.length
  )
    options.prompt = options.positional.join(" ");
  if (!options.runId && options.command === "undo" && options.positional[0])
    options.runId = options.positional[0];
  if (options.projectDirectory && options.project)
    throw new Error("Параметры --project и --pd нельзя использовать вместе");

  return options;
}

export const CLI_USAGE = [
  ["zvs", "интерактивный режим"],
  ['zvs -p "почини тесты"', "отправить задачу и выйти"],
  ['zvs chat -p "..." --json', "машинный вывод одним объектом"],
  ['zvs chat -p "..." --stream-json', "поток событий JSON Lines"],
  ["zvs status", "состояние приложения и моста"],
  ["zvs projects", "список проектов"],
  ["zvs models", "включённые текстовые модели"],
  ["zvs agents", "доступные агенты"],
  ['zvs compact --focus "..."', "сжать контекст текущего диалога"],
  ["zvs diff", "правки файлов в диалоге"],
  ["zvs undo <runId>", "откатить правки задачи"],
] as const;

export const CLI_OPTIONS_HELP = [
  ["--model <id>", "модель для режимов chat и planner"],
  ["--agent <id>", "агент и его инструменты"],
  ["--project <id>", "привязать диалог к проекту"],
  ["--pd, --project-dir", "создать или выбрать проект для текущего каталога"],
  ["--conversation <id>", "продолжить существующий диалог"],
  ["--permission-mode <m>", "plan | edit | deny, по умолчанию edit"],
  ["--home <path>", "каталог данных приложения"],
  ["-h, --help", "эта справка"],
] as const;

function plainSection(
  title: string,
  rows: ReadonlyArray<readonly [string, string]>,
): string {
  const width = rows.reduce((max, [left]) => Math.max(max, left.length), 0);
  return `${title}:\n${rows
    .map(([left, right]) => `  ${left.padEnd(width)}  ${right}`)
    .join("\n")}`;
}

export const HELP_TEXT = `ZVS Assistant — интерактивная командная оболочка

${plainSection("Использование", CLI_USAGE)}

${plainSection("Параметры", CLI_OPTIONS_HELP)}

Интерактивно: Tab — команды, ↑↓ — история, Ctrl+C — отмена задачи или выход, /help — помощь.

Коды возврата: 0 успех, 1 ошибка, 2 запрещено, 3 приложение недоступно.`;
