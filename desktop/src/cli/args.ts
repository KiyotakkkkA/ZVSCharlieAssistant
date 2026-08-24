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

  if (!options.prompt && options.command === "chat" && options.positional.length)
    options.prompt = options.positional.join(" ");
  if (!options.runId && options.command === "undo" && options.positional[0])
    options.runId = options.positional[0];

  return options;
}

export const HELP_TEXT = `zvs — командная строка ассистента ZVS

Использование:
  zvs -p "почини падающие тесты"        отправить задачу в запущенное приложение
  zvs chat -p "..." --json              машинный вывод одним объектом
  zvs chat -p "..." --stream-json       поток событий по строке на событие
  zvs status                            состояние приложения и моста
  zvs projects                          список проектов
  zvs models                            включённые текстовые модели
  zvs agents                            доступные агенты
  zvs compact --focus "..."             сжать контекст текущего диалога
  zvs diff                              правки файлов в диалоге
  zvs undo <runId>                      откатить правки задачи

Параметры:
  --model <id>            модель для режимов chat и planner
  --agent <id>            агент (включает инструменты)
  --project <id>          привязать диалог к проекту
  --conversation <id>     продолжить существующий диалог
  --permission-mode <m>   plan | edit | deny, по умолчанию edit
  --home <path>           каталог данных приложения
  -h, --help              эта справка

Коды возврата: 0 успех, 1 ошибка, 2 запрещено политикой, 3 приложение недоступно.`;
