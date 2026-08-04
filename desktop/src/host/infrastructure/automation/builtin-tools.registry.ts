import type { AutomationTool } from "../../../shared/models/automation";

const ollamaApiKey = {
  key: "ollamaApiKey",
  label: "Ollama API key",
  categoryId: 1,
  required: true,
} as const;

export const BUILTIN_AUTOMATION_TOOLS: readonly AutomationTool[] = [
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
] as const;
