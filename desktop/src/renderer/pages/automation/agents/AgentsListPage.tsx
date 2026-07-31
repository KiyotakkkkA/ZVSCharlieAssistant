import { observer } from "mobx-react-lite";
import {
  EmptyState,
  InputSmall,
  useToasts,
} from "@kiyotakkkka/zvs-uikit-lib";
import { APP_PATHS } from "../../../app/routes";
import { RobotIcon } from "../../../components/atoms";
import { AutomationAgentCard } from "../../../components/molecules";
import { DangerModal, PageHeader } from "../../../components/organisms";
import { useHashRouter } from "../../../hooks";
import { automationStore } from "../../../stores";
import { useMemo, useState } from "react";
import { CreateButton } from "@renderer/components/atoms/buttons";
import type { AutomationAgent } from "../../../../ipc/contracts";

export const AgentsListPage = observer(function AgentsListPage() {
  const { goTo } = useHashRouter();
  const toasts = useToasts();
  const [query, setQuery] = useState("");
  const [agentToDelete, setAgentToDelete] = useState<AutomationAgent | null>(
    null,
  );
  const agents = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return normalized
      ? automationStore.agents.filter((agent) =>
          `${agent.name} ${agent.description}`
            .toLocaleLowerCase()
            .includes(normalized),
        )
      : automationStore.agents;
  }, [query, automationStore.agents]);

  return (
    <section className="flex min-h-full flex-col p-4">
      <PageHeader
        title="Агенты"
        description="Настраивайте инструкции, инструменты и разрешения исполнителей."
        breadcrumbs={[{ label: "Автоматизация" }, { label: "Агенты" }]}
      >
        <div className="flex flex-wrap items-center justify-end gap-2">
          <InputSmall
            preset="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onClear={() => setQuery("")}
            placeholder="Найти агента"
            className="w-64"
          />
          <CreateButton
            label="Добавить агента"
            onClick={() => goTo(APP_PATHS.automation.agents.create)}
          />
        </div>
      </PageHeader>

      {agents.length ? (
        <div className="grid gap-3 xl:grid-cols-3">
          {agents.map((agent) => (
            <AutomationAgentCard
              key={agent.id}
              agent={agent}
              onDelete={setAgentToDelete}
            />
          ))}
        </div>
      ) : (
        <div className="grid min-h-80 place-items-center">
          <EmptyState
            icon={<RobotIcon className="size-6" />}
            title="Агенты не найдены"
            description="Измените запрос или создайте нового агента."
          />
        </div>
      )}

      {agentToDelete ? (
        <DangerModal
          model={agentToDelete}
          title="Удалить агента"
          description={(agent) => (
            <p>
              Агент <span className="font-medium text-main-50">{agent.name}</span>{" "}
              будет удалён без возможности восстановления. Сценарии, где он
              используется, потребуется проверить вручную.
            </p>
          )}
          onCancel={() => setAgentToDelete(null)}
          onConfirm={async (agent) => {
            await automationStore.deleteAgent(agent.id);
            setAgentToDelete(null);
            toasts.success({ title: "Агент удалён" });
          }}
        />
      ) : null}
    </section>
  );
});
