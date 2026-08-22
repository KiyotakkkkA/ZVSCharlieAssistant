import { useState } from "react";
import { observer } from "mobx-react-lite";
import { Navigate, useParams } from "react-router-dom";
import { useToasts } from "@kiyotakkkka/zvs-uikit-lib";
import { APP_PATHS } from "../../../app/routes";
import { AutomationSkillManageForm } from "../../../components/organisms/forms";
import { PageHeader } from "../../../components/organisms";
import { useAppNavigation } from "../../../hooks";
import { automationStore } from "../../../stores";

export const SkillManagerPage = observer(function SkillManagerPage() {
  const { skillId } = useParams();
  const id = skillId;
  const model = automationStore.getSkill(id);
  const creating = !skillId;
  const [busy, setBusy] = useState(false);
  const { goTo } = useAppNavigation();
  const toasts = useToasts();
  if (!creating && automationStore.initialized && !model)
    return <Navigate to={APP_PATHS.automation.skills.index} replace />;
  return (
    <section className="mx-auto w-full max-w-6xl p-4">
      <PageHeader
        title={model ? `Настройка: ${model.name}` : "Новый навык"}
        description="Настройте свою инструкцию для агента"
        breadcrumbs={[
          { label: "Автоматизация" },
          { label: "Навыки", to: APP_PATHS.automation.skills.index },
          { label: model?.name ?? "Новый навык" },
        ]}
      />
      <AutomationSkillManageForm
        model={model}
        readOnly={model?.builtin}
        submitting={busy}
        onCancel={() => goTo(APP_PATHS.automation.skills.index)}
        onSubmit={async (input) => {
          setBusy(true);
          try {
            await automationStore.upsertSkill(input);
            toasts.success({ title: "Навык сохранён" });
            goTo(APP_PATHS.automation.skills.index);
          } catch (error) {
            toasts.danger({
              title: "Не удалось сохранить навык",
              description:
                error instanceof Error ? error.message : String(error),
            });
          } finally {
            setBusy(false);
          }
        }}
      />
    </section>
  );
});
