import type { ChatToolCall } from "../../../../ipc/contracts";
import {
  KeyIcon,
  NumbersIcon,
  RobotIcon,
  ScriptIcon,
  TransitConnectionIcon,
  type SvgIcon,
} from "../../atoms";
import { CompactToolStatus } from "./CompactToolStatus";

const RESOURCE_KIND_META: Record<
  string,
  { icon: SvgIcon; running: string; completed: string }
> = {
  agents: {
    icon: RobotIcon,
    running: "Запрашивает список агентов",
    completed: "Получен список агентов",
  },
  vectorStores: {
    icon: NumbersIcon,
    running: "Запрашивает список хранилищ знаний",
    completed: "Получен список хранилищ знаний",
  },
  integrations: {
    icon: TransitConnectionIcon,
    running: "Запрашивает список подключений",
    completed: "Получен список подключений",
  },
  scenarios: {
    icon: ScriptIcon,
    running: "Запрашивает список сценариев",
    completed: "Получен список сценариев",
  },
  secrets: {
    icon: KeyIcon,
    running: "Запрашивает список секретов",
    completed: "Получен список секретов",
  },
};

export function CompactToolListResourcesBlock({
  call,
}: {
  call: ChatToolCall;
}) {
  const kind = requestedKind(call.input);
  const meta = (kind ? RESOURCE_KIND_META[kind] : undefined) ?? {
    icon: TransitConnectionIcon,
    running: "Запрашивает ресурсы",
    completed: "Ресурсы получены",
  };
  const items = resultItems(call.output);
  return (
    <CompactToolStatus>
      <CompactToolStatus.Trigger
        icon={meta.icon}
        running={meta.running}
        completed={
          call.status === "completed"
            ? `${meta.completed} (${items.length})`
            : meta.completed
        }
        status={call.status}
      />
      <CompactToolStatus.Expandable className="p-0!">
        <ResourceListDetails call={call} items={items} />
      </CompactToolStatus.Expandable>
    </CompactToolStatus>
  );
}

function ResourceListDetails({
  call,
  items,
}: {
  call: ChatToolCall;
  items: Record<string, unknown>[];
}) {
  if (!items.length)
    return (
      <p className="px-4 py-3.5 text-xs text-main-500">
        {call.error ?? "Ничего не найдено"}
      </p>
    );

  return (
    <ul className="divide-y divide-main-700/35">
      {items.map((item, index) => {
        const title =
          typeof item.name === "string"
            ? item.name
            : typeof item.label === "string"
              ? item.label
              : `Запись ${index + 1}`;
        const meta = [item.channel, item.category, item.status]
          .filter((value): value is string => typeof value === "string")
          .join(" · ");
        return (
          <li key={String(item.id ?? index)} className="px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="truncate text-xs font-medium text-main-200">
                {title}
              </span>
              {meta ? (
                <span className="shrink-0 text-[10px] uppercase tracking-wide text-main-600">
                  {meta}
                </span>
              ) : null}
            </div>
            {typeof item.description === "string" && item.description ? (
              <p className="mt-1 text-xs leading-5 text-main-400">
                {item.description}
              </p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function requestedKind(input: unknown): string | null {
  return isRecord(input) && typeof input.kind === "string" ? input.kind : null;
}

function resultItems(output: unknown): Record<string, unknown>[] {
  return Array.isArray(output) ? output.filter(isRecord) : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
