export interface CommandDescriptor {
  name: string;
  description: string;
  usage?: string;
}

export const commandCatalog: CommandDescriptor[] = [
  { name: "/help", description: "список команд" },
  { name: "/model", description: "выбрать модель" },
  { name: "/agent", description: "выбрать или отключить агента" },
  { name: "/project", description: "привязать проект" },
  { name: "/permission", description: "режим разрешений" },
  { name: "/chats", description: "список диалогов" },
  {
    name: "/resume",
    description: "восстановить одну из 5 последних сессий",
    usage: "[поиск]",
  },
  { name: "/rename", description: "переименовать диалог", usage: "[название]" },
  { name: "/new", description: "начать новый диалог" },
  { name: "/context", description: "заполнение контекста" },
  { name: "/status", description: "текущая конфигурация" },
  { name: "/compact", description: "сжать историю", usage: "[фокус]" },
  { name: "/diff", description: "правки файлов" },
  { name: "/undo", description: "откатить задачу", usage: "[runId]" },
  { name: "/clear", description: "очистить экран" },
  { name: "/mouse", description: "включить или выключить мышь" },
  { name: "/exit", description: "выйти" },
];

export function commandSuggestions(value: string): CommandDescriptor[] {
  if (!value.startsWith("/") || value.includes(" ")) return [];
  return commandCatalog.filter((command) => command.name.startsWith(value));
}
