import { observer } from "mobx-react-lite";
import {
  Button,
  EmptyState,
  InputSmall,
  ScrollArea,
  Switcher,
  useToasts,
} from "@kiyotakkkka/zvs-uikit-lib";
import { APP_PATHS } from "../../../app/routes";
import { CreationIcon, RobotIcon } from "../../../components/atoms";
import { AutomationAgentCard } from "../../../components/molecules";
import { PageHeader } from "../../../components/organisms";
import { useAppNavigation } from "../../../hooks";
import { automationStore, textProviderStore } from "../../../stores";
import { useMemo, useState } from "react";
import { PrimaryButton } from "@renderer/components/atoms/buttons";
import type { AutomationAgent } from "../../../../ipc/contracts";
import { DangerModal } from "@renderer/components/organisms/modals";
import { AutomationAgentsListTable } from "@renderer/components/organisms/tables";
import { AIEntityCreateForm } from "@renderer/components/organisms/forms";

type ViewMode = "table" | "cards";

export const AgentsListPage = observer(function AgentsListPage() {
  const { goTo } = useAppNavigation();
  const toasts = useToasts();
  const [query, setQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [agentToDelete, setAgentToDelete] = useState<AutomationAgent | null>(
    null,
  );
  const [generating, setGenerating] = useState(false);
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
          <PrimaryButton
            label="Добавить агента"
            onClick={() => goTo(APP_PATHS.automation.agents.create)}
          />
          <Button
            variant="tertiary"
            rounded="rounded-lg"
            title="Создать агента с помощью модели"
            onClick={() => setGenerating(true)}
          >
            <CreationIcon />
          </Button>
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
          <AutomationAgentsListTable
            agents={agents}
            modelLabel={textProviderStore.modelLabel}
            onEdit={(agent) =>
              goTo(
                APP_PATHS.automation.agents.edit.replace(":agentId", agent.id),
              )
            }
            onDelete={setAgentToDelete}
          />
        ) : (
          <div className="grid min-h-80 place-items-center">
            <EmptyState
              icon={<RobotIcon className="size-6" />}
              title={query ? "Агенты не найдены" : "Агентов пока нет"}
              description={query ? "Измените поисковый запрос." : "Агент — это исполнитель с ролью, моделью и набором инструментов."}
              action={
                <PrimaryButton
                  label="Создать агента"
                  onClick={() => goTo(APP_PATHS.automation.agents.create)}
                />
              }
            />
          </div>
        )}
      </ScrollArea>

      <AIEntityCreateForm
        open={generating}
        kind="agent"
        onClose={() => setGenerating(false)}
      />

      <DangerModal
        open={agentToDelete !== null}
        model={agentToDelete}
        title="Удалить агента"
        description={(agent) => (
          <p>
            Агент «
            <strong className="font-semibold text-main-50">{agent.name}</strong>
            » будет удалён без возможности восстановления. Перепроверьте
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
    </section>
  );
});
