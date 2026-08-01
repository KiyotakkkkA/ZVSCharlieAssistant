import { observer } from "mobx-react-lite";
import {
  EmptyState,
  InputSmall,
  ScrollArea,
  Switcher,
  Table,
  useToasts,
  type TableColumn,
} from "@kiyotakkkka/zvs-uikit-lib";
import { APP_PATHS } from "../../../app/routes";
import { RobotIcon } from "../../../components/atoms";
import { AutomationAgentCard } from "../../../components/molecules";
import { DangerModal, PageHeader } from "../../../components/organisms";
import { useHashRouter } from "../../../hooks";
import { automationStore, textProviderStore } from "../../../stores";
import { useMemo, useState } from "react";
import {
  ControlButton,
  CreateButton,
} from "@renderer/components/atoms/buttons";
import type { AutomationAgent } from "../../../../ipc/contracts";

interface AgentTableRow extends AutomationAgent {
  [key: string]: unknown;
}

type ViewMode = "table" | "cards";

const STATUS_LABELS: Record<AutomationAgent["status"], string> = {
  active: "Активен",
  draft: "Черновик",
  disabled: "Отключён",
};

export const AgentsListPage = observer(function AgentsListPage() {
  const { goTo } = useHashRouter();
  const toasts = useToasts();
  const [query, setQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
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

  const columns: Array<TableColumn<AgentTableRow>> = [
    {
      key: "name",
      title: "Агент",
      render: (agent) => (
        <div>
          <p className="font-medium text-main-100">{agent.name}</p>
          <p className="mt-1 max-w-xl truncate text-xs text-main-500">
            {agent.description}
          </p>
        </div>
      ),
    },
    {
      key: "status",
      title: "Статус",
      render: (agent) => (
        <span className="rounded-full bg-main-700/60 px-2 py-1 text-xs text-main-300">
          {STATUS_LABELS[agent.status]}
        </span>
      ),
    },
    {
      key: "model",
      title: "Модель",
      render: (agent) => {
        const value = agent.textModelId;
        const separator = value?.indexOf(":") ?? -1;
        return <span className="text-main-300">{value && separator > 0 ? textProviderStore.modelLabel(Number(value.slice(0, separator)), value.slice(separator + 1)) : "Не настроена"}</span>;
      },
    },
    {
      key: "tools",
      title: "Инструменты",
      render: (agent) => (
        <span className="text-main-400">{agent.allowedToolIds.length}</span>
      ),
    },
    {
      key: "runs",
      title: "Запуски",
      render: (agent) => <span className="text-main-400">{agent.runs}</span>,
    },
    {
      key: "updatedAt",
      title: "Обновлён",
      render: (agent) => (
        <span className="whitespace-nowrap text-main-400">
          {agent.updatedAt}
        </span>
      ),
    },
    {
      key: "actions",
      title: <span className="sr-only">Действия</span>,
      headerClassName: "text-right",
      cellClassName: "text-right",
      render: (agent) => (
        <div className="flex justify-end">
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
            onClick={() => setAgentToDelete(agent)}
          />
        </div>
      ),
    },
  ];

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden p-4">
      <PageHeader
        title="Агенты"
        description="Настраивайте инструкции, инструменты и разрешения исполнителей."
        breadcrumbs={[{ label: "Автоматизация" }, { label: "Агенты" }]}
      >
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Switcher
            value={viewMode}
            onChange={(value) => setViewMode(value as ViewMode)}
            options={[
              { value: "table", label: "Таблица" },
              { value: "cards", label: "Карточки" },
            ]}
          />
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

      <ScrollArea className="min-h-0 flex-1 p-1">
        {agents.length && viewMode === "cards" ? (
          <div className="grid gap-3 xl:grid-cols-3">
            {agents.map((agent) => (
              <AutomationAgentCard
                key={agent.id}
                agent={agent}
                onDelete={setAgentToDelete}
              />
            ))}
          </div>
        ) : agents.length ? (
          <Table<AgentTableRow>
            data={agents.map((agent) => ({ ...agent }))}
            columns={columns}
            rowKey="id"
            classNames={{
              root: "w-full",
              row: "transition-colors hover:bg-main-800/45",
            }}
          />
        ) : (
          <div className="grid min-h-80 place-items-center">
            <EmptyState
              icon={<RobotIcon className="size-6" />}
              title="Агенты не найдены"
              description="Измените запрос или создайте нового агента."
            />
          </div>
        )}
      </ScrollArea>

      {agentToDelete ? (
        <DangerModal
          model={agentToDelete}
          title="Удалить агента"
          description={(agent) => (
            <p>
              Агент{" "}
              <span className="font-medium text-main-50">{agent.name}</span>{" "}
              будет удалён без возможности восстановления. Перепроверьте
              сценарии в которых был использован данный агент.
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
