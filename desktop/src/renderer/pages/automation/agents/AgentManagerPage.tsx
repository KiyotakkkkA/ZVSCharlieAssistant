import { useState } from "react";
import { observer } from "mobx-react-lite";
import { Navigate, useParams } from "react-router-dom";
import { useToasts } from "@kiyotakkkka/zvs-uikit-lib";
import { APP_PATHS } from "../../../app/routes";
import { AutomationAgentManageForm } from "../../../components/organisms/forms";
import { PageHeader } from "../../../components/organisms";
import { automationStore } from "../../../stores";
import { useAppNavigation } from "@renderer/hooks";

export const AgentManagerPage = observer(function AgentManagerPage() {
  const { agentId } = useParams();
  const { goTo } = useAppNavigation();
  const toasts = useToasts();
  const [submitting, setSubmitting] = useState(false);
  const model = automationStore.getAgent(agentId);
  const creating = !agentId;

  if (!creating && automationStore.initialized && !model) {
    return <Navigate to={APP_PATHS.automation.agents.index} replace />;
  }

  return (
    <section className="mx-auto w-full max-w-6xl p-4">
      <PageHeader
        title={model ? `Настройка: ${model.name}` : "Новый агент"}
        description="Агент является переиспользуемым профилем исполнения для сценариев."
        breadcrumbs={[
          { label: "Автоматизация" },
          { label: "Агенты", to: APP_PATHS.automation.agents.index },
          { label: creating ? "Новый агент" : model?.name },
        ]}
      />

      <AutomationAgentManageForm
        model={model}
        submitting={submitting}
        onCancel={() => goTo(APP_PATHS.automation.agents.index)}
        onSubmit={async (input) => {
          setSubmitting(true);
          try {
            await automationStore.upsertAgent(input);
            toasts.success({
              title: model ? "Агент обновлён" : "Агент создан",
            });
            goTo(APP_PATHS.automation.agents.index);
          } catch (error) {
            toasts.danger({
              title: "Не удалось сохранить агента",
              description:
                error instanceof Error ? error.message : "Неизвестная ошибка",
            });
          } finally {
            setSubmitting(false);
          }
        }}
      />
    </section>
  );
});
