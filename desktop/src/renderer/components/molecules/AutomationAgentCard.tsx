import { Button } from "@kiyotakkkka/zvs-uikit-lib";
import { ClockIcon, RobotIcon } from "../atoms";
import { APP_PATHS } from "../../app/routes";
import type { AutomationAgent } from "../../domains/automation/models";
import { useHashRouter } from "../../hooks";

interface AutomationAgentCardProps {
  agent: AutomationAgent;
}

export const AutomationAgentCard = ({ agent }: AutomationAgentCardProps) => {
  const { goTo } = useHashRouter();

  return (
    <article className="rounded-xl bg-main-800/30 p-5 ring-1 ring-main-700/40 transition-colors hover:bg-main-800/50 hover:ring-main-600">
      <div className="flex items-start gap-4">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-main-700/50 text-main-200">
          <RobotIcon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-main-100">{agent.name}</h2>
            <StatusBadge status={agent.status} />
          </div>
          <p className="mt-2 text-sm leading-6 text-main-400">
            {agent.description}
          </p>
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
        <Button
          variant="secondary"
          className="px-2"
          onClick={() =>
            goTo(APP_PATHS.automation.agents.edit.replace(":agentId", agent.id))
          }
        >
          Настроить
        </Button>
      </div>
    </article>
  );
};

function StatusBadge({ status }: { status: AutomationAgent["status"] }) {
  const label =
    status === "active"
      ? "Активен"
      : status === "draft"
        ? "Черновик"
        : "Отключён";

  return (
    <span className="rounded-full bg-main-700/60 px-2 py-1 text-[10px] text-main-300">
      {label}
    </span>
  );
}
