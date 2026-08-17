import { AutomationScenarioNodeKind } from "@ipc/contracts";
import { Dropdown, Floating } from "@kiyotakkkka/zvs-uikit-lib";
import {
  SvgIcon,
  PlayCircleIcon,
  RobotIcon,
  StorageIcon,
  CogIcon,
  TasksIcon,
  SendIcon,
  MoreIcon,
  TrashIcon,
  DownloadIcon,
  FileIcon,
} from "@renderer/components/atoms";
import { ReactNode } from "react";
import { AutomationScenarioNode } from "src/shared/dto";

interface ScenarioNodeCardProps {
  node: AutomationScenarioNode;
  variant: ScenarioNodeVariant;
  selected: boolean;
  showDescription: boolean;
  runStatus?: string;
  onDelete?: (nodeId: string) => void;
  children?: ReactNode;
}

export interface ScenarioNodeVariant {
  label: string;
  icon: SvgIcon;
  iconClassName: string;
}

export const scenarioNodeVariants: Record<
  AutomationScenarioNodeKind,
  ScenarioNodeVariant
> = {
  trigger: {
    label: "Триггер",
    icon: PlayCircleIcon,
    iconClassName: "bg-amber-400/10 text-amber-200",
  },
  orchestrator: {
    label: "Оркестратор",
    icon: RobotIcon,
    iconClassName: "bg-violet-400/10 text-violet-200",
  },
  agent: {
    label: "Агент",
    icon: RobotIcon,
    iconClassName: "bg-violet-400/10 text-violet-200",
  },
  knowledge_store: {
    label: "Хранилище",
    icon: StorageIcon,
    iconClassName: "bg-cyan-400/10 text-cyan-200",
  },
  download_files: {
    label: "Файлы",
    icon: DownloadIcon,
    iconClassName: "bg-pink-400/10 text-pink-200",
  },
  read_files: {
    label: "Чтение файлов",
    icon: FileIcon,
    iconClassName: "bg-pink-400/10 text-pink-200",
  },
  condition: {
    label: "Условие",
    icon: CogIcon,
    iconClassName: "bg-sky-400/10 text-sky-200",
  },
  approval: {
    label: "Подтверждение",
    icon: TasksIcon,
    iconClassName: "bg-lime-400/10 text-lime-200",
  },
  output: {
    label: "Результат",
    icon: SendIcon,
    iconClassName: "bg-emerald-400/10 text-emerald-200",
  },
};

export function ScenarioNodeCard({
  node,
  variant,
  selected,
  showDescription,
  runStatus,
  onDelete,
  children,
}: ScenarioNodeCardProps) {
  const Icon = variant.icon;
  const isTrigger = node.kind === "trigger";
  const card = (
    <div className="group/node relative h-full w-full select-none">
      {children}
      <div
        className={`relative flex items-center gap-2.5 rounded-lg bg-main-800 px-2.5 py-2 ring-1 transition-[box-shadow,background-color] ${isTrigger ? "h-15" : "h-full"} ${nodeRingClassName(runStatus, selected)}`}
      >
        <span
          className={`grid size-7 shrink-0 place-items-center rounded-md ${variant.iconClassName}`}
        >
          <Icon className="size-3.5" />
        </span>
        <div className="min-w-0 flex-1 pr-4">
          <p className="truncate text-xs font-medium text-main-100">
            {node.title}
          </p>
          <p className="mt-0.5 text-[9px] uppercase tracking-wider text-main-500">
            {variant.label}
          </p>
        </div>
        {onDelete ? (
          <Dropdown
            menuWidth={170}
            menuPlacement="bottom-right"
            className="absolute right-2 top-0"
          >
            <Dropdown.Trigger
              icon={<MoreIcon className="size-3 text-main-500" />}
              aria-label="Настроить узел"
              rounded="rounded"
              className="nodrag nopan size-4.5 justify-center gap-0 border-0! bg-transparent px-0 py-0 opacity-0 shadow-none ring-0! transition-opacity group-hover/node:opacity-100 hover:bg-main-600 focus:opacity-100"
            >
              <span className="sr-only">Настроить узел</span>
            </Dropdown.Trigger>
            <Dropdown.Menu rounded="rounded-xl" className="p-1.5">
              <Dropdown.Item
                icon={<TrashIcon className="size-4" />}
                className="rounded-lg text-danger-light"
                onClick={(event) => {
                  event.stopPropagation();
                  onDelete(node.id);
                }}
              >
                Удалить узел
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown>
        ) : null}
      </div>
    </div>
  );
  if (isTrigger || !showDescription) return card;
  return (
    <Floating anchor="bottom-center" className="h-full w-full">
      <Floating.Trigger className="h-full w-full">{card}</Floating.Trigger>
      <Floating.Content className="nodrag nopan w-64 text-xs leading-5 text-main-300">
        <p className="mb-1 font-medium text-main-100">{node.title}</p>
        {node.description || "Описание не задано"}
      </Floating.Content>
    </Floating>
  );
}

function nodeRingClassName(runStatus: string | undefined, selected: boolean) {
  if (runStatus === "running" || runStatus === "waiting_for_approval")
    return "ring-accent-medium/90";
  if (runStatus === "completed") return "ring-success-medium/60";
  if (runStatus === "failed") return "ring-danger-medium/70";
  return selected
    ? "ring-accent-medium/80"
    : "ring-main-700 hover:ring-main-500";
}
