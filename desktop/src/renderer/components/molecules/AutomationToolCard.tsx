import type { AutomationTool } from "../../../ipc/contracts";
import { SettingsIcon } from "../atoms";
import { ControlButton } from "../atoms/buttons";

interface AutomationToolCardProps {
  tool: AutomationTool;
  onOpen: (tool: AutomationTool) => void;
}

export function AutomationToolCard({ tool, onOpen }: AutomationToolCardProps) {
  return (
    <article className="rounded-xl bg-main-800/30 p-5 ring-1 ring-main-700/40 transition-colors hover:bg-main-800/50 hover:ring-main-600">
      <div className="flex items-start gap-4">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-main-700/50 text-main-200">
          <SettingsIcon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="truncate font-semibold text-main-100">{tool.name}</h2>
            <span className={tool.enabled ? "text-xs text-success-light" : "text-xs text-main-500"}>
              {tool.enabled ? "Доступен" : "Отключён"}
            </span>
          </div>
          <p className="mt-1 truncate font-mono text-xs text-main-500">{tool.id}</p>
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-main-400">{tool.description}</p>
        </div>
        <ControlButton icon="eye" title="Подробнее" onClick={() => onOpen(tool)} />
      </div>
      <div className="mt-5 flex flex-wrap gap-2 border-t border-main-700/40 pt-4 text-xs text-main-500">
        <span>{tool.category}</span>
        <span>·</span>
        <span>{tool.requiresConfirmation ? "Требует подтверждения" : "Без подтверждения"}</span>
      </div>
    </article>
  );
}
