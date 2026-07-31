import { observer } from "mobx-react-lite";
import { Button, EmptyState, InputSmall } from "@kiyotakkkka/zvs-uikit-lib";
import { APP_PATHS } from "../../../app/routes";
import { PlusIcon, RobotIcon } from "../../../components/atoms";
import { AutomationAgentCard } from "../../../components/molecules";
import { PageHeader } from "../../../components/organisms";
import { useHashRouter } from "../../../hooks";
import { automationStore } from "../../../stores";
import { useMemo, useState } from "react";

export const AgentsListPage = observer(function AgentsListPage() {
  const { goTo } = useHashRouter();
  const [query, setQuery] = useState("");
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
          <Button
            variant="primary"
            onClick={() => goTo(APP_PATHS.automation.agents.create)}
          >
            <PlusIcon className="size-4" />
            Создать агента
          </Button>
        </div>
      </PageHeader>

      {agents.length ? (
        <div className="grid gap-3 xl:grid-cols-3">
          {agents.map((agent) => (
            <AutomationAgentCard key={agent.id} agent={agent} />
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
    </section>
  );
});
