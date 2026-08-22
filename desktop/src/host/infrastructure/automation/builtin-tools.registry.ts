import type { AutomationTool } from "../../../shared/models/automation";
import { SYSTEM_SECRET_CATEGORY_IDS } from "../../../shared/entity-ids";

const ollamaApiKey = {
  key: "ollamaApiKey",
  label: "Ollama API key",
  categoryId: SYSTEM_SECRET_CATEGORY_IDS.apiKeys,
  required: true,
} as const;

export const BUILTIN_AUTOMATION_TOOLS: readonly AutomationTool[] = [
  {
    id: "tasks_plan",
    name: "План задач",
    description:
      "Составляет и обновляет список задач для текущей работы. Список виден пользователю в чате.",
    category: "Планирование",
    builtin: true,
    enabled: true,
    requiresConfirmation: false,
    inputSchema: {
      type: "object",
      required: ["tasks"],
      properties: {
        tasks: {
          type: "array",
          description: "Полный актуальный список задач",
          items: {
            type: "object",
            required: ["subject"],
            properties: {
              subject: { type: "string" },
              detail: { type: "string" },
              status: {
                enum: ["pending", "in_progress", "completed", "skipped"],
              },
            },
          },
        },
      },
    },
    outputSchema: { type: "object" },
    secretRequirements: [],
    secretBindings: [],
  },
  {
    id: "memory_search",
    name: "Поиск в памяти",
    description:
      "Ищет ранее сохранённые факты, предпочтения и указания пользователя.",
    category: "Память",
    builtin: true,
    enabled: true,
    requiresConfirmation: false,
    inputSchema: {
      type: "object",
      required: ["query"],
      properties: {
        query: { type: "string", description: "Поисковый запрос" },
        limit: { type: "integer", minimum: 1, maximum: 25 },
      },
    },
    outputSchema: { type: "object" },
    secretRequirements: [],
    secretBindings: [],
  },
  {
    id: "memory_save",
    name: "Запись в память",
    description:
      "Сохраняет факт, предпочтение или указание, которое должно пережить текущий диалог.",
    category: "Память",
    builtin: true,
    enabled: true,
    requiresConfirmation: false,
    inputSchema: {
      type: "object",
      required: ["kind", "title", "content"],
      properties: {
        kind: { enum: ["fact", "preference", "instruction", "episode"] },
        title: {
          type: "string",
          description: "Короткий заголовок, он же ключ",
        },
        content: { type: "string" },
        tags: { type: "array", items: { type: "string" } },
      },
    },
    outputSchema: { type: "object" },
    secretRequirements: [],
    secretBindings: [],
  },
  {
    id: "ask_user",
    name: "Вопрос пользователю",
    description:
      "Задаёт уточняющий вопрос с вариантами ответа и дожидается выбора пользователя.",
    category: "Планирование",
    builtin: true,
    enabled: true,
    requiresConfirmation: false,
    inputSchema: {
      type: "object",
      required: ["question"],
      properties: {
        header: { type: "string", description: "Короткий заголовок вопроса" },
        question: { type: "string" },
        options: {
          type: "array",
          items: {
            type: "object",
            required: ["label"],
            properties: {
              label: { type: "string" },
              description: { type: "string" },
            },
          },
        },
        multiSelect: { type: "boolean" },
      },
    },
    outputSchema: { type: "object" },
    secretRequirements: [],
    secretBindings: [],
  },
  {
    id: "grep_search",
    name: "Поиск файлов и папок",
    description:
      "Ищет файлы и директории по имени внутри разрешённых агенту путей.",
    category: "Файловая система",
    builtin: true,
    enabled: true,
    requiresConfirmation: false,
    inputSchema: {
      type: "object",
      required: ["base", "query"],
      properties: {
        base: { type: "string", description: "Разрешённая базовая директория" },
        query: { type: "string", description: "Имя или шаблон сущности" },
        entityTypes: { type: "array", items: { type: "string" } },
        matchMode: { enum: ["exact", "contains", "glob"] },
        limit: { type: "integer", minimum: 1, maximum: 1000 },
      },
    },
    outputSchema: { type: "object" },
    secretRequirements: [],
    secretBindings: [],
  },
  {
    id: "regexp_search",
    name: "Поиск по содержимому файлов",
    description: "Ищет текст или регулярное выражение в файле либо директории.",
    category: "Файловая система",
    builtin: true,
    enabled: true,
    requiresConfirmation: false,
    inputSchema: {
      type: "object",
      required: ["base", "pattern"],
      properties: {
        base: { type: "string", description: "Разрешённая базовая директория" },
        target: {
          type: "string",
          description: "Относительный файл или директория",
        },
        pattern: {
          type: "string",
          description: "Текст или регулярное выражение",
        },
        mode: { enum: ["regex", "literal"] },
        include: { type: "array", items: { type: "string" } },
        exclude: { type: "array", items: { type: "string" } },
        limit: { type: "integer", minimum: 1, maximum: 1000 },
      },
    },
    outputSchema: { type: "object" },
    secretRequirements: [],
    secretBindings: [],
  },
  {
    id: "cmd_exec",
    name: "PowerShell",
    description:
      "Выполняет PowerShell-команды в управляемой сессии согласно глобальной политике и ограничениям агента.",
    category: "Система",
    builtin: true,
    enabled: true,
    requiresConfirmation: true,
    inputSchema: {
      type: "object",
      required: ["action"],
      properties: {
        action: { enum: ["start", "status", "output", "wait", "cancel"] },
        script: { type: "string" },
        purpose: { type: "string" },
        cwd: { type: "string" },
        execution: { enum: ["foreground", "background"] },
        sessionId: { type: "string" },
      },
    },
    outputSchema: { type: "object" },
    secretRequirements: [],
    secretBindings: [],
  },
  {
    id: "web_search",
    name: "Поиск в интернете",
    description: "Ищет информацию и возвращает список источников.",
    category: "Интернет",
    builtin: true,
    enabled: true,
    requiresConfirmation: false,
    inputSchema: {
      type: "object",
      required: ["query"],
      properties: {
        query: { type: "string", description: "Поисковый запрос" },
      },
    },
    outputSchema: {
      type: "object",
      properties: {
        results: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              url: { type: "string" },
              content: { type: "string" },
            },
          },
        },
      },
    },
    secretRequirements: [ollamaApiKey],
    secretBindings: [],
  },
  {
    id: "web_fetch",
    name: "Поиск на странице",
    description: "Получает очищенное содержимое страницы",
    category: "Интернет",
    builtin: true,
    enabled: true,
    requiresConfirmation: false,
    inputSchema: {
      type: "object",
      required: ["url"],
      properties: {
        url: { type: "string", description: "URL страницы" },
      },
    },
    outputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        content: { type: "string" },
        links: { type: "array", items: { type: "string" } },
      },
    },
    secretRequirements: [ollamaApiKey],
    secretBindings: [],
  },
  {
    id: "vecdb_search",
    name: "Поиск в векторной базе",
    description: "Ищет релевантные фрагменты в разрешённых базах знаний.",
    category: "База знаний",
    builtin: true,
    enabled: true,
    requiresConfirmation: false,
    inputSchema: {
      type: "object",
      required: ["query"],
      properties: {
        query: { type: "string" },
        storeIds: { type: "array", items: { type: "integer" } },
        limit: { type: "integer", minimum: 1, maximum: 20 },
        scoreThreshold: { type: "number", minimum: 0, maximum: 1 },
      },
    },
    outputSchema: {
      type: "array",
      items: { type: "object" },
    },
    secretRequirements: [],
    secretBindings: [],
  },
  {
    id: "reports_docx",
    name: "Создание отчётов DOCX",
    description:
      "Создаёт структурированный документ Word по встроенному шаблону оформления ГОСТ.",
    category: "Документы",
    builtin: true,
    enabled: true,
    requiresConfirmation: true,
    inputSchema: {
      type: "object",
      required: ["fileName", "template", "blocks"],
      properties: {
        fileName: { type: "string" },
        template: { type: "string", enum: ["mirea-report-gost"] },
        title: { type: "string" },
        blocks: {
          type: "array",
          items: {
            type: "object",
            description: "heading, paragraph, list, table, code или pageBreak",
          },
        },
      },
    },
    outputSchema: {
      type: "object",
      properties: {
        path: { type: "string" },
        fileName: { type: "string" },
        blocks: { type: "integer" },
      },
    },
    secretRequirements: [],
    secretBindings: [],
  },
  {
    id: "agent_create",
    name: "Создание агента",
    description:
      "Сохраняет черновик нового агента-исполнителя. Доступен только сервису генерации сущностей.",
    category: "Генерация",
    builtin: true,
    internal: true,
    enabled: true,
    requiresConfirmation: false,
    inputSchema: {
      type: "object",
      required: ["name", "description", "instructions"],
      properties: {
        name: { type: "string", description: "Имя агента" },
        description: { type: "string", description: "Описание одной строкой" },
        instructions: { type: "string", description: "Системный промпт агента" },
        allowedToolIds: { type: "array", items: { type: "string" } },
        memoryRead: { type: "boolean" },
        memoryWrite: { type: "boolean" },
        maxToolCalls: { type: "integer", minimum: 1, maximum: 20 },
        timeoutSeconds: { type: "integer", minimum: 30, maximum: 1800 },
        retrievalLimit: { type: "integer", minimum: 1, maximum: 25 },
      },
    },
    outputSchema: { type: "object" },
    secretRequirements: [],
    secretBindings: [],
  },
  {
    id: "skill_create",
    name: "Создание навыка",
    description:
      "Сохраняет черновик нового навыка. Доступен только сервису генерации сущностей.",
    category: "Генерация",
    builtin: true,
    internal: true,
    enabled: true,
    requiresConfirmation: false,
    inputSchema: {
      type: "object",
      required: ["slug", "name", "description", "instructions"],
      properties: {
        slug: { type: "string", description: "Идентификатор латиницей" },
        name: { type: "string", description: "Название навыка" },
        description: { type: "string", description: "Когда применять навык" },
        instructions: { type: "string", description: "Подробные инструкции" },
        requiredToolIds: { type: "array", items: { type: "string" } },
        version: { type: "string" },
      },
    },
    outputSchema: { type: "object" },
    secretRequirements: [],
    secretBindings: [],
  },
] as const;
