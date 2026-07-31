import type { AutomationSnapshot } from "./models";

export const AUTOMATION_MOCK_SNAPSHOT: AutomationSnapshot = {
  tools: [
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
      description: "Ищет актуальную информацию и возвращает список источников.",
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
        properties: {
          results: { type: "array", items: { type: "object" } },
        },
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
        properties: {
          status: { type: "number" },
          body: {},
        },
      },
    },
  ],
  agents: [
    {
      id: "computer-operator",
      name: "Оператор компьютера",
      description:
        "Выполняет системные действия, управляет файлами и приложениями.",
      instructions:
        "Выполняй только необходимые действия. Перед потенциально опасными операциями запроси подтверждение.",
      model: "local-default",
      status: "active",
      allowedToolIds: [
        "filesystem.read",
        "filesystem.write",
        "desktop.launch",
      ],
      secretBindings: [],
      requireDangerousActionConfirmation: true,
      maxToolCalls: 20,
      timeoutSeconds: 120,
      runs: 248,
      updatedAt: "5 мин назад",
    },
    {
      id: "researcher",
      name: "Исследователь",
      description:
        "Собирает информацию, сравнивает источники и готовит краткие отчёты.",
      instructions:
        "Проверяй факты по нескольким источникам и явно отделяй факты от выводов.",
      model: "local-default",
      status: "active",
      allowedToolIds: ["web.search", "http.request", "filesystem.write"],
      secretBindings: [],
      requireDangerousActionConfirmation: true,
      maxToolCalls: 30,
      timeoutSeconds: 180,
      runs: 91,
      updatedAt: "2 ч назад",
    },
    {
      id: "task-planner",
      name: "Планировщик задач",
      description:
        "Декомпозирует цели и подготавливает план работы для сценария.",
      instructions:
        "Разделяй цель на проверяемые шаги и указывай ожидаемый результат каждого шага.",
      model: "local-default",
      status: "draft",
      allowedToolIds: [],
      secretBindings: [],
      requireDangerousActionConfirmation: true,
      maxToolCalls: 10,
      timeoutSeconds: 60,
      runs: 0,
      updatedAt: "вчера",
    },
  ],
  scenarios: [
    {
      id: "user-request",
      name: "Обработка пользовательской задачи",
      description:
        "Оркестратор выбирает исследователя или оператора компьютера и объединяет результат.",
      status: "active",
      nodesCount: 5,
      lastRunAt: "5 мин назад",
      updatedAt: "сегодня, 14:26",
    },
    {
      id: "research-report",
      name: "Подготовка отчёта",
      description:
        "Последовательный сбор источников, проверка фактов и сохранение отчёта.",
      status: "draft",
      nodesCount: 4,
      lastRunAt: null,
      updatedAt: "вчера, 18:10",
    },
  ],
};
