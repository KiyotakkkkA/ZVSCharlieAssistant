import type { ScenarioNode } from "../../../../shared/scenario/graph";
import { OPERATOR_LABELS } from "../../../../shared/scenario/descriptors/flow";

export interface SummaryNames {
  agents: ReadonlyMap<string, string>;
  vectorStores: ReadonlyMap<number, string>;
  scenarios: ReadonlyMap<string, string>;
  models: ReadonlyMap<number, string>;
}

const EMPTY: SummaryNames = {
  agents: new Map(),
  vectorStores: new Map(),
  scenarios: new Map(),
  models: new Map(),
};

export function nodeSummary(
  node: ScenarioNode,
  names: SummaryNames = EMPTY,
): string {
  const config = (node.config ?? {}) as Record<string, unknown>;
  const text = (key: string) => String(config[key] ?? "").trim();
  const number = (key: string) => Number(config[key] ?? 0);

  switch (node.kind) {
    case "trigger.manual": {
      const from = [
        config.fromChat ? "из чата" : null,
        config.fromEditor ? "из редактора" : null,
      ].filter(Boolean);
      return from.length ? `Запуск ${from.join(" и ")}` : "Запуск выключен";
    }
    case "trigger.interval": {
      const seconds = number("intervalSeconds");
      return seconds ? `Каждые ${humanInterval(seconds)}` : "Расписание не задано";
    }
    case "trigger.telegram": {
      const command = text("command");
      if (command) return `Команда ${command}`;
      return config.allowAnyChat ? "Любой чат" : chatCount(config.allowedChatIds);
    }
    case "trigger.email": {
      const subject = text("subjectContains");
      const from = text("from");
      if (subject) return `Тема содержит «${subject}»`;
      if (from) return `От ${from}`;
      return text("mailbox") || "Входящие";
    }

    case "agent": {
      const agent = names.agents.get(text("agentId"));
      return agent ? agent : "Агент не выбран";
    }
    case "orchestrator": {
      const model = names.models.get(number("modelId"));
      const mode = config.mode === "graph" ? "по графу" : "моделью";
      return model ? `${mode} · ${model}` : `Распределяет ${mode}`;
    }
    case "classify": {
      const categories = Array.isArray(config.categories)
        ? config.categories.length
        : 0;
      return categories ? `${categories} ${plural(categories, "категория", "категории", "категорий")}` : "Категории не заданы";
    }
    case "knowledgeStore": {
      const store = names.vectorStores.get(number("vectorStoreId"));
      return store ? store : "Хранилище не выбрано";
    }

    case "if": {
      const conditions = Array.isArray(config.conditions)
        ? (config.conditions as Array<Record<string, unknown>>)
        : [];
      const first = conditions[0];
      if (!first) return "Условие не задано";
      const operator =
        OPERATOR_LABELS[first.operator as keyof typeof OPERATOR_LABELS];
      const left = String(first.left ?? "").trim();
      return left ? `${left} ${operator ?? ""}`.trim() : "Условие не задано";
    }
    case "switch": {
      const rules = Array.isArray(config.rules) ? config.rules.length : 0;
      return rules ? `${rules} ${plural(rules, "ветка", "ветки", "веток")}` : "Ветки не заданы";
    }
    case "filter":
      return "Пропускает подходящие";
    case "merge":
      return `Объединяет ${number("inputCount") || 2}`;
    case "loop":
      return `Порциями по ${number("batchSize") || 1}`;
    case "limit":
      return `Первые ${number("count") || 10}`;
    case "approval":
      return text("prompt") || "Вопрос не задан";
    case "subScenario": {
      const scenario = names.scenarios.get(text("scenarioId"));
      return scenario ? scenario : "Сценарий не выбран";
    }

    case "set": {
      const fields = Array.isArray(config.fields)
        ? (config.fields as Array<Record<string, unknown>>).filter((field) =>
            String(field.name ?? "").trim(),
          ).length
        : 0;
      return fields ? `${fields} ${plural(fields, "поле", "поля", "полей")}` : "Поля не заданы";
    }
    case "aggregate":
      return "Собирает в один";
    case "splitOut":
      return text("field") ? `Разворачивает ${text("field")}` : "Поле не задано";
    case "sort": {
      const rules = Array.isArray(config.rules) ? config.rules.length : 0;
      return rules ? `По ${rules} ${plural(rules, "полю", "полям", "полям")}` : "Поля не заданы";
    }
    case "deduplicate":
      return "Убирает повторы";

    case "http": {
      const url = text("url");
      return url ? `${text("method") || "GET"} ${shorten(url)}` : "URL не задан";
    }
    case "downloadFiles":
      return `До ${number("maxFiles") || 20} файлов`;
    case "readFiles":
      return "Извлекает текст";

    case "output": {
      const channels = Array.isArray(config.channels)
        ? (config.channels as Array<Record<string, unknown>>).filter(
            (channel) => channel.enabled !== false,
          )
        : [];
      if (!channels.length) return "Без отправки";
      return channels
        .map((channel) => (channel.channel === "email" ? "Email" : "Telegram"))
        .join(", ");
    }
    case "noop":
      return text("label") || "Ничего не делает";

    default:
      return "";
  }
}

function humanInterval(seconds: number): string {
  if (seconds % 86_400 === 0) {
    const days = seconds / 86_400;
    return `${days} ${plural(days, "день", "дня", "дней")}`;
  }
  if (seconds % 3_600 === 0) {
    const hours = seconds / 3_600;
    return `${hours} ${plural(hours, "час", "часа", "часов")}`;
  }
  const minutes = Math.round(seconds / 60);
  return `${minutes} ${plural(minutes, "минуту", "минуты", "минут")}`;
}

function chatCount(value: unknown): string {
  const count = Array.isArray(value) ? value.length : 0;
  return count
    ? `${count} ${plural(count, "чат", "чата", "чатов")}`
    : "Чаты не выбраны";
}

function shorten(url: string): string {
  const withoutScheme = url.replace(/^https?:\/\//, "");
  return withoutScheme.length > 28
    ? `${withoutScheme.slice(0, 28)}…`
    : withoutScheme;
}

function plural(count: number, one: string, few: string, many: string): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}
