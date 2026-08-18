import { OPERATOR_LABELS } from "../../../../../../shared/scenario/descriptors/flow";
import {
  equals,
  type FieldOption,
  type NodeFieldSpec,
} from "./node-fields.types";

const conditionFields: NodeFieldSpec[] = [
  { type: "conditions", key: "conditions", label: "Условия" },
];

const combinatorField: NodeFieldSpec = {
  type: "select",
  key: "combinator",
  label: "Совпадение",
  options: [
    { value: "and", label: "Все условия" },
    { value: "or", label: "Любое условие" },
  ],
  half: true,
};

export const OPERATOR_OPTIONS: FieldOption[] = Object.entries(
  OPERATOR_LABELS,
).map(([value, label]) => ({ value, label }));

const valueTypeOptions: FieldOption[] = [
  { value: "auto", label: "Автоматически" },
  { value: "string", label: "Строка" },
  { value: "number", label: "Число" },
  { value: "boolean", label: "Да/Нет" },
  { value: "json", label: "JSON" },
];

/**
 * Field layout for every scenario node kind. A kind missing from this map
 * renders with base fields only (name/description/notes) — that is a safe
 * fallback, not an error.
 */
export const NODE_FIELDS: Record<string, NodeFieldSpec[]> = {
  // ── Триггеры ──────────────────────────────────────────────────────────
  "trigger.manual": [
    { type: "boolean", key: "fromEditor", label: "Запуск из редактора" },
    { type: "boolean", key: "fromChat", label: "Запуск из чата" },
    {
      type: "list",
      key: "inputFields",
      label: "Поля ввода",
      hint: "Что спросить у пользователя перед запуском",
      itemLabel: "Поле",
      addLabel: "Добавить поле",
      itemDefaults: {
        name: "",
        label: "",
        type: "string",
        required: false,
        defaultValue: "",
      },
      fields: [
        { type: "text", key: "name", label: "Ключ", half: true },
        { type: "text", key: "label", label: "Подпись", half: true },
        {
          type: "select",
          key: "type",
          label: "Тип",
          half: true,
          options: [
            { value: "string", label: "Строка" },
            { value: "number", label: "Число" },
            { value: "boolean", label: "Да/Нет" },
            { value: "json", label: "JSON" },
          ],
        },
        {
          type: "text",
          key: "defaultValue",
          label: "По умолчанию",
          half: true,
        },
        { type: "boolean", key: "required", label: "Обязательное" },
      ],
    },
  ],
  "trigger.interval": [
    {
      type: "number",
      key: "intervalSeconds",
      label: "Интервал, секунд",
      min: 60,
      max: 31_536_000,
      half: true,
    },
    { type: "text", key: "timezone", label: "Часовой пояс", half: true },
    {
      type: "select",
      key: "misfirePolicy",
      label: "Пропущенные запуски",
      hint: "Что делать, если приложение было выключено",
      options: [
        { value: "skip", label: "Пропустить" },
        { value: "run_once", label: "Выполнить один раз" },
        { value: "catch_up", label: "Догнать" },
      ],
    },
    {
      type: "number",
      key: "catchUpLimit",
      label: "Лимит догона за тик",
      min: 1,
      max: 50,
      showIf: equals("misfirePolicy", "catch_up"),
    },
    {
      type: "boolean",
      key: "preventOverlap",
      label: "Не запускать поверх незавершённого",
    },
  ],
  "trigger.telegram": [
    {
      type: "integrationProfile",
      key: "integrationProfileId",
      label: "Подключение Telegram",
      channel: "telegram",
    },
    { type: "boolean", key: "allowAnyChat", label: "Разрешить любой чат" },
    {
      type: "stringList",
      key: "allowedChatIds",
      label: "Разрешённые чаты",
      hint: "ID чатов, из которых принимаются сообщения",
      itemPlaceholder: "-1001234567890",
      showIf: (config) => !config.allowAnyChat,
    },
    {
      type: "text",
      key: "command",
      label: "Команда",
      placeholder: "/report",
      hint: "Реагировать только на сообщения, начинающиеся с этой команды",
    },
    { type: "boolean", key: "includeAttachments", label: "Забирать вложения" },
    {
      type: "boolean",
      key: "ignoreBots",
      label: "Игнорировать сообщения ботов",
    },
  ],
  "trigger.email": [
    {
      type: "integrationProfile",
      key: "integrationProfileId",
      label: "Почтовое подключение",
      channel: "email",
    },
    { type: "text", key: "mailbox", label: "Папка", half: true },
    { type: "text", key: "from", label: "От кого", half: true },
    { type: "text", key: "subjectContains", label: "Тема содержит" },
    { type: "boolean", key: "unreadOnly", label: "Только непрочитанные" },
    { type: "boolean", key: "markAsRead", label: "Отмечать прочитанным" },
    { type: "boolean", key: "includeAttachments", label: "Забирать вложения" },
  ],

  // ── Модели и агенты ───────────────────────────────────────────────────
  agent: [
    { type: "agent", key: "agentId", label: "Агент" },
    {
      type: "textarea",
      key: "scenarioInstructions",
      label: "Инструкции для сценария",
      placeholder: "Уточните роль агента, формат и ограничения результата",
      expression: true,
      minRows: 4,
      maxRows: 10,
    },
    {
      type: "select",
      key: "input",
      label: "Что подать на вход",
      half: true,
      options: [
        { value: "items", label: "Items целиком" },
        { value: "expression", label: "Выражение" },
      ],
    },
    {
      type: "text",
      key: "inputExpression",
      label: "Выражение входа",
      expression: true,
      half: true,
      showIf: equals("input", "expression"),
    },
    {
      type: "select",
      key: "outputMode",
      label: "Формат ответа",
      half: true,
      options: [
        { value: "text", label: "Текст" },
        { value: "json", label: "JSON по схеме" },
      ],
    },
    { type: "text", key: "targetField", label: "Поле результата", half: true },
    {
      type: "textarea",
      key: "jsonSchema",
      label: "JSON-схема ответа",
      minRows: 4,
      maxRows: 12,
      showIf: equals("outputMode", "json"),
    },
    {
      type: "model",
      key: "modelId",
      label: "Модель",
      hint: "Пусто — берётся из карточки агента",
    },
    {
      type: "number",
      key: "maxToolCalls",
      label: "Лимит инструментов",
      min: 1,
      max: 100,
      half: true,
    },
    {
      type: "number",
      key: "temperature",
      label: "Температура",
      min: 0,
      max: 2,
      step: 0.1,
      half: true,
    },
  ],
  orchestrator: [
    { type: "model", key: "modelId", label: "Модель" },
    {
      type: "select",
      key: "mode",
      label: "Как распределять задачи",
      hint: "«По графу» — детерминированно, «Моделью» — план составляет модель",
      options: [
        { value: "graph", label: "По графу" },
        { value: "llm", label: "Моделью" },
      ],
    },
    {
      type: "textarea",
      key: "objective",
      label: "Цель",
      expression: true,
      minRows: 3,
      maxRows: 8,
    },
    {
      type: "boolean",
      key: "strictPlan",
      label: "Падать при некорректном плане",
      showIf: equals("mode", "llm"),
    },
    {
      type: "boolean",
      key: "synthesize",
      label: "Сводить ответы исполнителей",
    },
    {
      type: "textarea",
      key: "synthesisInstructions",
      label: "Инструкции для сводки",
      minRows: 3,
      maxRows: 8,
      showIf: (config) => config.synthesize !== false,
    },
    {
      type: "number",
      key: "maxOutputTokens",
      label: "Лимит токенов ответа",
      min: 256,
      max: 32_000,
    },
  ],
  classify: [
    { type: "model", key: "modelId", label: "Модель" },
    {
      type: "textarea",
      key: "input",
      label: "Что классифицировать",
      expression: true,
      minRows: 2,
      maxRows: 6,
    },
    {
      type: "list",
      key: "categories",
      label: "Категории",
      hint: "Каждая категория становится отдельным выходом узла",
      itemLabel: "Категория",
      addLabel: "Добавить категорию",
      itemDefaults: { label: "", description: "" },
      fields: [
        { type: "text", key: "label", label: "Название" },
        { type: "text", key: "description", label: "Описание для модели" },
      ],
    },
    {
      type: "boolean",
      key: "allowMultiple",
      label: "Несколько категорий сразу",
    },
    { type: "boolean", key: "fallbackOutput", label: "Выход «Иначе»" },
  ],

  // ── Данные ────────────────────────────────────────────────────────────
  set: [
    {
      type: "list",
      key: "fields",
      label: "Поля",
      itemLabel: "Поле",
      addLabel: "Добавить поле",
      itemDefaults: { name: "", value: "", type: "auto" },
      fields: [
        { type: "text", key: "name", label: "Имя", half: true },
        {
          type: "select",
          key: "type",
          label: "Тип",
          half: true,
          options: valueTypeOptions,
        },
        {
          type: "text",
          key: "value",
          label: "Значение",
          expression: true,
          placeholder: "{{ $json.user.email }}",
        },
      ],
    },
    {
      type: "stringList",
      key: "remove",
      label: "Удалить поля",
      itemPlaceholder: "имя поля",
    },
    {
      type: "boolean",
      key: "keepOnlySet",
      label: "Оставить только заданные поля",
    },
  ],
  aggregate: [
    {
      type: "select",
      key: "mode",
      label: "Режим",
      options: [
        { value: "allItems", label: "Собрать все items" },
        { value: "concatenate", label: "Склеить поле" },
        { value: "summary", label: "Сводка по полям" },
      ],
    },
    { type: "text", key: "targetField", label: "Поле результата", half: true },
    { type: "text", key: "groupBy", label: "Группировать по", half: true },
    {
      type: "text",
      key: "sourceField",
      label: "Исходное поле",
      expression: true,
      showIf: equals("mode", "concatenate"),
    },
    {
      type: "text",
      key: "separator",
      label: "Разделитель",
      expression: true,
      showIf: equals("mode", "concatenate"),
    },
    {
      type: "list",
      key: "aggregations",
      label: "Агрегации",
      itemLabel: "Агрегация",
      addLabel: "Добавить агрегацию",
      itemDefaults: { field: "", operation: "count", as: "" },
      showIf: equals("mode", "summary"),
      fields: [
        { type: "text", key: "field", label: "Поле", half: true },
        {
          type: "select",
          key: "operation",
          label: "Операция",
          half: true,
          options: [
            { value: "count", label: "Количество" },
            { value: "sum", label: "Сумма" },
            { value: "avg", label: "Среднее" },
            { value: "min", label: "Минимум" },
            { value: "max", label: "Максимум" },
            { value: "unique", label: "Уникальные" },
            { value: "first", label: "Первое" },
            { value: "last", label: "Последнее" },
          ],
        },
        { type: "text", key: "as", label: "Записать в поле" },
      ],
    },
  ],
  splitOut: [
    {
      type: "text",
      key: "field",
      label: "Поле со списком",
      expression: true,
      placeholder: "{{ $json.items }}",
    },
    { type: "text", key: "targetField", label: "Поле результата", half: true },
    {
      type: "boolean",
      key: "keepParentFields",
      label: "Сохранять поля родителя",
    },
  ],
  sort: [
    {
      type: "list",
      key: "rules",
      label: "Правила сортировки",
      itemLabel: "Правило",
      addLabel: "Добавить правило",
      itemDefaults: { field: "", direction: "asc" },
      fields: [
        { type: "text", key: "field", label: "Поле", half: true },
        {
          type: "select",
          key: "direction",
          label: "Порядок",
          half: true,
          options: [
            { value: "asc", label: "По возрастанию" },
            { value: "desc", label: "По убыванию" },
          ],
        },
      ],
    },
  ],
  deduplicate: [
    {
      type: "select",
      key: "mode",
      label: "Сравнивать",
      options: [
        { value: "allFields", label: "Все поля" },
        { value: "selectedFields", label: "Выбранные поля" },
      ],
    },
    {
      type: "stringList",
      key: "fields",
      label: "Поля",
      itemPlaceholder: "имя поля",
      showIf: equals("mode", "selectedFields"),
    },
  ],
  http: [
    {
      type: "select",
      key: "method",
      label: "Метод",
      half: true,
      options: ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"].map(
        (value) => ({ value, label: value }),
      ),
    },
    {
      type: "number",
      key: "timeoutSeconds",
      label: "Таймаут, секунд",
      min: 1,
      max: 600,
      half: true,
    },
    {
      type: "text",
      key: "url",
      label: "URL",
      expression: true,
      placeholder: "https://api.example.com/{{ $json.id }}",
    },
    {
      type: "list",
      key: "headers",
      label: "Заголовки",
      itemLabel: "Заголовок",
      addLabel: "Добавить заголовок",
      itemDefaults: { key: "", value: "" },
      fields: [
        { type: "text", key: "key", label: "Имя", half: true },
        {
          type: "text",
          key: "value",
          label: "Значение",
          expression: true,
          half: true,
        },
      ],
    },
    {
      type: "list",
      key: "query",
      label: "Параметры запроса",
      itemLabel: "Параметр",
      addLabel: "Добавить параметр",
      itemDefaults: { key: "", value: "" },
      fields: [
        { type: "text", key: "key", label: "Имя", half: true },
        {
          type: "text",
          key: "value",
          label: "Значение",
          expression: true,
          half: true,
        },
      ],
    },
    {
      type: "select",
      key: "bodyMode",
      label: "Тело запроса",
      options: [
        { value: "none", label: "Без тела" },
        { value: "json", label: "JSON" },
        { value: "text", label: "Текст" },
        { value: "form", label: "Форма" },
      ],
    },
    {
      type: "textarea",
      key: "body",
      label: "Содержимое тела",
      expression: true,
      minRows: 4,
      maxRows: 12,
      showIf: (config) =>
        config.bodyMode !== "none" && config.bodyMode !== undefined,
    },
    {
      type: "secret",
      key: "authSecretId",
      label: "Секрет авторизации",
      hint: "Токен подставляется на лету и не попадает в граф и логи",
    },
    {
      type: "select",
      key: "authScheme",
      label: "Схема авторизации",
      half: true,
      options: [
        { value: "bearer", label: "Bearer" },
        { value: "basic", label: "Basic" },
        { value: "raw", label: "Как есть" },
        { value: "header", label: "Свой заголовок" },
      ],
      showIf: (config) => Boolean(config.authSecretId),
    },
    {
      type: "text",
      key: "authHeaderName",
      label: "Имя заголовка",
      half: true,
      showIf: (config) => Boolean(config.authSecretId),
    },
    { type: "boolean", key: "parseJson", label: "Разбирать JSON-ответ" },
    {
      type: "boolean",
      key: "failOnErrorStatus",
      label: "Считать 4xx/5xx ошибкой",
    },
    { type: "boolean", key: "followRedirects", label: "Следовать редиректам" },
    {
      type: "number",
      key: "maxResponseMb",
      label: "Лимит ответа, МБ",
      min: 1,
      max: 256,
    },
  ],
  downloadFiles: [
    {
      type: "select",
      key: "source",
      label: "Откуда брать файлы",
      options: [
        { value: "binary", label: "Вложения из items" },
        { value: "urls", label: "Список ссылок" },
      ],
    },
    {
      type: "stringList",
      key: "urls",
      label: "Ссылки",
      itemPlaceholder: "https://…",
      showIf: equals("source", "urls"),
    },
    {
      type: "number",
      key: "maxFileSizeMb",
      label: "Максимум на файл, МБ",
      min: 1,
      max: 1_024,
      half: true,
    },
    {
      type: "number",
      key: "maxFiles",
      label: "Максимум файлов",
      min: 1,
      max: 200,
      half: true,
    },
    {
      type: "boolean",
      key: "cleanupOnFinish",
      label: "Удалять файлы после сценария",
    },
  ],
  readFiles: [
    {
      type: "number",
      key: "maxCharactersPerFile",
      label: "Символов на файл",
      min: 1_000,
      max: 2_000_000,
    },
    {
      type: "select",
      key: "output",
      label: "Как отдать текст",
      half: true,
      options: [
        { value: "inline", label: "В items" },
        { value: "reference", label: "Ссылкой на файл" },
      ],
    },
    { type: "text", key: "targetField", label: "Поле результата", half: true },
    { type: "boolean", key: "itemPerFile", label: "Отдельный item на файл" },
  ],
  knowledgeStore: [
    { type: "vectorStore", key: "vectorStoreId", label: "Хранилище" },
    {
      type: "number",
      key: "limit",
      label: "Сколько фрагментов",
      min: 1,
      max: 100,
      half: true,
    },
    {
      type: "number",
      key: "minScore",
      label: "Мин. релевантность",
      min: 0,
      max: 1,
      step: 0.05,
      half: true,
    },
  ],

  // ── Поток управления ──────────────────────────────────────────────────
  if: [combinatorField, ...conditionFields],
  filter: [combinatorField, ...conditionFields],
  switch: [
    {
      type: "select",
      key: "mode",
      label: "Режим",
      options: [
        { value: "rules", label: "По правилам" },
        { value: "expression", label: "По выражению" },
      ],
    },
    {
      type: "text",
      key: "expression",
      label: "Выражение",
      expression: true,
      hint: "Результат сравнивается с меткой ветки",
      showIf: equals("mode", "expression"),
    },
    {
      type: "list",
      key: "rules",
      label: "Ветки",
      itemLabel: "Ветка",
      addLabel: "Добавить ветку",
      itemDefaults: {
        label: "Ветка",
        group: { combinator: "and", conditions: [] },
      },
      fields: [{ type: "text", key: "label", label: "Название ветки" }],
    },
    { type: "boolean", key: "allMatches", label: "Отдавать во все совпавшие" },
    { type: "boolean", key: "fallbackOutput", label: "Выход «Иначе»" },
  ],
  merge: [
    {
      type: "select",
      key: "mode",
      label: "Как объединять",
      options: [
        { value: "append", label: "Дописать" },
        { value: "byKey", label: "По ключу" },
        { value: "byPosition", label: "По позиции" },
        { value: "chooseBranch", label: "Выбрать ветку" },
      ],
    },
    {
      type: "number",
      key: "inputCount",
      label: "Количество входов",
      min: 2,
      max: 8,
      half: true,
    },
    {
      type: "text",
      key: "joinKey",
      label: "Ключ соединения",
      expression: true,
      half: true,
      showIf: equals("mode", "byKey"),
    },
    {
      type: "select",
      key: "joinType",
      label: "Тип соединения",
      options: [
        { value: "inner", label: "Только совпавшие" },
        { value: "left", label: "Все из первой ветки" },
        { value: "outer", label: "Все из обеих" },
      ],
      showIf: equals("mode", "byKey"),
    },
    { type: "boolean", key: "waitForAll", label: "Ждать все входы" },
  ],
  loop: [
    {
      type: "number",
      key: "batchSize",
      label: "Размер батча",
      min: 1,
      half: true,
    },
    {
      type: "number",
      key: "maxIterations",
      label: "Максимум итераций",
      min: 1,
      max: 10_000,
      half: true,
    },
    { type: "boolean", key: "reset", label: "Сбрасывать состояние" },
  ],
  limit: [
    {
      type: "number",
      key: "count",
      label: "Сколько оставить",
      min: 1,
      half: true,
    },
    {
      type: "select",
      key: "from",
      label: "Откуда",
      half: true,
      options: [
        { value: "first", label: "С начала" },
        { value: "last", label: "С конца" },
      ],
    },
  ],
  approval: [
    {
      type: "select",
      key: "mode",
      label: "Тип вопроса",
      options: [
        { value: "confirm", label: "Подтверждение" },
        { value: "choice", label: "Выбор варианта" },
        { value: "text", label: "Свободный ответ" },
      ],
    },
    { type: "text", key: "header", label: "Заголовок", expression: true },
    {
      type: "textarea",
      key: "prompt",
      label: "Вопрос",
      expression: true,
      minRows: 2,
      maxRows: 6,
    },
    {
      type: "list",
      key: "options",
      label: "Варианты ответа",
      itemLabel: "Вариант",
      addLabel: "Добавить вариант",
      itemDefaults: { label: "", description: "" },
      showIf: equals("mode", "choice"),
      fields: [
        { type: "text", key: "label", label: "Текст" },
        { type: "text", key: "description", label: "Пояснение" },
      ],
    },
    {
      type: "boolean",
      key: "multiSelect",
      label: "Можно выбрать несколько",
      showIf: equals("mode", "choice"),
    },
    {
      type: "text",
      key: "defaultAnswer",
      label: "Ответ по умолчанию",
      half: true,
    },
    {
      type: "number",
      key: "timeoutSeconds",
      label: "Таймаут, секунд",
      min: 10,
      max: 604_800,
      half: true,
    },
    {
      type: "select",
      key: "channel",
      label: "Где спросить",
      options: [
        { value: "ui", label: "В приложении" },
        { value: "trigger", label: "В канале триггера" },
        { value: "telegram", label: "Telegram" },
        { value: "email", label: "Почта" },
      ],
    },
    {
      type: "integrationProfile",
      key: "integrationProfileId",
      label: "Подключение Telegram",
      channel: "telegram",
      showIf: equals("channel", "telegram"),
    },
    {
      type: "integrationProfile",
      key: "integrationProfileId",
      label: "Почтовое подключение",
      channel: "email",
      showIf: equals("channel", "email"),
    },
    {
      type: "text",
      key: "recipient",
      label: "Получатель",
      showIf: (config) =>
        config.channel === "telegram" || config.channel === "email",
    },
  ],
  subScenario: [
    { type: "scenario", key: "scenarioId", label: "Сценарий" },
    {
      type: "select",
      key: "mode",
      label: "Как выполнять",
      half: true,
      options: [
        { value: "await", label: "Дождаться результата" },
        { value: "fireAndForget", label: "Запустить и продолжить" },
      ],
    },
    {
      type: "select",
      key: "input",
      label: "Что подать на вход",
      half: true,
      options: [
        { value: "items", label: "Items целиком" },
        { value: "expression", label: "Выражение" },
      ],
    },
    {
      type: "text",
      key: "inputExpression",
      label: "Выражение входа",
      expression: true,
      showIf: equals("input", "expression"),
    },
  ],

  // ── Результат ─────────────────────────────────────────────────────────
  output: [
    {
      type: "textarea",
      key: "text",
      label: "Текст ответа",
      expression: true,
      minRows: 3,
      maxRows: 10,
      placeholder: "{{ $json.text }}",
    },
    {
      type: "list",
      key: "channels",
      label: "Каналы отправки",
      itemLabel: "Канал",
      addLabel: "Добавить канал",
      itemDefaults: {
        channel: "telegram",
        enabled: true,
        mode: "reply_to_trigger",
        integrationProfileId: null,
        recipient: "",
        subject: "",
        attachFiles: false,
      },
      fields: [
        {
          type: "select",
          key: "channel",
          label: "Канал",
          half: true,
          options: [
            { value: "telegram", label: "Telegram" },
            { value: "email", label: "Почта" },
          ],
        },
        {
          type: "select",
          key: "mode",
          label: "Кому",
          half: true,
          options: [
            { value: "reply_to_trigger", label: "Ответ в исходный канал" },
            { value: "explicit_recipient", label: "Указанному получателю" },
          ],
        },
        {
          type: "integrationProfile",
          key: "integrationProfileId",
          label: "Подключение Telegram",
          channel: "telegram",
          showIf: (config) =>
            config.channel === "telegram" &&
            config.mode === "explicit_recipient",
        },
        {
          type: "integrationProfile",
          key: "integrationProfileId",
          label: "Почтовое подключение",
          channel: "email",
          showIf: (config) =>
            config.channel === "email" && config.mode === "explicit_recipient",
        },
        {
          type: "text",
          key: "recipient",
          label: "Получатель",
          expression: true,
          showIf: equals("mode", "explicit_recipient"),
        },
        {
          type: "text",
          key: "subject",
          label: "Тема письма",
          expression: true,
          showIf: equals("channel", "email"),
        },
        { type: "boolean", key: "attachFiles", label: "Приложить файлы" },
        { type: "boolean", key: "enabled", label: "Канал включён" },
      ],
    },
    {
      type: "boolean",
      key: "saveArtifact",
      label: "Сохранить результат в файл",
    },
    {
      type: "text",
      key: "artifactFileName",
      label: "Имя файла",
      expression: true,
      showIf: (config) => Boolean(config.saveArtifact),
    },
  ],
  noop: [{ type: "text", key: "label", label: "Метка" }],
};
