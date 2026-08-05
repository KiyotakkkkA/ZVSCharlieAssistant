import { useMemo, useState } from "react";
import { observer } from "mobx-react-lite";
import {
  EmptyState,
  InputSmall,
  ScrollArea,
  Switcher,
  useToasts,
} from "@kiyotakkkka/zvs-uikit-lib";
import type { AutomationSkill } from "../../../../ipc/contracts";
import { APP_PATHS } from "../../../app/routes";
import { SkillIcon } from "../../../components/atoms";
import { AutomationSkillCard } from "../../../components/molecules";
import { PrimaryButton } from "../../../components/atoms/buttons";
import { PageHeader } from "../../../components/organisms";
import { DangerModal } from "../../../components/organisms/modals";
import { useHashRouter } from "../../../hooks";
import { automationStore } from "../../../stores";
import { AutomationSkillsListTable } from "@renderer/components/organisms/tables";

export const SkillsListPage = observer(function SkillsListPage() {
  const { goTo } = useHashRouter();
  const toasts = useToasts();
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"table" | "cards">("cards");
  const [removing, setRemoving] = useState<AutomationSkill | null>(null);
  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q
      ? automationStore.skills.filter((x) =>
          `${x.name} ${x.slug} ${x.description}`.toLowerCase().includes(q),
        )
      : automationStore.skills;
  }, [query, automationStore.skills]);

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden p-4">
      <PageHeader
        title="Навыки"
        description="Переиспользуемые инструкции и знания, которые можно назначать агентам."
        breadcrumbs={[{ label: "Автоматизация" }, { label: "Навыки" }]}
      >
        <div className="flex gap-2">
          <Switcher
            value={mode}
            onChange={(v) => setMode(v as typeof mode)}
            options={[
              { value: "table", label: "Таблица" },
              { value: "cards", label: "Карточки" },
            ]}
          />
          <InputSmall
            preset="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onClear={() => setQuery("")}
            placeholder="Найти навык"
          />
          <PrimaryButton
            label="Добавить навык"
            onClick={() => goTo(APP_PATHS.automation.skills.create)}
          />
        </div>
      </PageHeader>
      <ScrollArea className="min-h-0 flex-1 p-1">
        {items.length ? (
          mode === "table" ? (
            <AutomationSkillsListTable
              skills={items}
              onEdit={(skill) =>
                goTo(
                  APP_PATHS.automation.skills.edit.replace(
                    ":skillId",
                    String(skill.id),
                  ),
                )
              }
              onDelete={setRemoving}
            />
          ) : (
            <div className="grid gap-3 xl:grid-cols-3">
              {items.map((x) => (
                <AutomationSkillCard
                  key={x.id}
                  skill={x}
                  onEdit={(skill) =>
                    goTo(
                      APP_PATHS.automation.skills.edit.replace(
                        ":skillId",
                        String(skill.id),
                      ),
                    )
                  }
                  onDelete={setRemoving}
                />
              ))}
            </div>
          )
        ) : (
          <div className="grid min-h-80 place-items-center">
            <EmptyState
              icon={<SkillIcon className="size-6" />}
              title="Навыков пока нет"
              description="Создайте первый навык с пошаговыми инструкциями."
            />
          </div>
        )}
      </ScrollArea>
      <DangerModal
        open={!!removing}
        model={removing}
        title="Удалить навык"
        description={(x) => (
          <>
            Навык «
            <strong className="font-semibold text-main-50">{x.name}</strong>»
            будет удалён с диска и отвязан от агентов.
          </>
        )}
        onCancel={() => setRemoving(null)}
        onConfirm={async (x) => {
          await automationStore.deleteSkill(x.id);
          setRemoving(null);
          toasts.success({ title: "Навык удалён" });
        }}
      />
    </section>
  );
});
