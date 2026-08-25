import {
  useRef,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import {
  Button,
  Dropdown,
  InputBig,
  Select,
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

export type ChatMode = "chat" | "planner" | "agent" | "scenario";
export type ChatModel = string;
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
  running?: boolean;
  onCancel?: () => void;
  topContent?: ReactNode;
}

export function ChatComposer(props: ChatComposerProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
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
                    >
                      Загрузить с устройства
                    </Dropdown.Item>
                    <Dropdown.Item
                      icon={<StorageIcon className="size-4" />}
                      rounded="rounded-full"
                    >
                      Выбрать из хранилища
                    </Dropdown.Item>
                  </Dropdown.Menu>
                </Dropdown>
              ) : null}
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
                <Select
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
                >
                  <Select.Trigger
                    rounded="rounded-full"
                    className="h-9 w-full border-0! px-3 text-xs shadow-none ring-0! hover:bg-main-600/70"
                  />
                  <Select.Menu rounded="rounded-3xl">
                    {props.agentOptions.map((agent) => (
                      <Select.Option
                        key={agent.value}
                        {...agent}
                        rounded="rounded-full"
                      />
                    ))}
                  </Select.Menu>
                </Select>
              ) : null}
              {props.mode === "scenario" ? (
                <Select
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
                >
                  <Select.Trigger
                    rounded="rounded-full"
                    className="h-9 w-full border-0! px-3 text-xs shadow-none ring-0! hover:bg-main-600/70"
                  />
                  <Select.Menu rounded="rounded-3xl">
                    {props.scenarioOptions.map((scenario) => (
                      <Select.Option
                        key={scenario.value}
                        {...scenario}
                        rounded="rounded-full"
                      />
                    ))}
                  </Select.Menu>
                </Select>
              ) : null}
            </div>
            <div className="flex items-center gap-1.5">
              {!["agent", "scenario"].includes(props.mode) && (
                <div data-tour="chat-composer-model">
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
    </div>
  );
}
