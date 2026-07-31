import { useState } from "react";
import { observer } from "mobx-react-lite";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { useToasts } from "@kiyotakkkka/zvs-uikit-lib";
import { APP_PATHS } from "../../../app/routes";
import { AgentManageForm } from "../../../components/organisms/forms";
import { automationStore } from "../../../stores";

export const AgentManagerPage = observer(function AgentManagerPage() {
  const { agentId } = useParams();
  const navigate = useNavigate();
  const toasts = useToasts();
  const [submitting, setSubmitting] = useState(false);
  const model = automationStore.getAgent(agentId);
  const creating = !agentId;

  if (!creating && automationStore.initialized && !model) {
    return <Navigate to={APP_PATHS.automation.agents.index} replace />;
  }

  return (
    <section className="mx-auto w-full max-w-6xl p-4">
      <header className="mb-6">
        <p className="mb-1 text-sm text-main-400">Автоматизация · Агенты</p>
        <h1 className="text-2xl font-semibold tracking-tight">
          {model ? `Настройка: ${model.name}` : "Новый агент"}
        </h1>
        <p className="mt-2 text-sm text-main-400">
          Агент является переиспользуемым профилем исполнения для сценариев.
        </p>
      </header>

      <AgentManageForm
        model={model}
        submitting={submitting}
        onCancel={() => navigate(APP_PATHS.automation.agents.index)}
        onSubmit={async (input) => {
          setSubmitting(true);
          try {
            await automationStore.upsertAgent(input);
            toasts.success({
              title: model ? "Агент обновлён" : "Агент создан",
            });
            navigate(APP_PATHS.automation.agents.index);
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
