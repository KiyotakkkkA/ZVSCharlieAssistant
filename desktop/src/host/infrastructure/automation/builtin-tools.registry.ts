import type { AutomationTool } from "../../../ipc/contracts";

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
    description:
      "Ищет информацию через Ollama Web Search и возвращает список источников.",
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
    description:
      "Получает очищенное Markdown-содержимое страницы через Ollama Web Fetch.",
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
] as const;
