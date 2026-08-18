import { Dropdown, Floating } from "@kiyotakkkka/zvs-uikit-lib";
import { MoreIcon, TrashIcon, BlockIcon } from "@renderer/components/atoms";
import type { ReactNode } from "react";
import type { ScenarioNode } from "../../../../shared/scenario/graph";
import { nodeVisual } from "./node-visuals";

interface ScenarioNodeCardProps {
  node: ScenarioNode;
  selected: boolean;
  showDescription: boolean;
  runStatus?: string;
  issue?: "error" | "warning";
  onDelete?: (nodeId: string) => void;
  onToggleDisabled?: (nodeId: string) => void;
  children?: ReactNode;
}

export function ScenarioNodeCard({
  node,
  selected,
  showDescription,
  runStatus,
  issue,
  onDelete,
  onToggleDisabled,
  children,
}: ScenarioNodeCardProps) {
  const visual = nodeVisual(node.kind);
  const Icon = visual.icon;

  const card = (
    <div className="group/node relative h-full w-full select-none">
      {children}
      <div
        className={`relative flex h-full items-center gap-2.5 rounded-lg bg-main-800 px-2.5 py-2 ring-1 transition-[box-shadow,background-color,opacity] ${node.disabled ? "opacity-45" : ""} ${nodeRingClassName(runStatus, selected, issue)}`}
      >
        <span
          className={`grid size-7 shrink-0 place-items-center rounded-md ${visual.iconClassName}`}
        >
          <Icon className="size-3.5" />
        </span>
        <div className="min-w-0 flex-1 pr-4">
          <p className="truncate text-xs font-medium text-main-100">
            {node.name}
          </p>
          <p className="mt-0.5 truncate text-[9px] uppercase tracking-wider text-main-500">
            {visual.label}
          </p>
        </div>
        {node.disabled ? (
          <BlockIcon className="absolute right-2 bottom-1.5 size-3 text-main-500" />
        ) : null}
        {onDelete ? (
          <Dropdown
            menuWidth={180}
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
              {onToggleDisabled ? (
                <Dropdown.Item
                  icon={<BlockIcon className="size-4" />}
                  className="rounded-lg"
                  onClick={(event) => {
                    event.stopPropagation();
                    onToggleDisabled(node.id);
                  }}
                >
                  {node.disabled ? "Включить узел" : "Отключить узел"}
                </Dropdown.Item>
              ) : null}
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

  if (!showDescription) return card;
  return (
    <Floating anchor="bottom-center" className="h-full w-full">
      <Floating.Trigger className="h-full w-full">{card}</Floating.Trigger>
      <Floating.Content className="nodrag nopan w-64 text-xs leading-5 text-main-300">
        <p className="mb-1 font-medium text-main-100">{node.name}</p>
        {node.description || visual.description || "Описание не задано"}
      </Floating.Content>
    </Floating>
  );
}

function nodeRingClassName(
  runStatus: string | undefined,
  selected: boolean,
  issue: "error" | "warning" | undefined,
) {
  if (runStatus === "running" || runStatus === "waiting_for_approval")
    return "ring-accent-medium/90";
  if (runStatus === "completed") return "ring-success-medium/60";
  if (runStatus === "failed") return "ring-danger-medium/70";
  if (selected) return "ring-accent-medium/80";
  if (issue === "error") return "ring-danger-medium/60";
  if (issue === "warning") return "ring-warning-medium/50";
  return "ring-main-700 hover:ring-main-500";
}
