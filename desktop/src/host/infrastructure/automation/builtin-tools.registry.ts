import type { AutomationTool } from "../../../ipc/contracts";

export const BUILTIN_AUTOMATION_TOOLS: readonly AutomationTool[] = [
  {
    id: "filesystem.read",
    name: "Чтение файлов",
    description: "Читает содержимое файла в разрешённой директории.",
    category: "Файловая система",
    builtin: true,
    enabled: true,
    requiresConfirmation: false,
    inputSchema: {
      type: "object",
      required: ["path"],
      properties: { path: { type: "string", description: "Путь к файлу" } },
    },
    outputSchema: {
      type: "object",
      properties: {
        content: { type: "string" },
        encoding: { type: "string" },
      },
    },
  },
  {
    id: "filesystem.write",
    name: "Запись файлов",
    description: "Создаёт или изменяет файл после проверки разрешений.",
    category: "Файловая система",
    builtin: true,
    enabled: true,
    requiresConfirmation: true,
    inputSchema: {
      type: "object",
      required: ["path", "content"],
      properties: {
        path: { type: "string" },
        content: { type: "string" },
      },
    },
    outputSchema: {
      type: "object",
      properties: { written: { type: "boolean" } },
    },
  },
  {
    id: "desktop.launch",
    name: "Запуск приложения",
    description: "Запускает установленное приложение на компьютере.",
    category: "Управление компьютером",
    builtin: true,
    enabled: true,
    requiresConfirmation: true,
    inputSchema: {
      type: "object",
      required: ["application"],
      properties: {
        application: { type: "string" },
        arguments: { type: "array", items: { type: "string" } },
      },
    },
    outputSchema: {
      type: "object",
      properties: { processId: { type: "number" } },
    },
  },
  {
    id: "web.search",
    name: "Поиск в интернете",
    description: "Ищет информацию и возвращает список источников.",
    category: "Интернет",
    builtin: true,
    enabled: true,
    requiresConfirmation: false,
    inputSchema: {
      type: "object",
      required: ["query"],
      properties: { query: { type: "string" } },
    },
    outputSchema: {
      type: "object",
      properties: { results: { type: "array", items: { type: "object" } } },
    },
  },
  {
    id: "http.request",
    name: "HTTP-запрос",
    description: "Выполняет запрос к API с разрешёнными учётными данными.",
    category: "Интернет",
    builtin: true,
    enabled: true,
    requiresConfirmation: false,
    inputSchema: {
      type: "object",
      required: ["url", "method"],
      properties: {
        url: { type: "string" },
        method: { type: "string" },
        body: { type: ["object", "null"] },
      },
    },
    outputSchema: {
      type: "object",
      properties: { status: { type: "number" }, body: {} },
    },
  },
] as const;
