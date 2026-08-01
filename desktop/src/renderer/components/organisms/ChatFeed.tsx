import { ScrollArea } from "@kiyotakkkka/zvs-uikit-lib";
import { ChatIcon, RobotIcon, StorageIcon, TasksIcon } from "../atoms";

export interface ChatMessage {
  id: number;
  role: "user" | "assistant";
  text: string;
}

const suggestions = [
  {
    icon: TasksIcon,
    title: "Составить план",
    prompt: "Помоги составить пошаговый план для нового проекта",
  },
  {
    icon: RobotIcon,
    title: "Запустить агента",
    prompt: "Подбери подходящего агента для моей задачи",
  },
  {
    icon: StorageIcon,
    title: "Разобрать данные",
    prompt: "Помоги структурировать и проанализировать данные",
  },
];

interface ChatFeedProps {
  title: string;
  messages: ChatMessage[];
  onSuggestionSelect: (prompt: string) => void;
}

export function ChatFeed({
  title,
  messages,
  onSuggestionSelect,
}: ChatFeedProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex h-14 shrink-0 items-center border-b border-main-700/35 px-5">
        <span className="mr-3 grid size-8 place-items-center rounded-lg bg-accent-medium/10 text-accent-light">
          <ChatIcon className="size-4" />
        </span>
        <div>
          <h1 className="text-sm font-semibold text-main-100">{title}</h1>
          <p className="text-[11px] text-main-500">
            Сообщения сохраняются локально
          </p>
        </div>
      </header>
      <ScrollArea className="min-h-0 flex-1" showScrollbar={false}>
        <div className="mx-auto flex min-h-full w-full max-w-4xl flex-col px-5 pb-44 pt-8">
          {messages.length === 0 ? (
            <div className="my-auto flex flex-col items-center py-12 text-center">
              <span className="mb-6 grid size-16 place-items-center rounded-3xl bg-main-700/60 text-accent-light">
                <ChatIcon className="size-7" />
              </span>
              <h2 className="text-3xl font-semibold tracking-tight text-main-50">
                Чем могу помочь?
              </h2>
              <p className="mt-3 max-w-lg text-sm leading-6 text-main-400">
                Задайте вопрос, составьте план или поручите выполнение одному из
                ваших агентов.
              </p>
              <div className="mt-8 grid w-full gap-3 md:grid-cols-3">
                {suggestions.map((item) => (
                  <button
                    key={item.title}
                    type="button"
                    className="group rounded-xl bg-main-800/50 p-4 text-left transition-colors hover:bg-main-700/65"
                    onClick={() => onSuggestionSelect(item.prompt)}
                  >
                    <span className="grid size-8 place-items-center rounded-lg bg-main-700/35 text-main-400 transition-colors group-hover:bg-main-600/70 group-hover:text-main-50">
                      <item.icon className="size-4" />
                    </span>
                    <span className="mt-4 block text-sm font-medium text-main-200">
                      {item.title}
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-main-500">
                      {item.prompt}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-8 py-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={
                    message.role === "user"
                      ? "flex justify-end"
                      : "flex justify-start gap-3"
                  }
                >
                  {message.role === "assistant" ? (
                    <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-accent-medium/10 text-accent-light">
                      <ChatIcon className="size-4" />
                    </span>
                  ) : null}
                  <div
                    className={
                      message.role === "user"
                        ? "max-w-2xl rounded-2xl rounded-br-md bg-main-700/65 px-4 py-3 text-sm leading-6 text-main-100"
                        : "max-w-2xl py-1 text-sm leading-6 text-main-200"
                    }
                  >
                    {message.text}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
