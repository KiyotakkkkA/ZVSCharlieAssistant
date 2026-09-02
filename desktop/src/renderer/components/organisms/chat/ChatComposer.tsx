import {
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import {
  Button,
  Dropdown,
  InputCheckBox,
  InputBig,
  Modal,
  ScrollArea,
  Tooltip,
  type SelectOption,
} from "@kiyotakkkka/zvs-uikit-lib";
import {
  CalendarIcon,
  ChatIcon,
  FileIcon,
  PaperclipIcon,
  RobotIcon,
  SendIcon,
  StorageIcon,
  UploadIcon,
  TasksIcon,
  ModelOrientedSelect,
} from "../../atoms";
import { BasicSelect } from "../../atoms/basic";

export type ChatMode = "chat" | "planner" | "agent" | "scenario";
export type ChatModel = string;
export interface ChatVectorStoreOption {
  id: string;
  name: string;
  description: string;
  documentsCount: number;
}
const modes = [
  {
    value: "chat" as const,
    label: "Чат",
    description: "Свободный диалог",
    icon: ChatIcon,
  },
  {
    value: "planner" as const,
    label: "Планировщик",
    description: "Разобрать задачу на шаги",
    icon: CalendarIcon,
  },
  {
    value: "agent" as const,
    label: "Агенты",
    description: "Передать задачу исполнителю",
    icon: RobotIcon,
  },
  {
    value: "scenario" as const,
    label: "Сценарии",
    description: "Запустить управляемый процесс",
    icon: TasksIcon,
  },
];

interface ChatComposerProps {
  text: string;
  mode: ChatMode;
  model: ChatModel;
  agentId: string;
  scenarioId: string;
  agentOptions: SelectOption[];
  scenarioOptions: SelectOption[];
  onTextChange: (value: string) => void;
  onModeChange: (value: ChatMode) => void;
  onModelChange: (value: ChatModel) => void;
  onAgentChange: (value: string) => void;
  onScenarioChange: (value: string) => void;
  onSend: () => void;
  attachments: readonly File[];
  vectorStoreIds: readonly string[];
  vectorStoreOptions: readonly ChatVectorStoreOption[];
  onFilesSelected: (files: File[]) => void;
  onAttachmentRemove: (file: File) => void;
  onVectorStoreToggle: (id: string) => void;
  running?: boolean;
  onCancel?: () => void;
  topContent?: ReactNode;
}

export function ChatComposer(props: ChatComposerProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [storageOpen, setStorageOpen] = useState(false);
  const selectedMode = modes.find((item) => item.value === props.mode)!;
  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      props.onSend();
    }
  };

  const focusInputFromContainer = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (
      target.closest(
        "button, input, textarea, select, a, [role='button'], [data-no-composer-focus]",
      )
    ) {
      return;
    }
    inputRef.current?.focus();
  };

  return (
    <div className="pointer-events-none inset-x-0 bottom-0 px-4 pb-4 pt-4">
      <div className="pointer-events-auto mx-auto max-w-4xl">
        <div
          data-tour="chat-composer"
          className="cursor-text rounded-3xl border border-main-700 bg-main-800/95 p-2 hover:border-main-600 focus-within:border-main-600"
          onClick={focusInputFromContainer}
        >
          {props.topContent ? (
            <div className="-mx-2 -mt-2 mb-2 overflow-hidden rounded-t-[23px]">
              {props.topContent}
            </div>
          ) : null}
          {props.attachments.length || props.vectorStoreIds.length ? (
            <ScrollArea
              orientation="horizontal"
              showScrollbar
              className="mx-2 mb-1 max-w-full pb-1"
              data-no-composer-focus
            >
              <div className="flex w-max min-w-full gap-2 px-1 py-1">
                {props.attachments.map((file) => (
                  <AttachmentChip
                    key={`${file.name}:${file.size}:${file.lastModified}`}
                    icon={<FileIcon className="size-4" />}
                    title={file.name}
                    meta={formatBytes(file.size)}
                    onRemove={() => props.onAttachmentRemove(file)}
                  />
                ))}
                {props.vectorStoreIds.map((id) => {
                  const store = props.vectorStoreOptions.find(
                    (item) => item.id === id,
                  );
                  if (!store) return null;
                  return (
                    <AttachmentChip
                      key={id}
                      icon={<StorageIcon className="size-4" />}
                      title={store.name}
                      meta={`${store.documentsCount} документов`}
                      onRemove={() => props.onVectorStoreToggle(id)}
                    />
                  );
                })}
              </div>
            </ScrollArea>
          ) : null}
          <InputBig
            ref={inputRef}
            value={props.text}
            onChange={(event) => props.onTextChange(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Напишите сообщение…"
            autoResize
            minRows={2}
            maxRows={7}
            classNames={{
              textarea:
                "min-h-14 resize-none border-0! bg-transparent px-3 py-2 text-main-100 shadow-none outline-none ring-0! focus:ring-0 focus:ring-offset-0",
              footer: "hidden",
            }}
          />
          <div className="flex flex-wrap items-center justify-between gap-2 px-1 pb-1">
            <div className="flex min-w-0 items-center gap-1.5">
              {props.mode !== "scenario" ? (
                <Dropdown
                  className="shrink-0"
                  menuWidth={240}
                  menuPlacement="top-left"
                >
                  <Tooltip label="Прикрепить файлы" placement="top-center">
                    <Dropdown.Trigger
                      icon={<PaperclipIcon className="size-4" />}
                      rounded="rounded-full"
                      className="size-9! justify-center! gap-0! border-0! bg-transparent px-0! py-0! text-main-400 shadow-none ring-0! hover:bg-main-600/70! hover:text-main-50"
                      aria-label="Прикрепить"
                    >
                      <span className="sr-only">Прикрепить файлы</span>
                    </Dropdown.Trigger>
                  </Tooltip>
                  <Dropdown.Menu rounded="rounded-3xl" className="p-1.5">
                    <Dropdown.Item
                      icon={<UploadIcon className="size-4" />}
                      rounded="rounded-full"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      Загрузить с устройства
                    </Dropdown.Item>
                    <Dropdown.Item
                      icon={<StorageIcon className="size-4" />}
                      rounded="rounded-full"
                      onClick={() => setStorageOpen(true)}
                    >
                      Выбрать из хранилища
                    </Dropdown.Item>
                  </Dropdown.Menu>
                </Dropdown>
              ) : null}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.txt,.md,.json,.jsonl,.csv,.ts,.tsx,.js,.jsx,.mjs,.cjs,.py,.java,.kt,.go,.rs,.c,.h,.cpp,.hpp,.cs,.php,.rb,.swift,.html,.css,.scss,.less,.xml,.yaml,.yml,.toml,.ini,.sql,.sh,.ps1,.bat,.cmd,.log"
                multiple
                className="hidden"
                onChange={(event) => {
                  const files = [...(event.target.files ?? [])];
                  if (files.length) props.onFilesSelected(files);
                  event.target.value = "";
                }}
              />
              <div data-tour="chat-composer-mode">
                <Dropdown
                  className="shrink-0"
                  menuWidth={260}
                  menuPlacement="top-left"
                >
                  <Dropdown.Trigger
                    rounded="rounded-full"
                    className="inline-flex h-9 items-center gap-2 border-0! px-3 text-xs text-main-300 shadow-none ring-0! hover:bg-main-600/70 hover:text-main-50"
                  >
                    <span className="flex items-center gap-2">
                      <selectedMode.icon className="size-4 shrink-0" />
                      <span>{selectedMode.label}</span>
                    </span>
                  </Dropdown.Trigger>
                  <Dropdown.Menu
                    rounded="rounded-4xl"
                    className="p-1.5 space-y-1!"
                  >
                    {modes.map((item) => (
                      <Dropdown.Item
                        key={item.value}
                        active={props.mode === item.value}
                        icon={<item.icon className="size-4" />}
                        className="rounded-3xl"
                        onClick={() => props.onModeChange(item.value)}
                      >
                        <span className="block text-left">
                          <span className="block text-sm font-medium">
                            {item.label}
                          </span>
                          <span className="block text-xs text-main-500">
                            {item.description}
                          </span>
                        </span>
                      </Dropdown.Item>
                    ))}
                  </Dropdown.Menu>
                </Dropdown>
              </div>
              {props.mode === "agent" ? (
                <BasicSelect
                  disabled={props.agentOptions.length === 0}
                  className="max-w-48 w-fit shrink-0"
                  value={props.agentId}
                  onChange={props.onAgentChange}
                  options={props.agentOptions}
                  placeholder={`${props.agentOptions.length === 0 ? "Нет агентов" : "Выберите агента"}`}
                  searchable
                  searchPlaceholder="Найти агента"
                  emptyMessage="Агенты не найдены"
                  menuWidth={240}
                  classNames={{ search: "mb-3" }}
                  menuPlacement="top-left"
                  triggerRounded="rounded-full"
                  triggerClassName="h-9 w-full border-0! px-3 text-xs shadow-none ring-0! hover:bg-main-600/70"
                  menuRounded="rounded-3xl"
                  optionRounded="rounded-full"
                />
              ) : null}
              {props.mode === "scenario" ? (
                <BasicSelect
                  disabled={props.scenarioOptions.length === 0}
                  className="max-w-56 w-fit shrink-0"
                  value={props.scenarioId}
                  onChange={props.onScenarioChange}
                  options={props.scenarioOptions}
                  placeholder={
                    props.scenarioOptions.length
                      ? "Выберите сценарий"
                      : "Нет сценариев"
                  }
                  searchable
                  classNames={{ search: "mb-3" }}
                  searchPlaceholder="Найти сценарий"
                  emptyMessage="Сценарии не найдены"
                  menuWidth={260}
                  menuPlacement="top-left"
                  triggerRounded="rounded-full"
                  triggerClassName="h-9 w-full border-0! px-3 text-xs shadow-none ring-0! hover:bg-main-600/70"
                  menuRounded="rounded-3xl"
                  optionRounded="rounded-full"
                />
              ) : null}
            </div>
            <div
              data-tour="chat-composer-model-controls"
              className="flex items-center gap-1.5"
            >
              {!["agent", "scenario"].includes(props.mode) && (
                <div>
                  <ModelOrientedSelect
                    variant="ghost"
                    value={props.model}
                    onChange={props.onModelChange}
                    menuWidth={280}
                    menuPlacement="top-right"
                  />
                </div>
              )}
              <Tooltip
                label={
                  props.running
                    ? "Остановить генерацию"
                    : props.text.trim()
                      ? "Отправить сообщение"
                      : "Введите сообщение"
                }
                placement="top-right"
              >
                <Button
                  variant="primary"
                  rounded="rounded-full"
                  label={props.running ? "Остановить" : "Отправить"}
                  className="inline-flex size-9 items-center justify-center border-0! p-0 shadow-none ring-0!"
                  disabled={
                    !props.running &&
                    (!props.text.trim() ||
                      (props.mode !== "scenario" && !props.model) ||
                      (props.mode === "scenario" && !props.scenarioId))
                  }
                  onClick={props.running ? props.onCancel : props.onSend}
                >
                  {props.running ? (
                    <span className="size-3 rounded-sm bg-current" />
                  ) : (
                    <SendIcon className="size-4" />
                  )}
                </Button>
              </Tooltip>
            </div>
          </div>
        </div>
        <p className="mt-2 text-center text-[11px] text-main-600">
          Ответы модели могут содержать неточности — проверяйте важную
          информацию.
        </p>
      </div>
      <Modal
        open={storageOpen}
        rounded="rounded-4xl"
        className="max-w-lg"
        onClose={() => setStorageOpen(false)}
      >
        <Modal.Header>
          <div>
            <h2 className="text-lg font-semibold text-main-50">
              Источники из хранилища
            </h2>
            <p className="mt-1 text-xs text-main-500">
              Перед ответом будут найдены релевантные фрагменты документов.
            </p>
          </div>
        </Modal.Header>
        <Modal.Content>
          {props.vectorStoreOptions.length ? (
            <div className="space-y-2">
              {props.vectorStoreOptions.map((store) => (
                <InputCheckBox
                  key={store.id}
                  checked={props.vectorStoreIds.includes(store.id)}
                  onChange={() => props.onVectorStoreToggle(store.id)}
                  className="flex w-full cursor-pointer items-start gap-3 rounded-xl bg-main-800/45 p-3 ring-1 ring-main-700/35 hover:bg-main-700/35"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-main-100">
                      {store.name}
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-main-500">
                      {store.description || "Описание не задано"} ·{" "}
                      {store.documentsCount} документов
                    </span>
                  </span>
                </InputCheckBox>
              ))}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-main-500">
              Нет настроенных хранилищ с готовыми документами.
            </p>
          )}
        </Modal.Content>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setStorageOpen(false)}>
            Готово
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

function AttachmentChip({
  icon,
  title,
  meta,
  onRemove,
}: {
  icon: ReactNode;
  title: string;
  meta: string;
  onRemove: () => void;
}) {
  return (
    <div className="flex max-w-64 shrink-0 items-center gap-2 rounded-xl bg-main-700/45 px-3 py-2 ring-1 ring-main-600/35">
      <span className="shrink-0 text-accent-light">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-medium text-main-100">
          {title}
        </span>
        <span className="block text-[10px] text-main-500">{meta}</span>
      </span>
      <button
        type="button"
        className="shrink-0 rounded-full px-1 text-main-500 hover:bg-main-600 hover:text-main-100"
        aria-label={`Убрать ${title}`}
        onClick={onRemove}
      >
        ×
      </button>
    </div>
  );
}

function formatBytes(value: number) {
  return value < 1_048_576
    ? `${Math.max(1, Math.round(value / 1024))} КБ`
    : `${(value / 1_048_576).toFixed(1)} МБ`;
}
