import { useState } from "react";
import { observer } from "mobx-react-lite";
import { ScrollArea } from "@kiyotakkkka/zvs-uikit-lib";
import { ChevronDownIcon, CheckIcon, TasksIcon } from "../../atoms";
import { taskPlanStore } from "../../../stores";
import type { TaskItemStatus } from "../../../../ipc/contracts";

const STATUS_TONE: Record<TaskItemStatus, string> = {
  pending: "border-main-600 bg-main-800 text-transparent",
  in_progress:
    "border-accent-medium bg-accent-medium/15 text-accent-light shadow-[0_0_10px_rgba(183,243,74,0.12)]",
  completed: "border-accent-medium/70 bg-accent-medium text-main-900",
  skipped: "border-main-600 bg-main-700 text-main-400",
};

export const ChatTaskPanel = observer(function ChatTaskPanel() {
  const [expanded, setExpanded] = useState(true);
  if (!taskPlanStore.hasTasks) return null;

  const { done, total } = taskPlanStore.progress;
  const items = taskPlanStore.plan?.items ?? [];
  const progress = total ? (done / total) * 100 : 0;

  return (
    <aside
      aria-label="План задач"
      className="absolute right-3 top-16 z-20 w-[min(19.5rem,calc(100%-1.5rem))] overflow-hidden rounded-xl border border-main-700/80 bg-main-800/95 shadow-[0_18px_55px_rgba(0,0,0,0.35)] backdrop-blur-xl"
    >
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls="chat-task-plan-content"
        className="flex w-full items-center gap-2 px-3 py-3 text-left transition-colors hover:bg-main-700/25 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-accent-medium/50"
        onClick={() => setExpanded((current) => !current)}
      >
        <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-accent-medium/10 text-accent-light">
          <TasksIcon className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 text-xs font-medium text-main-200">
            План
            <ChevronDownIcon
              className={`size-3.5 text-main-500 transition-transform duration-300 ${expanded ? "rotate-180" : "rotate-0"}`}
            />
          </span>
          <span className="mt-0.5 block truncate text-[11px] text-main-500">
            {done === total ? "Все задачи выполнены" : "Выполнение задачи"}
          </span>
        </span>
        <span className="shrink-0 text-[11px] tabular-nums text-main-500">
          {done} из {total}
        </span>
      </button>

      <div className="h-px bg-main-700/60">
        <div
          className="h-full bg-accent-medium transition-[width] duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div
        id="chat-task-plan-content"
        aria-hidden={!expanded}
        className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
          expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="min-h-0 overflow-hidden">
          <ScrollArea className="max-h-[min(24rem,50vh)]">
            <ol className="space-y-0.5 px-2 py-2">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="group/task flex items-start gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-main-700/25"
                >
                  <button
                    type="button"
                    aria-label={
                      item.status === "completed"
                        ? `Вернуть задачу «${item.subject}» в работу`
                        : `Отметить задачу «${item.subject}» выполненной`
                    }
                    className={`mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border transition-all ${STATUS_TONE[item.status]}`}
                    onClick={() =>
                      void taskPlanStore.setStatus(
                        item.position,
                        item.status === "completed" ? "pending" : "completed",
                      )
                    }
                  >
                    {item.status === "completed" ? (
                      <CheckIcon className="size-3" />
                    ) : item.status === "in_progress" ? (
                      <span className="size-1.5 rounded-full bg-current" />
                    ) : item.status === "skipped" ? (
                      <span className="h-px w-2 bg-current" />
                    ) : null}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-xs leading-5 ${
                        item.status === "completed" || item.status === "skipped"
                          ? "text-main-500 line-through"
                          : item.status === "in_progress"
                            ? "font-medium text-main-100"
                            : "text-main-300"
                      }`}
                    >
                      {item.subject}
                    </p>
                    {item.detail ? (
                      <p className="mt-0.5 text-[11px] leading-4 text-main-500">
                        {item.detail}
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
            <div className="border-t border-main-700/50 p-2">
              <button
                type="button"
                className="w-full rounded-lg px-2 py-1.5 text-left text-[11px] text-main-500 transition-colors hover:bg-main-700/25 hover:text-main-300"
                onClick={() => void taskPlanStore.clear()}
              >
                Очистить план
              </button>
            </div>
          </ScrollArea>
        </div>
      </div>
    </aside>
  );
});
