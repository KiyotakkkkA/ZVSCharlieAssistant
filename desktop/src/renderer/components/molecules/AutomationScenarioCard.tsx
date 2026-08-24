import type { AutomationScenario } from "../../../ipc/contracts";
import {
  BlockIcon,
  EntityStatusBadge,
  CheckIcon,
  FileClockIcon,
  ScriptIcon,
} from "../atoms";
import { ControlButton } from "../atoms/buttons";

interface AutomationScenarioCardProps {
  scenario: AutomationScenario;
  onEdit: (scenario: AutomationScenario) => void;
  onDelete: (scenario: AutomationScenario) => void;
}

export function AutomationScenarioCard({
  scenario,
  onEdit,
  onDelete,
}: AutomationScenarioCardProps) {
  return (
    <article className="relative flex h-full min-h-44 flex-col rounded-xl bg-main-800/30 p-5 ring-1 ring-main-700/40 transition-colors hover:bg-main-800/50 hover:ring-main-600">
      <div className="flex flex-1 items-start gap-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-medium/10 text-accent-light">
          <ScriptIcon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="truncate font-semibold text-main-100">
              {scenario.name}
            </h2>
          </div>
          <p className="mt-2 min-h-12 line-clamp-2 text-sm leading-6 text-main-400">
            {scenario.description}
          </p>
        </div>
        <div className="flex">
          <ControlButton
            icon="edit"
            title="Открыть редактор"
            onClick={() => onEdit(scenario)}
          />
          <ControlButton
            icon="trash"
            title="Удалить сценарий"
            variant="delete"
            onClick={() => onDelete(scenario)}
          />
        </div>
      </div>
      <div className="mt-5 flex flex-wrap gap-4 border-t border-main-700/40 pr-24 pt-4 text-xs text-main-500">
        <span>{scenario.nodesCount} узлов</span>
        <span>
          {scenario.lastRunAt
            ? `Запуск: ${scenario.lastRunAt}`
            : "Ещё не запускался"}
        </span>
        <span>{scenario.updatedAt}</span>
      </div>
      <EntityStatusBadge status={scenario.status} />
    </article>
  );
}
