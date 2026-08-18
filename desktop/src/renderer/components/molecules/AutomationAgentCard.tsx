import {
  BlockIcon,
  EntityStatusBadge,
  CheckIcon,
  ClockIcon,
  FileClockIcon,
  GraphIcon,
} from "../atoms";
import { APP_PATHS } from "../../app/routes";
import type { AutomationAgent } from "../../../ipc/contracts";
import { useAppNavigation } from "../../hooks";
import { ControlButton } from "../atoms/buttons";

interface AutomationAgentCardProps {
  agent: AutomationAgent;
  onDelete: (agent: AutomationAgent) => void;
}

export const AutomationAgentCard = ({
  agent,
  onDelete,
}: AutomationAgentCardProps) => {
  const { goTo } = useAppNavigation();

  return (
    <article className="relative rounded-xl bg-main-800/30 p-5 ring-1 ring-main-700/40 transition-colors hover:bg-main-800/50 hover:ring-main-600">
      <div className="flex items-start gap-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-medium/10 text-accent-light">
          <GraphIcon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-main-100">{agent.name}</h2>
          </div>
          <p className="mt-2 text-sm leading-6 text-main-400">
            {agent.description}
          </p>
        </div>
        <div>
          <ControlButton
            icon="edit"
            title="Изменить"
            onClick={() =>
              goTo(
                APP_PATHS.automation.agents.edit.replace(":agentId", agent.id),
              )
            }
          />
          <ControlButton
            icon="trash"
            title="Удалить"
            variant="delete"
            onClick={() => onDelete(agent)}
          />
        </div>
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-main-700/40 pt-4">
        <div className="flex items-center gap-4 text-xs text-main-500">
          <span>{agent.allowedToolIds.length} инструментов</span>
          <span>{agent.runs} запусков</span>
          <span className="flex items-center gap-1.5">
            <ClockIcon className="size-3.5" />
            {agent.updatedAt}
          </span>
        </div>
      </div>
      <EntityStatusBadge status={agent.status} />
    </article>
  );
};
